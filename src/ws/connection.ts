import type { Profile, WidgetState } from "@macro/renderer";
import { missingAssets, putAsset, resolveAssetRefs } from "./assets";
import { applyLayoutPatch, type LayoutPatchData } from "./layoutPatch";

/**
 * Every frame is { type, data }, matching MacroStation.Protocol.Envelope server-side. This client
 * only needs the message types Stage 5 actually uses; the rest (page.change echo, value push, etc.)
 * can be added the same way when the drawer/slider work lands.
 */
interface Envelope<T = unknown> {
  type: string;
  data?: T;
}

interface LayoutFullData {
  profile: Profile;
  pageId: string;
}

interface AssetData {
  hash: string;
  /** Null when the server no longer knows this hash. */
  data?: string | null;
}

interface PageShowData {
  pageId: string;
}

interface WelcomeData {
  serverName: string;
  serverVersion: string;
  token?: string | null;
}

interface ErrorData {
  code: string;
  message: string;
}

export interface ProfileSummary {
  id: string;
  name: string;
}

/** This device's auto-profile-switch opt-in and current lock state — see docs/auto-profile-switch.md in
 * the server repo. `enabled: false` means the device never auto-switches; the drawer hides the lock. */
export interface AutoSwitchInfo {
  enabled: boolean;
  locked: boolean;
}

interface ProfilesListData {
  profiles: ProfileSummary[];
  autoSwitch?: AutoSwitchInfo | null;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "pairing_required";

export interface ConnectionEvents {
  onStatusChange: (status: ConnectionStatus) => void;
  /** A full layout arrived. `profile` has every asset reference resolved to its data, ready to render;
   * `cacheProfile` is the same layout with the compact `asset:` references, which is what should be persisted
   * (the assets themselves are cached separately, once each). */
  onLayout: (profile: Profile, pageId: string, cacheProfile: Profile) => void;
  /** An edit was patched into the layout: only the listed widgets changed, so their live state is stale
   * (the server re-sends it right after) while every other widget keeps what it had. */
  onLayoutPatch: (profile: Profile, pageId: string, cacheProfile: Profile, changedWidgetIds: string[]) => void;
  /** Server pushed a page change for a `core.page` action (goto/next/prev/back) fired from any device
   * on this profile — the button that triggered it doesn't get a special-cased response, everyone
   * showing this profile just gets told which page to show now. */
  onPageChange: (pageId: string) => void;
  onWidgetState: (state: WidgetState) => void;
  onProfiles: (profiles: ProfileSummary[], autoSwitch: AutoSwitchInfo | null) => void;
  /** A brand-new token was issued (first pairing, or a re-pair) — the caller must persist it: it
   * replaces the PIN on every future connection attempt. */
  onPaired: (token: string) => void;
  /** A widget's action failed server-side (e.g. a button pointed at a since-deleted OBS scene) —
   * surfaced as a toast so a stale binding is never a silent no-op on the device that pressed it. */
  onActionError: (message: string) => void;
}

const CLIENT_VERSION = "0.1.0";
const MAX_BACKOFF_MS = 10_000;
/** Optional protocol features this client understands — see ClientCapabilities.cs server-side. */
const CAPABILITIES = ["assets", "layout.patch"];
/** How long a layout waits for the assets it references before it is shown with those icons blank. */
const ASSET_WAIT_MS = 5_000;

/**
 * Owns one WebSocket to the server: sends hello on connect, dispatches incoming envelopes to the
 * caller, and reconnects with exponential backoff on drop (Wi-Fi blip, server restart, etc.) — the
 * one piece of client resilience the plan calls out explicitly (Stage 5).
 */
export class ServerConnection {
  private socket: WebSocket | null = null;
  private backoffMs = 500;
  private closedByUser = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Set once `disconnect()` is called and never cleared. Without this, a stale socket's delayed
   * `onclose` (closing takes a round trip, it doesn't fire synchronously) can still land after a
   * *newer* ServerConnection has already connected — e.g. React 18 StrictMode deliberately mounts an
   * effect, cleans it up, then mounts it again in dev, so `connect()` briefly creates two instances.
   * The old instance's late "disconnected" would otherwise stomp the new instance's "connected" in
   * the UI. Every event handler below checks this before touching `this.events`.
   */
  private destroyed = false;
  /** Messages are handled strictly in arrival order, even when one has to wait for assets first. */
  private inbox: Promise<void> = Promise.resolve();
  /** The layout as the server last described it (still with `asset:` references), the base a patch applies to. */
  private cacheProfile: Profile | null = null;
  private assetWaiters = new Map<string, Array<() => void>>();

  constructor(
    private readonly host: string,
    private readonly deviceId: string,
    private readonly deviceName: string,
    private token: string | null,
    private readonly events: ConnectionEvents,
  ) {}

  connect(): void {
    this.closedByUser = false;
    this.open();
  }

  disconnect(): void {
    this.closedByUser = true;
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }

  send(type: string, data?: unknown): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type, data } satisfies Envelope));
  }

  /** Retries `hello` on the still-open socket with a PIN the user just typed, after the server asked for one. */
  retryWithPin(pin: string): void {
    this.sendHello(pin);
  }

  private sendHello(pin?: string): void {
    this.send("hello", {
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      token: this.token,
      clientVersion: CLIENT_VERSION,
      pin,
      capabilities: CAPABILITIES,
    });
  }

  private open(): void {
    if (this.destroyed) return;
    this.events.onStatusChange("connecting");
    const socket = new WebSocket(`ws://${this.host}/ws`);
    this.socket = socket;

    socket.onopen = () => {
      if (this.destroyed) return;
      this.backoffMs = 500;
      this.sendHello();
      this.events.onStatusChange("connected");
    };

    socket.onmessage = (ev) => {
      if (this.destroyed) return;
      let envelope: Envelope;
      try {
        envelope = JSON.parse(ev.data);
      } catch {
        return;
      }
      // Asset data must not queue behind the very layout that is waiting for it.
      if (envelope.type === "asset") {
        this.handleAsset(envelope.data as AssetData);
        return;
      }
      this.inbox = this.inbox.then(() => (this.destroyed ? undefined : this.handleMessage(envelope))).catch(() => {});
    };

    socket.onclose = () => {
      if (this.destroyed) return;
      this.events.onStatusChange("disconnected");
      if (this.closedByUser) return;
      this.reconnectTimer = setTimeout(() => this.open(), this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    };

    socket.onerror = () => socket.close();
  }

  private async handleMessage(envelope: Envelope): Promise<void> {
    switch (envelope.type) {
      case "welcome": {
        const data = envelope.data as WelcomeData;
        if (data.token) {
          this.token = data.token;
          this.events.onPaired(data.token);
        }
        // Receiving welcome always means the most recent hello succeeded — including a retryWithPin()
        // after a "pairing_required" error, which otherwise leaves the status stuck on that value
        // forever even though the connection is now fully working.
        this.events.onStatusChange("connected");
        break;
      }
      case "layout.full": {
        const data = envelope.data as LayoutFullData;
        this.cacheProfile = data.profile;
        await this.ensureAssets(data.profile);
        if (this.destroyed || this.cacheProfile !== data.profile) return;
        this.events.onLayout(resolveAssetRefs(data.profile), data.pageId, data.profile);
        break;
      }
      case "layout.patch": {
        const data = envelope.data as LayoutPatchData;
        const patched = this.cacheProfile ? applyLayoutPatch(this.cacheProfile, data) : null;
        if (!patched) {
          // We missed something and cannot patch safely: reconnecting makes the server send a full layout.
          this.socket?.close();
          return;
        }
        this.cacheProfile = patched.profile;
        await this.ensureAssets(patched.profile);
        if (this.destroyed || this.cacheProfile !== patched.profile) return;
        this.events.onLayoutPatch(resolveAssetRefs(patched.profile), data.pageId, patched.profile, patched.changedWidgetIds);
        break;
      }
      case "page.show": {
        const data = envelope.data as PageShowData;
        this.events.onPageChange(data.pageId);
        break;
      }
      case "widget.state": {
        // A dynamic icon arrives as an asset reference like the ones in a layout.
        const state = envelope.data as WidgetState;
        await this.ensureAssets(state.style);
        this.events.onWidgetState(resolveAssetRefs(state));
        break;
      }
      case "profiles.list": {
        const data = envelope.data as ProfilesListData;
        this.events.onProfiles(data.profiles, data.autoSwitch ?? null);
        break;
      }
      case "error": {
        const data = envelope.data as ErrorData;
        if (data.code === "pairing_required") this.events.onStatusChange("pairing_required");
        else if (data.code === "action_failed") this.events.onActionError(data.message);
        break;
      }
      default:
        break;
    }
  }

  private handleAsset(asset: AssetData): void {
    if (asset.data) putAsset(asset.hash, asset.data);
    const waiters = this.assetWaiters.get(asset.hash);
    this.assetWaiters.delete(asset.hash);
    waiters?.forEach((wake) => wake());
  }

  /** Resolves once every asset the layout references is cached, asking the server for the ones that are not.
   * A hash the server no longer has (or a slow server) only leaves that icon blank; it never blocks the deck. */
  private async ensureAssets(layout: unknown): Promise<void> {
    const missing = missingAssets(layout);
    if (missing.length === 0) return;

    const arrivals = missing.map(
      (hash) =>
        new Promise<void>((resolve) => {
          const list = this.assetWaiters.get(hash) ?? [];
          list.push(resolve);
          this.assetWaiters.set(hash, list);
        }),
    );
    this.send("asset.get", { hashes: missing });
    await Promise.race([Promise.all(arrivals), new Promise<void>((resolve) => setTimeout(resolve, ASSET_WAIT_MS))]);
  }

  /** Requests the server switch this device to a different profile (e.g. from the profile drawer). */
  changeProfile(profileId: string): void {
    this.send("profile.change", { profileId });
  }

  /** Pauses/resumes this device's auto-profile-switch (the drawer's lock) — a no-op server-side if this
   * device doesn't have "Aktif pencereyi takip et" on. */
  setProfileLock(locked: boolean): void {
    this.send("profile.lock", { locked });
  }

  /** Requests the next/previous page on this device's current profile (e.g. a horizontal swipe on the
   * deck). Goes through the same `SessionDeviceController.Next/PreviousPageAsync` as a `core.page`
   * button action server-side — wraparound and the resulting `page.show` + widget state push are
   * identical, the swipe is just another way to trigger it. */
  nextPage(): void {
    this.send("page.next");
  }

  prevPage(): void {
    this.send("page.prev");
  }
}
