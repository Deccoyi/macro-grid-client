import type { WidgetState } from "@macro/renderer";
import { describe, expect, it, vi } from "vitest";
import { createStateBatcher } from "./stateBatcher";

const state = (widgetId: string, extra: Partial<WidgetState> = {}): WidgetState => ({ widgetId, ...extra }) as WidgetState;

function setup() {
  const frames: (() => void)[] = [];
  const apply = vi.fn();
  const batcher = createStateBatcher(apply, (cb) => frames.push(cb));
  const runFrame = () => frames.splice(0).forEach((cb) => cb());
  return { apply, batcher, frames, runFrame };
}

describe("stateBatcher", () => {
  it("applies ten pushes once, at the frame", () => {
    const { apply, batcher, frames, runFrame } = setup();
    for (let i = 0; i < 10; i++) batcher.push(state(`w${i}`, { text: String(i) }));
    expect(apply).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);

    runFrame();

    expect(apply).toHaveBeenCalledTimes(1);
    expect(Object.keys(apply.mock.calls[0]![0])).toHaveLength(10);
  });

  it("merges two pushes for one widget the way separate updates would", () => {
    const { apply, batcher, runFrame } = setup();
    batcher.push(state("a", { text: "one", active: true }));
    batcher.push(state("a", { text: "two" }));
    runFrame();
    expect(apply.mock.calls[0]![0].a).toMatchObject({ widgetId: "a", text: "two", active: true });
  });

  it("flushNow applies at once and the scheduled frame then does nothing", () => {
    const { apply, batcher, runFrame } = setup();
    batcher.push(state("a", { text: "x" }));
    batcher.flushNow();
    expect(apply).toHaveBeenCalledTimes(1);
    runFrame();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("clear drops everything that is waiting", () => {
    const { apply, batcher, runFrame } = setup();
    batcher.push(state("a", { text: "x" }));
    batcher.clear();
    runFrame();
    expect(apply).not.toHaveBeenCalled();
  });

  it("schedules again for a push after a flush", () => {
    const { apply, batcher, frames, runFrame } = setup();
    batcher.push(state("a", { text: "1" }));
    runFrame();
    batcher.push(state("a", { text: "2" }));
    expect(frames).toHaveLength(1);
    runFrame();
    expect(apply).toHaveBeenCalledTimes(2);
  });
});
