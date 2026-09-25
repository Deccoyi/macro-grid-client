/**
 * A version with the SemVer pre-release label, so `0.1.1 < 0.2.0-alpha < 0.2.0`. The same rules as the server's `ReleaseVersion`
 * (docs/plans/phone-app-auto-update-plan.md), ported and not shared because the server is C#. Build metadata after `+` is accepted
 * and ignored. Client tags are plain `X.Y.Z` today; the label is parsed anyway so a later change of the tag scheme does not
 * break apps that are already installed.
 */
export interface ReleaseVersion {
  major: number;
  minor: number;
  patch: number;
  preRelease: string | null;
}

const PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/;

/** Parses "0.3.0", "v0.3.0" or "0.3.0-alpha.2"; null for anything else. */
export function parseVersion(text: string | null | undefined): ReleaseVersion | null {
  if (!text) return null;
  const match = PATTERN.exec(text.trim());
  if (!match) return null;
  const [major, minor, patch] = [match[1], match[2], match[3]].map(Number);
  if (![major, minor, patch].every(Number.isSafeInteger)) return null;
  return { major, minor, patch, preRelease: match[4] ?? null };
}

/** Parses a release tag such as "client-v0.2.0" after removing `prefix`. Other tags do not parse. */
export function parseTag(tag: string | null | undefined, prefix: string): ReleaseVersion | null {
  if (!tag || !tag.startsWith(prefix)) return null;
  return parseVersion(tag.slice(prefix.length));
}

/** "0.3.0-alpha": what the person sees. */
export function versionToString(v: ReleaseVersion): string {
  return v.preRelease === null ? versionCore(v) : `${versionCore(v)}-${v.preRelease}`;
}

/** "0.3.0": the part file names use (no label). */
export function versionCore(v: ReleaseVersion): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

export function compareVersions(a: ReleaseVersion, b: ReleaseVersion): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return comparePreRelease(a.preRelease, b.preRelease);
}

/** A release outranks any pre-release of the same numbers; labels compare identifier by identifier (numbers numerically, before text). */
function comparePreRelease(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  const left = a.split(".");
  const right = b.split(".");
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const leftIsNumber = /^\d+$/.test(left[i]);
    const rightIsNumber = /^\d+$/.test(right[i]);
    let result: number;
    if (leftIsNumber && rightIsNumber) result = Number(left[i]) - Number(right[i]);
    else if (leftIsNumber) result = -1;
    else if (rightIsNumber) result = 1;
    else result = left[i] < right[i] ? -1 : left[i] > right[i] ? 1 : 0;
    if (result !== 0) return Math.sign(result);
  }
  return Math.sign(left.length - right.length);
}
