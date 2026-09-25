import { compareVersions, parseTag, versionCore, type ReleaseVersion } from "./releaseVersion";

/** Release tags of this app start with this ("client-v0.2.0"); the server's and the plugins' tags share the same GitHub account. */
export const TAG_PREFIX = "client-v";

/** The release APK: `MacroGrid-<X.Y.Z>.apk`. A debug or unsigned APK never counts (see docs/release.md). */
const apkNameFor = (version: ReleaseVersion) => `MacroGrid-${versionCore(version)}.apk`;

/** Hosts a download or page address may point at: GitHub itself and the hosts its release downloads redirect to. */
const ALLOWED_HOSTS = ["github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"];

export interface ReleaseAsset {
  name: string;
  url: string;
  size: number;
  /** Lower case hex SHA-256 GitHub reports for the asset. */
  sha256: string;
}

export interface ReleaseInfo {
  version: ReleaseVersion;
  tag: string;
  name: string;
  /** The release notes (Markdown text, shown as plain text). */
  body: string;
  publishedAt: string | null;
  /** The release page, only when it is an allowed address. */
  pageUrl: string | null;
  /** The installable APK; null when the release has none the updater accepts (then only the page link is offered). */
  apk: ReleaseAsset | null;
  isPreRelease: boolean;
}

export interface UpdateOffer {
  /** The newest release strictly newer than the running version. */
  latest: ReleaseInfo;
  /** Every release newer than the running version, newest first (the notes of all of them are shown). */
  releases: ReleaseInfo[];
}

/** Only https on a GitHub host; anything else is refused. */
export function isAllowedUrl(text: unknown): text is string {
  if (typeof text !== "string") return false;
  try {
    const url = new URL(text);
    return url.protocol === "https:" && url.username === "" && ALLOWED_HOSTS.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** GitHub reports "sha256:<hex>"; any other algorithm or a malformed value counts as no digest. */
export function parseDigest(digest: unknown): string | null {
  if (typeof digest !== "string" || !/^sha256:/i.test(digest)) return null;
  const hex = digest.slice("sha256:".length).trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(hex) ? hex : null;
}

/**
 * Keeps the published releases (tag "client-v…", not a draft) whose tag is a version, newest first. Malformed entries are skipped,
 * never thrown on: the feed is data from outside, and one odd entry must not hide the others. Throws only on text that is not JSON.
 */
export function parseReleases(json: string): ReleaseInfo[] {
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) return [];

  const releases: ReleaseInfo[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const entry = item as Record<string, unknown>;
    if (entry.draft === true) continue;
    const tag = typeof entry.tag_name === "string" ? entry.tag_name : null;
    const version = parseTag(tag, TAG_PREFIX);
    if (!tag || !version) continue;

    releases.push({
      version,
      tag,
      name: typeof entry.name === "string" && entry.name ? entry.name : tag,
      body: typeof entry.body === "string" ? entry.body : "",
      publishedAt: typeof entry.published_at === "string" ? entry.published_at : null,
      pageUrl: isAllowedUrl(entry.html_url) ? entry.html_url : null,
      apk: findApk(entry.assets, version),
      isPreRelease: entry.prerelease === true,
    });
  }
  return releases.sort((a, b) => compareVersions(b.version, a.version));
}

function findApk(assets: unknown, version: ReleaseVersion): ReleaseAsset | null {
  if (!Array.isArray(assets)) return null;
  const expected = apkNameFor(version).toLowerCase();
  for (const asset of assets) {
    if (typeof asset !== "object" || asset === null) continue;
    const entry = asset as Record<string, unknown>;
    if (typeof entry.name !== "string" || entry.name.toLowerCase() !== expected) continue;

    const sha256 = parseDigest(entry.digest);
    const size = typeof entry.size === "number" && Number.isSafeInteger(entry.size) && entry.size > 0 ? entry.size : 0;
    // Without an allowed address, a size and a digest the file cannot be checked, so it is not installable.
    if (!isAllowedUrl(entry.browser_download_url) || !sha256 || size === 0) return null;
    return { name: entry.name, url: entry.browser_download_url, size, sha256 };
  }
  return null;
}

/**
 * The update to offer: the newest release strictly newer than `current` (never a downgrade), and every release newer than `current`
 * up to it. Pre-releases count only when `includePreReleases` is on. Null when there is none.
 */
export function findUpdate(releases: ReleaseInfo[], current: ReleaseVersion, includePreReleases: boolean): UpdateOffer | null {
  const newer = releases
    .filter((r) => compareVersions(r.version, current) > 0 && (includePreReleases || (!r.isPreRelease && r.version.preRelease === null)))
    .sort((a, b) => compareVersions(b.version, a.version));
  return newer.length === 0 ? null : { latest: newer[0], releases: newer };
}
