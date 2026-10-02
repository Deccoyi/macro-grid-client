import type { Profile, WidgetState } from "@macro/renderer";
import { PinnedWebSocket, pinnedSocketAvailable } from "../native/pinnedSocket";
import { collectAssetRefs, loadAssets, missingAssets, putAsset, resolveAssetRefs, touchAssets } from "./assets";
import { perf } from "../perf/perfStats";
import { applyLayoutPatch, type LayoutPatchData } from "./layoutPatch";
import { macroGrid as REQUIRED_MACRO_GRID, version as CLIENT_VERSION } from "../../package.json";
import { checkServerVersion, type ServerCompat } from "./serverCompat";
import { pluginWidgetsSupported } from "../widgets/support";

/**
 * Every frame is { type, data }, matching MacroGrid.Protocol.Envelope server-side. This client
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
  /** Only for `pairing_required`: always one of "wrong_pin" | "locked_out" | "pairing_closed" | "not_paired"
   * (see ClientHub.PairingMessage server-side), a string in case a future server adds a case this build
   * doesn't know yet — the caller falls back to `message` for anything it doesn't recognize. */
  reason?: string;
  /** Only for `reason === "locked_out"`. */
  retryAfterSeconds?: number;
}

/** What a refused pairing attempt looks like once decoded — see ConnectionEvents.onPairingError. */
export interface PairingError {
  reason: string;
  message: string;
  retryAfterSeconds?: number;
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
  /** The server said hello: how its version relates to the Macro Grid version this app needs (`macroGrid` in package.json),
   * so the caller can tell the person to update the computer or the app. Called on every welcome, `ok` included. Optional. */
  onServerVersion?: (compat: ServerCompat, serverVersion: string, required: string) => void;
  /** A pairing attempt was refused — wrong PIN, blocked after too many wrong PINs, or pairing not open on
   * the computer. Not called for the initial "not paired yet" state before any PIN was ever submitted. */
  onPairingError: (error: PairingError) => void;
  /** A message of a plugin widget (`plugin.widget.reply`, `.vars`, `.event`); the widget host reads them. Optional. */
  onPluginWidgetMessage?: (type: string, data: unknown) => void;
  /** An asset arrived. Returns true when the widget host asked for it (a script or image of a plugin widget): it is then not put in the
   * persistent cache, which is for icons. Optional. */
  onAsset?: (hash: string, data: string | null) => boolean;
  /** The server accepted this connection (also after a reconnect): the widget host asks again for what its running widgets need. Optional. */
  onWelcome?: () => void;
}

const MIN_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 10_000;
/** Each reconnect delay is spread by up to this share either way, so phones that lost the server together do not return together. */
const BACKOFF_JITTER = 0.2;
/** A socket that has not opened by now is abandoned; a browser can wait far longer on an unreachable host. */
const OPEN_TIMEOUT_MS = 5_000;
/** An open socket that has not been answered by a welcome (or a pairing request) by now is abandoned. */
const WELCOME_TIMEOUT_MS = 5_000;
/** How long a liveness probe may stay unanswered before the socket is given up as dead. */
const PROBE_TIMEOUT_MS = 2_000;
/** Silence this long on a connected socket is probed (the server's own keep-alive pings are invisible to a page). */
export const IDLE_PROBE_MS = 25_000;
/** After a pause at least this long (screen locked, app in the background) the socket is replaced at once instead of probed. */
export const RESUME_RECONNECT_MS = 3_000;
/** A socket younger than this that has not been welcomed yet is left alone by further resume signals. */
const RESUME_SETTLE_MS = 1_000;
/**
 * The liveness probe: an `asset.get` for a hash nobody has. The server answers every such request with one `asset` message
 * (no data), so any reply proves the connection works without adding a message type to the protocol.
 */
const PROBE_HASH = "0000000000000000";
/** Optional protocol features this client understands — see ClientCapabilities.cs server-side. */
const CAPABILITIES = ["assets", "layout.patch", ...(pluginWidgetsSupported() ? ["plugin-widgets"] : [])];
/** How long a layout waits for the assets it references before it is shown with those icons blank. */
const ASSET_WAIT_MS = 5_000;

/**
 * Owns one WebSocket to the server: sends hello on connect, dispatches incoming envelopes to the
 * caller, and reconnects with exponential backoff on drop (Wi-Fi blip, server restart, etc.) — the
 * one piece of client resilience the plan calls out explicitly (Stage 5).
 */
export class ServerConnection {
  private socket: WebSocket | PinnedWebSocket | null = null;
  private backoffMs = MIN_BACKOFF_MS;
  private presetPinValue: string | null = null;
  /** Counts the sockets opened by this connection. A late event of an earlier socket carries an older number and is ignored. */
  private generation = 0;
  /** True from the server's welcome until the socket ends: only then can a press reach the computer. */
  private welcomed = false;
  /** The server's version fits this app, so it can be expected to answer a probe. */
  private probeable = false;
  /** The server asked for a PIN and the person is typing it: the open socket is fine and must not be replaced under them. */
  private awaitingPin = false;
  private lastInboundAt = 0;
  /** When the current socket was started: a second resume signal right after the first must not replace a socket that is still setting up. */
  private startedAt = 0;
  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private welcomeTimer: ReturnType<typeof setTimeout> | null = null;
  private probeTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setInterval> | null = null;
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
  /** False until a PIN is actually submitted, so the very first automatic hello (sent with no PIN, before
   * the person has done anything) never fires onPairingError — ConnectScreen's own hint already covers that
   * case. Stays true afterward: every pairing_required from here on is a real wrong/blocked/closed attempt. */
  private attemptedPin = false;

  constructor(
    private readonly host: string,
    private readonly deviceId: string,
    private readonly deviceName: string,
    private token: string | null,
    /** Set together, from the pairing QR (see QrScanScreen.tsx) — present only when the server's QR
     * carried a certificate fingerprint, i.e. it offers a TLS listener next to the plain one. */
    private readonly tlsPort: string | null,
    private readonly fingerprint: string | null,
    private readonly events: ConnectionEvents,
  ) {}

  connect(): void {
    this.closedByUser = false;
    this.open();
  }

  disconnect(): void {
    this.closedByUser = true;
    this.destroyed = true;
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = null;
    this.discardSocket();
  }

  /** Sends a message when the connection is working; false means it was dropped (the socket is not open), so the caller must not act as if it went out. */
  send(type: string, data?: unknown): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ type, data } satisfies Envelope));
    return true;
  }

  /**
   * The app came back to the foreground (or the network returned) after `pausedMs`. A live-looking socket may have died while the
   * page was frozen, and the page cannot tell, so a long pause replaces the socket at once and a short one only checks it.
   */
  resumed(pausedMs: number): void {
    if (this.destroyed || this.closedByUser) return;
    if (this.awaitingPin && this.socket !== null) return;
    // An unlock fires several signals together; a socket started after the pause is already the fresh one, and its own timeouts cover it.
    if (this.socket !== null && !this.welcomed && Date.now() - this.startedAt < RESUME_SETTLE_MS) return;
    if (this.socket === null || pausedMs >= RESUME_RECONNECT_MS || !this.welcomed) {
      this.reconnectNow(); // also ends a backoff wait
    } else {
      this.probe();
    }
  }

  /** Retries `hello` on the still-open socket with a PIN the user just typed, after the server asked for one. */
  retryWithPin(pin: string): void {
    this.attemptedPin = true;
    this.sendHello(pin);
  }

  /**
   * A PIN that came with a scanned QR code: it goes into the first hello that really leaves, so pairing does not wait for the server
   * to ask first. It is used once (a wrong PIN must not be repeated by every reconnect, the server counts the attempts).
   */
  presetPin(pin: string): void {
    this.presetPinValue = pin;
  }

  private sendHello(pin?: string): void {
    const preset = pin === undefined ? this.presetPinValue : null;
    if (preset) pin = preset;
    const sent = this.sendHelloMessage(pin);
    if (preset && sent) {
      this.presetPinValue = null;
      this.attemptedPin = true;
    }
  }

  private sendHelloMessage(pin?: string): boolean {
    return this.send("hello", {
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
    this.discardSocket();
    this.events.onStatusChange("connecting");
    // A fingerprint from the pairing QR means the server offered a TLS listener; the WebView's own
    // WebSocket cannot pin a certificate, so that case moves to the native plugin instead. No
    // fingerprint (an older server, or a QR scanned before it offered one) keeps the plain socket.
    const socket: WebSocket | PinnedWebSocket =
      this.tlsPort && this.fingerprint && pinnedSocketAvailable()
        ? new PinnedWebSocket(`wss://${this.host.split(":")[0]}:${this.tlsPort}/ws`, this.fingerprint)
        : new WebSocket(`ws://${this.host}/ws`);
    const gen = ++this.generation;
    const current = () => !this.destroyed && gen === this.generation;
    this.socket = socket;
    this.cacheProfile = null;
    this.awaitingPin = false;
    this.lastInboundAt = this.startedAt = Date.now();
    this.openTimer = setTimeout(() => current() && this.retryAfterFailure(), OPEN_TIMEOUT_MS);

    socket.onopen = () => {
      if (!current()) return;
      if (this.openTimer) clearTimeout(this.openTimer);
      this.openTimer = null;
      this.lastInboundAt = Date.now();
      this.welcomeTimer = setTimeout(() => current() && this.retryAfterFailure(), WELCOME_TIMEOUT_MS);
      // "connected" is reported when the server welcomes this device, not when the socket opens: an open socket that nobody answers is no connection.
      this.sendHello();
    };

    socket.onmessage = (ev: { data: string }) => {
      if (!current()) return;
      perf.count("messages");
      // Any frame, of any kind, proves the connection works.
      this.lastInboundAt = Date.now();
      if (this.probeTimer) clearTimeout(this.probeTimer);
      this.probeTimer = null;
      let envelope: Envelope;
      try {
        envelope = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (this.welcomeTimer && (envelope.type === "welcome" || envelope.type === "error")) {
        clearTimeout(this.welcomeTimer);
        this.welcomeTimer = null;
      }
      // Asset data must not queue behind the very layout that is waiting for it.
      if (envelope.type === "asset") {
        this.handleAsset(envelope.data as AssetData);
        return;
      }
      this.inbox = this.inbox.then(() => (current() ? this.handleMessage(envelope, current) : undefined)).catch(() => {});
    };

    socket.onclose = () => {
      if (!current()) return;
      this.socket = null;
      this.welcomed = false;
      this.clearTimers();
      this.events.onStatusChange("disconnected");
      if (!this.closedByUser) this.scheduleReconnect();
    };

    socket.onerror = () => {
      if (current()) this.retryAfterFailure();
    };
  }

  /** Lets go of the current socket without waiting for it: closing a dead socket can take a long time to report, and its late events are ignored. */
  private discardSocket(): void {
    const socket = this.socket;
    this.socket = null;
    this.welcomed = false;
    this.probeable = false;
    this.generation++;
    this.clearTimers();
    if (!socket) return;
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    try {
      socket.close();
    } catch {
      // Already gone.
    }
  }

  private clearTimers(): void {
    for (const timer of [this.openTimer, this.welcomeTimer, this.probeTimer, this.reconnectTimer]) if (timer) clearTimeout(timer);
    this.openTimer = this.welcomeTimer = this.probeTimer = this.reconnectTimer = null;
  }

  /** The socket failed or stopped answering: drop it and try again after the usual wait. */
  private retryAfterFailure(): void {
    if (this.destroyed) return;
    this.discardSocket();
    this.events.onStatusChange("disconnected");
    if (!this.closedByUser) this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const jitter = 1 + (Math.random() * 2 - 1) * BACKOFF_JITTER;
    this.reconnectTimer = setTimeout(() => this.open(), Math.round(this.backoffMs * jitter));
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
  }

  /** Replaces the socket right now, whatever it looks like, and starts the waits over. */
  private reconnectNow(): void {
    if (this.destroyed) return;
    this.backoffMs = MIN_BACKOFF_MS;
    this.open();
  }

  /** Asks the server for something it always answers; no frame within the timeout means the socket is dead and is replaced. */
  private probe(): void {
    if (!this.welcomed || !this.probeable || this.probeTimer) return;
    if (!this.send("asset.get", { hashes: [PROBE_HASH] })) return this.reconnectNow();
    this.probeTimer = setTimeout(() => {
      this.probeTimer = null;
      this.reconnectNow();
    }, PROBE_TIMEOUT_MS);
  }

  private startIdleWatch(): void {
    if (this.idleTimer) return;
    this.idleTimer = setInterval(() => {
      if (this.welcomed && Date.now() - this.lastInboundAt >= IDLE_PROBE_MS) this.probe();
    }, 5_000);
  }

  private async handleMessage(envelope: Envelope, current: () => boolean): Promise<void> {
    switch (envelope.type) {
      case "welcome": {
        const data = envelope.data as WelcomeData;
        if (data.token) {
          this.token = data.token;
          this.events.onPaired(data.token);
        }
        this.welcomed = true;
        this.awaitingPin = false;
        this.backoffMs = MIN_BACKOFF_MS; // the connection really works now, not merely opened
        this.probeable = checkServerVersion(data.serverVersion, REQUIRED_MACRO_GRID) === "ok";
        this.startIdleWatch();
        // Receiving welcome always means the most recent hello succeeded — including a retryWithPin()
        // after a "pairing_required" error, which otherwise leaves the status stuck on that value
        // forever even though the connection is now fully working.
        this.events.onStatusChange("connected");
        perf.mark("firstWelcome");
        this.events.onWelcome?.();
        this.events.onServerVersion?.(checkServerVersion(data.serverVersion, REQUIRED_MACRO_GRID), data.serverVersion, REQUIRED_MACRO_GRID);
        break;
      }
      case "layout.full": {
        const data = envelope.data as LayoutFullData;
        this.cacheProfile = data.profile;
        await this.ensureAssets(data.profile);
        if (!current() || this.cacheProfile !== data.profile) return;
        perf.mark("firstLayout");
        this.events.onLayout(resolveAssetRefs(data.profile), data.pageId, data.profile);
        break;
      }
      case "layout.patch": {
        const data = envelope.data as LayoutPatchData;
        const patched = this.cacheProfile ? applyLayoutPatch(this.cacheProfile, data) : null;
        if (!patched) {
          // We missed something and cannot patch safely: reconnecting makes the server send a full layout.
          this.reconnectNow();
          return;
        }
        this.cacheProfile = patched.profile;
        await this.ensureAssets(patched.profile);
        if (!current() || this.cacheProfile !== patched.profile) return;
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
        perf.count("widgetStateMessages");
        await this.ensureAssets(state.style);
        if (!current()) return;
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
        if (data.code === "pairing_required") {
          this.awaitingPin = true;
          this.events.onStatusChange("pairing_required");
          if (this.attemptedPin) {
          this.events.onPairingError({ reason: data.reason ?? "wrong_pin", message: data.message, retryAfterSeconds: data.retryAfterSeconds });
        }
        } else if (data.code === "action_failed") this.events.onActionError(data.message);
        break;
      }
      case "plugin.widget.reply":
      case "plugin.widget.vars":
      case "plugin.widget.event":
        this.events.onPluginWidgetMessage?.(envelope.type, envelope.data);
        break;
      default:
        break;
    }
  }

  private handleAsset(asset: AssetData): void {
    if (asset.hash === PROBE_HASH) return; // the liveness probe's answer: proof of life only, nothing for the widgets or the cache
    const forWidget = this.events.onAsset?.(asset.hash, asset.data ?? null) === true;
    if (asset.data && !forWidget) putAsset(asset.hash, asset.data);
    const waiters = this.assetWaiters.get(asset.hash);
    this.assetWaiters.delete(asset.hash);
    waiters?.forEach((wake) => wake());
  }

  /** Resolves once every asset the layout references is cached, asking the server for the ones that are not.
   * A hash the server no longer has (or a slow server) only leaves that icon blank; it never blocks the deck. */
  private async ensureAssets(layout: unknown): Promise<void> {
    touchAssets(collectAssetRefs(layout));
    await loadAssets([...collectAssetRefs(layout)]);
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
   * device doesn't have "Follow the active window" on. */
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
