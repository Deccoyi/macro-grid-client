import type { Profile, WidgetState } from "@macro/renderer";

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

interface ProfilesListData {
  profiles: ProfileSummary[];
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "pairing_required";

export interface ConnectionEvents {
  onStatusChange: (status: ConnectionStatus) => void;
  onLayout: (profile: Profile, pageId: string) => void;
  /** Server pushed a page change for a `core.page` action (goto/next/prev/back) fired from any device
   * on this profile — the button that triggered it doesn't get a special-cased response, everyone
   * showing this profile just gets told which page to show now. */
  onPageChange: (pageId: string) => void;
  onWidgetState: (state: WidgetState) => void;
  onProfiles: (profiles: ProfileSummary[]) => void;
  /** A brand-new token was issued (first pairing, or a re-pair) — the caller must persist it: it
   * replaces the PIN on every future connection attempt. */
  onPaired: (token: string) => void;
  /** A widget's action failed server-side (e.g. a button pointed at a since-deleted OBS scene) —
   * surfaced as a toast so a stale binding is never a silent no-op on the device that pressed it. */
  onActionError: (message: string) => void;
}

const CLIENT_VERSION = "0.1.0";
const MAX_BACKOFF_MS = 10_000;

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
      this.handleMessage(ev.data);
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

  private handleMessage(raw: string): void {
    let envelope: Envelope;
    try {
      envelope = JSON.parse(raw);
    } catch {
      return;
    }

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
        this.events.onLayout(data.profile, data.pageId);
        break;
      }
      case "page.show": {
        const data = envelope.data as PageShowData;
        this.events.onPageChange(data.pageId);
        break;
      }
      case "widget.state":
        this.events.onWidgetState(envelope.data as WidgetState);
        break;
      case "profiles.list":
        this.events.onProfiles((envelope.data as ProfilesListData).profiles);
        break;
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

  /** Requests the server switch this device to a different profile (e.g. from the profile drawer). */
  changeProfile(profileId: string): void {
    this.send("profile.change", { profileId });
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
