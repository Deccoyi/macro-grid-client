import { describe, expect, it } from "vitest";
import { compareVersions, parseTag, parseVersion, versionCore, versionToString, type ReleaseVersion } from "./releaseVersion";

const v = (text: string): ReleaseVersion => {
  const parsed = parseVersion(text);
  if (!parsed) throw new Error(`not a version: ${text}`);
  return parsed;
};

describe("parseVersion", () => {
  it("reads plain, prefixed, labelled and build-metadata versions", () => {
    expect(v("0.3.0")).toEqual({ major: 0, minor: 3, patch: 0, preRelease: null });
    expect(v("v1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, preRelease: null });
    expect(v("0.3.0-alpha.2")).toEqual({ major: 0, minor: 3, patch: 0, preRelease: "alpha.2" });
    expect(versionToString(v("0.3.0+build.5"))).toBe("0.3.0");
  });

  it("refuses anything that is not a version", () => {
    for (const text of ["", "0.3", "a.b.c", "0.3.0-", "0.3.0.1", "latest", " "]) expect(parseVersion(text)).toBeNull();
    expect(parseVersion(null)).toBeNull();
    expect(parseVersion(undefined)).toBeNull();
  });
});

describe("parseTag", () => {
  it("takes the version after the prefix and ignores other tags", () => {
    expect(parseTag("client-v0.2.0", "client-v")).toEqual(v("0.2.0"));
    expect(parseTag("server-v0.2.0", "client-v")).toBeNull();
    expect(parseTag("plugin-sound-v1.0.0", "client-v")).toBeNull();
    expect(parseTag("client-vnext", "client-v")).toBeNull();
    expect(parseTag(null, "client-v")).toBeNull();
  });
});

describe("compareVersions", () => {
  it("orders like the server: 0.1.1 < 0.2.0-alpha < 0.2.0", () => {
    expect(compareVersions(v("0.1.1"), v("0.2.0-alpha"))).toBeLessThan(0);
    expect(compareVersions(v("0.2.0-alpha"), v("0.2.0"))).toBeLessThan(0);
    expect(compareVersions(v("0.2.0"), v("0.2.0"))).toBe(0);
    expect(compareVersions(v("0.10.0"), v("0.9.9"))).toBeGreaterThan(0);
  });

  it("compares labels identifier by identifier, numbers numerically and before text", () => {
    expect(compareVersions(v("1.0.0-alpha"), v("1.0.0-alpha.1"))).toBeLessThan(0);
    expect(compareVersions(v("1.0.0-alpha.2"), v("1.0.0-alpha.10"))).toBeLessThan(0);
    expect(compareVersions(v("1.0.0-1"), v("1.0.0-alpha"))).toBeLessThan(0);
    expect(compareVersions(v("1.0.0-alpha"), v("1.0.0-beta"))).toBeLessThan(0);
  });
});

describe("formatting", () => {
  it("keeps the label for people and drops it for file names", () => {
    expect(versionToString(v("0.3.0-alpha"))).toBe("0.3.0-alpha");
    expect(versionCore(v("0.3.0-alpha"))).toBe("0.3.0");
  });
});
