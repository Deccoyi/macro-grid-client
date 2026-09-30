import { describe, expect, it } from "vitest";
import { autoLiveLimits, liveLimitsFor } from "./limits";

describe("live widget limits", () => {
  it("gives a small phone few widgets and a strong device more, never more than 8", () => {
    expect(autoLiveLimits({ cores: 4, memoryGb: 2 })).toEqual({ maxLive: 4, maxLiveUnverified: 2 });
    expect(autoLiveLimits({ cores: 8, memoryGb: 8 })).toEqual({ maxLive: 8, maxLiveUnverified: 4 });
    expect(autoLiveLimits({ cores: 16, memoryGb: 16 }).maxLive).toBe(8);
    expect(autoLiveLimits({ cores: 2, memoryGb: 0.5 })).toEqual({ maxLive: 2, maxLiveUnverified: 1 });
  });

  it("falls back to a modest default when the phone says nothing", () => {
    expect(autoLiveLimits({})).toEqual({ maxLive: 4, maxLiveUnverified: 2 });
  });

  it("uses the person's number for both limits and lifts the limit when asked", () => {
    expect(liveLimitsFor({ pluginWidgetLimit: "custom", pluginWidgetLimitCount: 12 })).toEqual({ maxLive: 12, maxLiveUnverified: 12 });
    expect(liveLimitsFor({ pluginWidgetLimit: "none", pluginWidgetLimitCount: 4 })).toEqual({ maxLive: Infinity, maxLiveUnverified: Infinity });
    expect(liveLimitsFor({ pluginWidgetLimit: "auto", pluginWidgetLimitCount: 4 }, { cores: 8, memoryGb: 8 }).maxLive).toBe(8);
  });
});
