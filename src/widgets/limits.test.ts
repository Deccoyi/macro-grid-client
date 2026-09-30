import { describe, expect, it } from "vitest";
import { autoLiveLimits, autoWebLimit, liveLimitsFor, webLimitFor } from "./limits";

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

  it("counts the limit for a plugin that is not verified per plugin, so a number the person chose applies to each", () => {
    expect(liveLimitsFor({ pluginWidgetLimit: "custom", pluginWidgetLimitCount: 3 }).maxLiveUnverified).toBe(3);
  });

  it("uses the person's number for both limits and lifts the limit when asked", () => {
    expect(liveLimitsFor({ pluginWidgetLimit: "custom", pluginWidgetLimitCount: 12 })).toEqual({ maxLive: 12, maxLiveUnverified: 12 });
    expect(liveLimitsFor({ pluginWidgetLimit: "none", pluginWidgetLimitCount: 4 })).toEqual({ maxLive: Infinity, maxLiveUnverified: Infinity });
    expect(liveLimitsFor({ pluginWidgetLimit: "auto", pluginWidgetLimitCount: 4 }, { cores: 8, memoryGb: 8 }).maxLive).toBe(8);
  });

  it("recommends 1 web widget on a small phone, up to 3 on a strong one", () => {
    expect(autoWebLimit({ cores: 8, memoryGb: 2 })).toBe(1);
    expect(autoWebLimit({ cores: 4, memoryGb: 8 })).toBe(1);
    expect(autoWebLimit({ cores: 8, memoryGb: 4 })).toBe(2);
    expect(autoWebLimit({ cores: 8, memoryGb: 8 })).toBe(3);
    expect(autoWebLimit({})).toBe(1);
  });

  it("uses the person's web widget number or lifts the limit", () => {
    expect(webLimitFor({ webWidgetLimit: "custom", webWidgetLimitCount: 5 })).toBe(5);
    expect(webLimitFor({ webWidgetLimit: "none", webWidgetLimitCount: 5 })).toBe(Infinity);
    expect(webLimitFor({ webWidgetLimit: "auto", webWidgetLimitCount: 5 }, { cores: 8, memoryGb: 8 })).toBe(3);
  });
});
