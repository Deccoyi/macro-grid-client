import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionEvents } from "../ws/connection";

const created: Array<{ events: ConnectionEvents }> = [];

vi.mock("../ws/connection", async (importOriginal) => {
  const original = await importOriginal<typeof import("../ws/connection")>();
  class FakeConnection {
    constructor(_host: string, _id: string, _name: string, _token: string | null, _tls: string | null, _fp: string | null, public events: ConnectionEvents) {
      created.push(this);
    }
    connect() {
      this.events.onStatusChange("connecting");
    }
    disconnect() {}
    resumed() {}
    send() {
      return true;
    }
  }
  return { ...original, ServerConnection: FakeConnection };
});

import { useServerConnection } from "./useServerConnection";

describe("useServerConnection", () => {
  beforeEach(() => {
    created.length = 0;
    localStorage.clear();
  });

  it("drops the live looks of the widgets as soon as the link is no longer connected", async () => {
    const { result } = renderHook(() => useServerConnection());
    act(() => result.current.connect("10.0.0.2:9820"));
    const events = created[0]!.events;

    act(() => {
      events.onStatusChange("connected");
      events.onLayout({ id: "p", name: "P", pages: [{ id: "a", name: "A", widgets: [] }] } as never, "a", {} as never);
      events.onWidgetState({ widgetId: "w", style: { background: "orange" } } as never);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.states.w).toBeDefined();

    act(() => events.onStatusChange("connecting")); // the socket was replaced after an unlock
    expect(result.current.states).toEqual({});
  });
});
