import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_PROBE_MS, RESUME_RECONNECT_MS, ServerConnection, type ConnectionEvents } from "./connection";

class FakeSocket {
  static OPEN = 1;
  static last: FakeSocket;
  static all: FakeSocket[] = [];
  readyState = FakeSocket.OPEN;
  sent: Array<{ type: string; data?: unknown }> = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeSocket.last = this;
    FakeSocket.all.push(this);
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
    onPairingError: vi.fn(),
  };
  const conn = new ServerConnection("10.0.0.2:9820", "dev1", "Phone", "tok", null, null, events);
  conn.connect();
  const socket = FakeSocket.last;
  socket.onopen?.();
  return { events, conn, socket };
}

beforeEach(() => {
  FakeSocket.all = [];
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => vi.unstubAllGlobals());

describe("ServerConnection", () => {
  it("reports how the server version fits what the app needs", async () => {
    const { events, socket } = setup();
    const onServerVersion = vi.fn();
    (events as ConnectionEvents).onServerVersion = onServerVersion;

    socket.receive("welcome", { serverName: "s", serverVersion: "0.3.2" });
    socket.receive("welcome", { serverName: "s", serverVersion: "1.0.0" });
    socket.receive("welcome", { serverName: "s", serverVersion: "2.0.0" });
    await flush();

    expect(onServerVersion.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ["server-too-old", "0.3.2"],
      ["ok", "1.0.0"],
      ["app-too-old", "2.0.0"],
    ]);
  });

  it("connects to /ws and sends hello with the stored token", () => {
    const { events, socket } = setup();
    expect(socket.url).toBe("ws://10.0.0.2:9820/ws");
    const hello = socket.sent[0]!;
    expect(hello.type).toBe("hello");
    expect(hello.data).toMatchObject({ deviceId: "dev1", deviceName: "Phone", token: "tok", capabilities: ["assets", "layout.patch"] });
    expect(events.onStatusChange).toHaveBeenLastCalledWith("connecting"); // connected only after the server's welcome
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

  describe("keeping the connection alive", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const welcome = async (socket: FakeSocket) => {
      socket.receive("welcome", { serverName: "s", serverVersion: "1.0.0" });
      await vi.advanceTimersByTimeAsync(0);
    };
    const probes = (socket: FakeSocket) => socket.sent.filter((m) => m.type === "asset.get");

    it("reports connected only after the welcome", async () => {
      const { events, socket } = setup();
      expect(events.onStatusChange).not.toHaveBeenCalledWith("connected");
      await welcome(socket);
      expect(events.onStatusChange).toHaveBeenLastCalledWith("connected");
    });

    it("gives up on a socket that never opens or is never welcomed, and tries again", async () => {
      const events = setup().events;
      const first = FakeSocket.all[0]!;
      await vi.advanceTimersByTimeAsync(5_000); // welcome never came
      expect(first.closed).toBe(true);
      expect(events.onStatusChange).toHaveBeenLastCalledWith("disconnected");
      await vi.advanceTimersByTimeAsync(1_000);
      expect(FakeSocket.all.length).toBe(2);
    });

    it("replaces a half-open socket that does not answer a probe, and does nothing when it answers", async () => {
      const { conn, socket } = setup();
      await welcome(socket);

      conn.resumed(1_000);
      expect(probes(socket)).toHaveLength(1);
      socket.receive("asset", { hash: "0000000000000000", data: null });
      await vi.advanceTimersByTimeAsync(3_000);
      expect(FakeSocket.all).toHaveLength(1);

      conn.resumed(1_000);
      await vi.advanceTimersByTimeAsync(2_000); // no reply
      expect(FakeSocket.all).toHaveLength(2);
      expect(socket.closed).toBe(true);
    });

    it("replaces the socket at once after a long pause, without probing", async () => {
      const { conn, socket } = setup();
      await welcome(socket);

      conn.resumed(RESUME_RECONNECT_MS);

      expect(probes(socket)).toHaveLength(0);
      expect(FakeSocket.all).toHaveLength(2);
    });

    it("opens one socket, not two, for resume signals that arrive together", async () => {
      const { conn, socket } = setup();
      await welcome(socket);

      conn.resumed(10_000);
      vi.advanceTimersByTime(50);
      conn.resumed(10_000);

      expect(FakeSocket.all).toHaveLength(2);
    });

    it("does not pass the probe's answer on to the widgets", async () => {
      const onAsset = vi.fn(() => false);
      const { events, socket } = setup();
      events.onAsset = onAsset;
      await welcome(socket);

      socket.receive("asset", { hash: "0000000000000000" });
      await vi.advanceTimersByTimeAsync(0);

      expect(onAsset).not.toHaveBeenCalled();
    });

    it("probes after a long silence while connected", async () => {
      const { socket } = setup();
      await welcome(socket);

      await vi.advanceTimersByTimeAsync(IDLE_PROBE_MS + 5_000);

      expect(probes(socket)).toHaveLength(1);
    });

    it("ignores a late message of a replaced socket", async () => {
      const { conn, events, socket: old } = setup();
      await welcome(old);
      conn.resumed(RESUME_RECONNECT_MS);
      const fresh = FakeSocket.last;

      old.onmessage?.({ data: JSON.stringify({ type: "layout.full", data: { profile: { pages: [] }, pageId: "p" } }) });
      await vi.advanceTimersByTimeAsync(10);

      expect(events.onLayout).not.toHaveBeenCalled();
      expect(fresh).not.toBe(old);
    });

    it("send reports whether the message went out", async () => {
      const { conn, socket } = setup();
      await welcome(socket);
      expect(conn.send("widget.down", {})).toBe(true);
      conn.resumed(RESUME_RECONNECT_MS);
      FakeSocket.last.readyState = 0;
      expect(conn.send("widget.down", {})).toBe(false);
    });
  });
});
