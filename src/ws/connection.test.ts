import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServerConnection, type ConnectionEvents } from "./connection";

class FakeSocket {
  static OPEN = 1;
  static last: FakeSocket;
  readyState = FakeSocket.OPEN;
  sent: Array<{ type: string; data?: unknown }> = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeSocket.last = this;
  }
  send(text: string) {
    this.sent.push(JSON.parse(text));
  }
  close() {
    this.closed = true;
  }
  receive(type: string, data?: unknown) {
    this.onmessage?.({ data: JSON.stringify({ type, data }) });
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const events: ConnectionEvents = {
    onStatusChange: vi.fn(),
    onLayout: vi.fn(),
    onLayoutPatch: vi.fn(),
    onPageChange: vi.fn(),
    onWidgetState: vi.fn(),
    onProfiles: vi.fn(),
    onPaired: vi.fn(),
    onActionError: vi.fn(),
  };
  const conn = new ServerConnection("10.0.0.2:9820", "dev1", "Phone", "tok", events);
  conn.connect();
  const socket = FakeSocket.last;
  socket.onopen?.();
  return { events, conn, socket };
}

beforeEach(() => vi.stubGlobal("WebSocket", FakeSocket));
afterEach(() => vi.unstubAllGlobals());

describe("ServerConnection", () => {
  it("connects to /ws and sends hello with the stored token", () => {
    const { events, socket } = setup();
    expect(socket.url).toBe("ws://10.0.0.2:9820/ws");
    const hello = socket.sent[0]!;
    expect(hello.type).toBe("hello");
    expect(hello.data).toMatchObject({ deviceId: "dev1", deviceName: "Phone", token: "tok", capabilities: ["assets", "layout.patch"] });
    expect(events.onStatusChange).toHaveBeenLastCalledWith("connected");
  });

  it("stores a newly issued token on welcome", async () => {
    const { events, socket } = setup();
    socket.receive("welcome", { serverName: "s", serverVersion: "1", token: "new" });
    await flush();
    expect(events.onPaired).toHaveBeenCalledWith("new");
  });

  it("dispatches a full layout with the compact profile for caching", async () => {
    const { events, socket } = setup();
    const profile = { id: "p", name: "P", pages: [] };
    socket.receive("layout.full", { profile, pageId: "a" });
    await flush();
    expect(events.onLayout).toHaveBeenCalledWith(profile, "a", profile);
  });

  it("dispatches page, state, profiles and error messages", async () => {
    const { events, socket } = setup();
    socket.receive("page.show", { pageId: "b" });
    socket.receive("widget.state", { widgetId: "w", text: "x" });
    socket.receive("profiles.list", { profiles: [{ id: "p", name: "P" }] });
    socket.receive("error", { code: "action_failed", message: "boom" });
    socket.receive("error", { code: "pairing_required", message: "" });
    await flush();
    expect(events.onPageChange).toHaveBeenCalledWith("b");
    expect(events.onWidgetState).toHaveBeenCalledWith({ widgetId: "w", text: "x" });
    expect(events.onProfiles).toHaveBeenCalledWith([{ id: "p", name: "P" }], null);
    expect(events.onActionError).toHaveBeenCalledWith("boom");
    expect(events.onStatusChange).toHaveBeenLastCalledWith("pairing_required");
  });

  it("ignores malformed frames and unknown types", async () => {
    const { events, socket } = setup();
    socket.onmessage?.({ data: "not json" });
    socket.receive("mystery", {});
    await flush();
    expect(events.onLayout).not.toHaveBeenCalled();
  });

  it("closes the socket when a patch cannot be applied", async () => {
    const { socket } = setup();
    socket.receive("layout.patch", { profileId: "p", pageId: "a", pageOrder: [], pages: [] });
    await flush();
    expect(socket.closed).toBe(true);
  });

  it("sends command messages", () => {
    const { conn, socket } = setup();
    conn.changeProfile("p2");
    conn.setProfileLock(true);
    conn.nextPage();
    conn.prevPage();
    conn.retryWithPin("123456");
    expect(socket.sent.slice(1).map((m) => [m.type, m.data])).toEqual([
      ["profile.change", { profileId: "p2" }],
      ["profile.lock", { locked: true }],
      ["page.next", undefined],
      ["page.prev", undefined],
      ["hello", expect.objectContaining({ pin: "123456" })],
    ]);
  });

  it("stops reporting after disconnect", async () => {
    const { conn, events, socket } = setup();
    conn.disconnect();
    socket.onclose?.();
    socket.receive("page.show", { pageId: "b" });
    await flush();
    expect(events.onPageChange).not.toHaveBeenCalled();
    expect(events.onStatusChange).not.toHaveBeenLastCalledWith("disconnected");
  });
});
