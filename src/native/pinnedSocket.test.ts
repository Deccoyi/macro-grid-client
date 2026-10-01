import { beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (ev: { id: string }) => void;
const { listeners, connect } = vi.hoisted(() => ({
  listeners: new Map<string, Array<(ev: { id: string }) => void>>(),
  connect: vi.fn(() => Promise.resolve()),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({
    connect,
    send: () => Promise.resolve(),
    close: () => Promise.resolve(),
    addListener: (event: string, listener: Listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      return Promise.resolve({ remove: () => Promise.resolve() });
    },
  }),
}));

import { PinnedWebSocket } from "./pinnedSocket";

const emit = (event: string, id: string) => listeners.get(event)?.forEach((l) => l({ id }));

describe("PinnedWebSocket", () => {
  beforeEach(() => {
    listeners.clear();
    connect.mockClear();
  });

  it("still reports the close when the owner closes it from onerror (native side sends error, then close)", async () => {
    const socket = new PinnedWebSocket("wss://host:9821/ws", "fp");
    const id = (connect.mock.calls[0] as unknown as [{ id: string }])[0].id;
    const onclose = vi.fn();
    socket.onclose = onclose;
    socket.onerror = () => socket.close();

    emit("error", id);
    emit("close", id);
    await Promise.resolve();

    expect(onclose).toHaveBeenCalledTimes(1);
  });
});
