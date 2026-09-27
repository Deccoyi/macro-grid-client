import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

interface OpenEvent {
  id: string;
}

interface MessageEvent {
  id: string;
  data: string;
}

interface CloseEvent {
  id: string;
  code: number;
  reason: string;
}

interface ErrorEvent {
  id: string;
  message: string;
}

interface PinnedSocketPlugin {
  connect(opts: { id: string; url: string; fingerprint: string }): Promise<void>;
  send(opts: { id: string; text: string }): Promise<void>;
  close(opts: { id: string; code: number; reason: string }): Promise<void>;
  addListener(event: "open", listener: (ev: OpenEvent) => void): Promise<PluginListenerHandle>;
  addListener(event: "message", listener: (ev: MessageEvent) => void): Promise<PluginListenerHandle>;
  addListener(event: "close", listener: (ev: CloseEvent) => void): Promise<PluginListenerHandle>;
  addListener(event: "error", listener: (ev: ErrorEvent) => void): Promise<PluginListenerHandle>;
}

const Native = registerPlugin<PinnedSocketPlugin>("PinnedSocket");

/** Only the Android app has the plugin; the browser deck keeps using the WebView's/browser's own WebSocket. */
export const pinnedSocketAvailable = (): boolean => Capacitor.isNativePlatform();

let nextId = 0;
function newConnectionId(): string {
  nextId += 1;
  return `${Date.now().toString(36)}-${nextId}`;
}

/**
 * A `WebSocket`-shaped wrapper around the native `PinnedSocket` plugin (see PinnedSocketPlugin.java),
 * so {@link ServerConnection} in ../ws/connection.ts can use it exactly like the browser's own
 * `WebSocket` when a server's certificate must be pinned — the WebView's WebSocket has no way to do
 * that itself. Every instance gets its own id; events carrying a different id (a previous, already
 * superseded connection) are ignored, the same trick `ServerConnection` itself uses with `destroyed`.
 */
export class PinnedWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState: number = PinnedWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  private readonly id = newConnectionId();
  private readonly listeners: Promise<PluginListenerHandle>[] = [];
  private stopped = false;

  constructor(url: string, fingerprint: string) {
    this.listeners.push(
      Native.addListener("open", (ev) => {
        if (this.stopped || ev.id !== this.id) return;
        this.readyState = PinnedWebSocket.OPEN;
        this.onopen?.();
      }),
      Native.addListener("message", (ev) => {
        if (this.stopped || ev.id !== this.id) return;
        this.onmessage?.({ data: ev.data });
      }),
      Native.addListener("close", (ev) => {
        if (this.stopped || ev.id !== this.id) return;
        this.readyState = PinnedWebSocket.CLOSED;
        this.onclose?.();
      }),
      Native.addListener("error", (ev) => {
        if (this.stopped || ev.id !== this.id) return;
        this.onerror?.();
      }),
    );

    Native.connect({ id: this.id, url, fingerprint }).catch(() => {
      if (this.stopped) return;
      this.readyState = PinnedWebSocket.CLOSED;
      this.onerror?.();
      this.onclose?.();
    });
  }

  send(data: string): void {
    if (this.readyState !== PinnedWebSocket.OPEN) return;
    Native.send({ id: this.id, text: data }).catch(() => {});
  }

  close(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.readyState = PinnedWebSocket.CLOSING;
    Native.close({ id: this.id, code: 1000, reason: "" }).catch(() => {});
    this.listeners.forEach((pending) => pending.then((handle) => handle.remove()).catch(() => {}));
  }
}
