import { describe, expect, it } from "vitest";
import { findUpdate, isAllowedUrl, parseDigest, parseReleases } from "./releaseFeed";
import { parseVersion, type ReleaseVersion } from "./releaseVersion";

const HEX = "844f516f89149cacc58ef28e05d1a1407b5d05fc7d3f328d95c342b076ff0aec";
const version = (text: string): ReleaseVersion => parseVersion(text)!;

function release(overrides: Record<string, unknown> = {}) {
  return {
    tag_name: "client-v0.2.0",
    name: "Macro Grid client 0.2.0 (alpha)",
    body: "### New\n- Something",
    draft: false,
    prerelease: true,
    published_at: "2026-09-30T10:00:00Z",
    html_url: "https://github.com/Deccoyi/macro-grid-client/releases/tag/client-v0.2.0",
    assets: [
      {
        name: "MacroGrid-0.2.0.apk",
        size: 27_000_000,
        digest: `sha256:${HEX}`,
        browser_download_url: "https://github.com/Deccoyi/macro-grid-client/releases/download/client-v0.2.0/MacroGrid-0.2.0.apk",
      },
    ],
    ...overrides,
  };
}

const parse = (...items: unknown[]) => parseReleases(JSON.stringify(items));

describe("parseReleases", () => {
  it("reads a published client release with its installable APK", () => {
    const [info] = parse(release());
    expect(info.tag).toBe("client-v0.2.0");
    expect(info.isPreRelease).toBe(true);
    expect(info.body).toContain("Something");
    expect(info.apk).toEqual({
      name: "MacroGrid-0.2.0.apk",
      url: "https://github.com/Deccoyi/macro-grid-client/releases/download/client-v0.2.0/MacroGrid-0.2.0.apk",
      size: 27_000_000,
      sha256: HEX,
    });
  });

  it("skips drafts, other tags and malformed entries without hiding the rest", () => {
    const list = parse(
      release({ tag_name: "client-v0.3.0", draft: true }),
      release({ tag_name: "server-v0.9.0" }),
      release({ tag_name: "client-vlatest" }),
      null,
      "text",
      release({ tag_name: "client-v0.2.0" }),
    );
    expect(list.map((r) => r.tag)).toEqual(["client-v0.2.0"]);
  });

  it("sorts newest first, a release before its own pre-release label", () => {
    const list = parse(release({ tag_name: "client-v0.2.0-alpha" }), release({ tag_name: "client-v0.10.0" }), release({ tag_name: "client-v0.2.0" }));
    expect(list.map((r) => r.tag)).toEqual(["client-v0.10.0", "client-v0.2.0", "client-v0.2.0-alpha"]);
  });

  it("offers no install for a debug or unsigned APK, a missing digest, size or bad address", () => {
    const asset = (changes: Record<string, unknown>) => ({ ...release().assets[0], ...changes });
    const apkOf = (asset0: unknown) => parse(release({ assets: [asset0] }))[0].apk;
    expect(apkOf(asset({ name: "MacroGrid-0.2.0-debug.apk" }))).toBeNull();
    expect(apkOf(asset({ name: "MacroGrid-0.2.0-unsigned.apk" }))).toBeNull();
    expect(apkOf(asset({ name: "MacroGrid-0.2.1.apk" }))).toBeNull(); // not this release's version
    expect(apkOf(asset({ digest: null }))).toBeNull();
    expect(apkOf(asset({ digest: "md5:abcd" }))).toBeNull();
    expect(apkOf(asset({ size: 0 }))).toBeNull();
    expect(apkOf(asset({ browser_download_url: "https://example.com/MacroGrid-0.2.0.apk" }))).toBeNull();
    expect(apkOf(asset({ browser_download_url: "http://github.com/x/MacroGrid-0.2.0.apk" }))).toBeNull();
    expect(parse(release({ assets: [] }))[0].apk).toBeNull();
    expect(parse(release({ assets: undefined }))[0].apk).toBeNull();
  });

  it("keeps only an allowed release page address", () => {
    expect(parse(release({ html_url: "https://example.com/x" }))[0].pageUrl).toBeNull();
    expect(parse(release())[0].pageUrl).toContain("github.com");
  });

  it("accepts a JSON list that is not a list as no releases, and throws only on text that is not JSON", () => {
    expect(parseReleases("{}")).toEqual([]);
    expect(() => parseReleases("not json")).toThrow();
  });
});

describe("findUpdate", () => {
  const releases = parse(release({ tag_name: "client-v0.3.0", prerelease: false }), release({ tag_name: "client-v0.2.0" }), release({ tag_name: "client-v0.1.1" }));

  it("offers the newest release and every release between, newest first", () => {
    const offer = findUpdate(releases, version("0.1.1"), true)!;
    expect(offer.latest.tag).toBe("client-v0.3.0");
    expect(offer.releases.map((r) => r.tag)).toEqual(["client-v0.3.0", "client-v0.2.0"]);
  });

  it("never offers the running version or an older one", () => {
    expect(findUpdate(releases, version("0.3.0"), true)).toBeNull();
    expect(findUpdate(releases, version("0.4.0"), true)).toBeNull();
  });

  it("leaves out pre-releases when they are not wanted, by GitHub's flag or by a label", () => {
    const offer = findUpdate(releases, version("0.1.1"), false)!;
    expect(offer.releases.map((r) => r.tag)).toEqual(["client-v0.3.0"]);
    const labelled = parse(release({ tag_name: "client-v0.4.0-alpha", prerelease: false }));
    expect(findUpdate(labelled, version("0.1.1"), false)).toBeNull();
    expect(findUpdate(labelled, version("0.1.1"), true)).not.toBeNull();
  });

  it("orders a label below the release: 0.2.0-alpha is newer than 0.1.1 but not than 0.2.0", () => {
    const list = parse(release({ tag_name: "client-v0.2.0-alpha" }));
    expect(findUpdate(list, version("0.1.1"), true)).not.toBeNull();
    expect(findUpdate(list, version("0.2.0"), true)).toBeNull();
  });
});

describe("isAllowedUrl", () => {
  it("allows https on GitHub's hosts only", () => {
    expect(isAllowedUrl("https://github.com/a")).toBe(true);
    expect(isAllowedUrl("https://objects.githubusercontent.com/a")).toBe(true);
    expect(isAllowedUrl("https://release-assets.githubusercontent.com/a")).toBe(true);
    for (const url of ["http://github.com/a", "https://github.com.evil.example/a", "https://user@github.com/a", "file:///a", "github.com/a", "", 5, null]) {
      expect(isAllowedUrl(url)).toBe(false);
    }
  });
});

describe("parseDigest", () => {
  it("accepts a 64 digit sha256 only", () => {
    expect(parseDigest(`sha256:${HEX}`)).toBe(HEX);
    expect(parseDigest(`SHA256:${HEX.toUpperCase()}`)).toBe(HEX);
    expect(parseDigest("sha256:abc")).toBeNull();
    expect(parseDigest(`sha1:${HEX}`)).toBeNull();
    expect(parseDigest(undefined)).toBeNull();
  });
});
