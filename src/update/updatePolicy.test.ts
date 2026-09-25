import { beforeEach, describe, expect, it } from "vitest";
import type { ReleaseInfo, UpdateOffer } from "./releaseFeed";
import { parseVersion, type ReleaseVersion } from "./releaseVersion";
import {
  CHECK_INTERVAL_MS,
  SNOOZE_MS,
  afterAnnounced,
  afterLater,
  afterSkip,
  isCheckDue,
  shouldOpenByItself,
  updatedTo,
  versionToKeep,
} from "./updatePolicy";
import { EMPTY_UPDATE_STATE, loadUpdateState, saveUpdateState, type UpdateState } from "./updateState";

const version = (text: string): ReleaseVersion => parseVersion(text)!;
const offerFor = (text: string, withApk = true): UpdateOffer => {
  const latest: ReleaseInfo = {
    version: version(text),
    tag: `client-v${text}`,
    name: text,
    body: "",
    publishedAt: null,
    pageUrl: null,
    apk: withApk ? { name: `MacroGrid-${text}.apk`, url: "https://github.com/x", size: 1, sha256: "a".repeat(64) } : null,
    isPreRelease: true,
  };
  return { latest, releases: [latest] };
};

const NOW = 1_000_000_000_000;
const cold = { autoCheckEnabled: true, coldStart: true, now: NOW };
const state = (changes: Partial<UpdateState> = {}): UpdateState => ({ ...EMPTY_UPDATE_STATE, ...changes });

describe("isCheckDue", () => {
  it("checks when never checked, after the interval, or when the clock went backwards", () => {
    expect(isCheckDue(state(), NOW)).toBe(true);
    expect(isCheckDue(state({ lastCheckAt: NOW - CHECK_INTERVAL_MS }), NOW)).toBe(true);
    expect(isCheckDue(state({ lastCheckAt: NOW - CHECK_INTERVAL_MS + 1 }), NOW)).toBe(false);
    expect(isCheckDue(state({ lastCheckAt: NOW + 1000 }), NOW)).toBe(true);
  });
});

describe("shouldOpenByItself", () => {
  it("opens at a cold start for a new version", () => {
    expect(shouldOpenByItself(offerFor("0.2.0"), state(), cold)).toBe(true);
  });

  it("never opens without an offer, with the automatic check off, or while the deck is in use (not a cold start)", () => {
    expect(shouldOpenByItself(null, state(), cold)).toBe(false);
    expect(shouldOpenByItself(offerFor("0.2.0"), state(), { ...cold, autoCheckEnabled: false })).toBe(false);
    expect(shouldOpenByItself(offerFor("0.2.0"), state(), { ...cold, coldStart: false })).toBe(false);
  });

  it("opens only once per version", () => {
    const offer = offerFor("0.2.0");
    const announced = afterAnnounced(state(), offer);
    expect(shouldOpenByItself(offer, announced, cold)).toBe(false);
    expect(shouldOpenByItself(offerFor("0.3.0"), announced, cold)).toBe(true);
  });

  it("stays quiet for a day after Later, then opens again", () => {
    const offer = offerFor("0.2.0");
    const snoozed = afterLater(state(), NOW);
    expect(shouldOpenByItself(offer, snoozed, { ...cold, now: NOW + SNOOZE_MS - 1 })).toBe(false);
    expect(shouldOpenByItself(offer, snoozed, { ...cold, now: NOW + SNOOZE_MS })).toBe(true);
  });

  it("never opens for exactly the skipped version, but does for a newer one", () => {
    const skipped = afterSkip(state(), offerFor("0.2.0"));
    expect(shouldOpenByItself(offerFor("0.2.0"), skipped, cold)).toBe(false);
    expect(shouldOpenByItself(offerFor("0.2.1"), skipped, cold)).toBe(true);
  });
});

describe("updatedTo", () => {
  it("says the new version once after an update, never on a first run, the same version or a downgrade", () => {
    expect(updatedTo(state({ lastRunVersion: "0.1.1" }), version("0.2.0"))).toBe("0.2.0");
    expect(updatedTo(state(), version("0.2.0"))).toBeNull();
    expect(updatedTo(state({ lastRunVersion: "0.2.0" }), version("0.2.0"))).toBeNull();
    expect(updatedTo(state({ lastRunVersion: "0.3.0" }), version("0.2.0"))).toBeNull();
    expect(updatedTo(state({ lastRunVersion: "garbage" }), version("0.2.0"))).toBeNull();
  });
});

describe("versionToKeep", () => {
  it("keeps the offered version's download only when the release has an installable APK", () => {
    expect(versionToKeep(offerFor("0.2.0"))).toBe("0.2.0");
    expect(versionToKeep(offerFor("0.2.0", false))).toBeNull();
    expect(versionToKeep(null)).toBeNull();
  });
});

describe("update state storage", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips and falls back to the empty state for missing or corrupt data", () => {
    expect(loadUpdateState()).toEqual(EMPTY_UPDATE_STATE);
    saveUpdateState(state({ etag: 'W/"x"', skippedVersion: "0.2.0", lastCheckAt: 5 }));
    expect(loadUpdateState()).toMatchObject({ etag: 'W/"x"', skippedVersion: "0.2.0", lastCheckAt: 5 });
    localStorage.setItem("macro-grid.update", "{bad");
    expect(loadUpdateState()).toEqual(EMPTY_UPDATE_STATE);
  });

  it("ignores fields of the wrong type", () => {
    localStorage.setItem("macro-grid.update", JSON.stringify({ etag: 5, lastCheckAt: "yesterday", skippedVersion: ["0.2.0"] }));
    expect(loadUpdateState()).toEqual(EMPTY_UPDATE_STATE);
  });
});
