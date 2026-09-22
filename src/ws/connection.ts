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

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface ConnectionEvents {
  onStatusChange: (status: ConnectionStatus) => void;
  onLayout: (profile: Profile, pageId: string) => void;
  onWidgetState: (state: WidgetState) => void;
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

  constructor(
    private readonly host: string,
    private readonly deviceId: string,
    private readonly deviceName: string,
    private readonly events: ConnectionEvents,
  ) {}

  connect(): void {
    this.closedByUser = false;
    this.open();
  }

  disconnect(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }

  send(type: string, data?: unknown): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type, data } satisfies Envelope));
  }

  private open(): void {
    this.events.onStatusChange("connecting");
    const socket = new WebSocket(`ws://${this.host}/ws`);
    this.socket = socket;

    socket.onopen = () => {
      this.backoffMs = 500;
      this.send("hello", {
        deviceId: this.deviceId,
        deviceName: this.deviceName,
        token: null,
        clientVersion: CLIENT_VERSION,
      });
      this.events.onStatusChange("connected");
    };

    socket.onmessage = (ev) => this.handleMessage(ev.data);

    socket.onclose = () => {
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
      case "layout.full": {
        const data = envelope.data as LayoutFullData;
        this.events.onLayout(data.profile, data.pageId);
        break;
      }
      case "widget.state":
        this.events.onWidgetState(envelope.data as WidgetState);
        break;
      default:
        break;
    }
  }
}
