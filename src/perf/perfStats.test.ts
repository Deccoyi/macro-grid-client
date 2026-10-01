import { beforeEach, describe, expect, it } from "vitest";
import { loadSettings } from "../storage/settings";
import { perf } from "./perfStats";

describe("perfStats", () => {
  beforeEach(() => perf.reset());

  it("counts and resets", () => {
    perf.count("messages");
    perf.count("messages", 2);
    expect(perf.counters().messages).toBe(3);
    perf.reset();
    expect(perf.counters().messages).toBe(0);
  });

  it("records a start time only the first time", () => {
    expect(perf.starts().firstDraw).toBeNull();
    perf.mark("firstDraw");
    const first = perf.starts().firstDraw;
    expect(first).not.toBeNull();
    perf.mark("firstDraw");
    expect(perf.starts().firstDraw).toBe(first);
  });

  it("times a cache write and keeps its size", () => {
    expect(perf.timeCacheWrite(1234, () => "done")).toBe("done");
    expect(perf.counters().layoutCacheWrites).toBe(1);
    expect(perf.counters().layoutCacheChars).toBe(1234);
  });

  it("is off by default in the settings", () => {
    expect(loadSettings().showPerformance).toBe(false);
  });
});
