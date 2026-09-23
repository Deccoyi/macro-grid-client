/**
 * Client-side cache for the large `data:` values (icons, images) the server pulls out of layouts and sends
 * once as `asset` messages, referencing them from the layout as `asset:<hash>`. The hash is the content
 * hash, so a cached asset never goes stale; it survives app restarts (localStorage) so a reconnect or a
 * cold start needs no asset traffic at all for icons already seen.
 */

const STORAGE_PREFIX = "macro-station.asset.";
const INDEX_KEY = "macro-station.assets.index";
/** Least-recently-used assets beyond this many are dropped from storage (they are refetched if needed again). */
const MAX_STORED_ASSETS = 400;

const REF = /^asset:([0-9a-f]{24})$/;

const memory = new Map<string, string>();
/** Hashes in least- to most-recently-used order; mirrors what is in localStorage. */
let index: string[] | null = null;

function loadIndex(): string[] {
  if (index) return index;
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    index = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    index = [];
  }
  return index;
}

function saveIndex(): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // Storage full or unavailable — the persistent cache is a nice-to-have, the in-memory one still works.
  }
}

function touch(hash: string): void {
  const list = loadIndex();
  const at = list.indexOf(hash);
  if (at !== -1) list.splice(at, 1);
  list.push(hash);
}

export function hasAsset(hash: string): boolean {
  return getAsset(hash) !== undefined;
}

export function getAsset(hash: string): string | undefined {
  const cached = memory.get(hash);
  if (cached !== undefined) return cached;
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + hash);
    if (stored !== null) {
      memory.set(hash, stored);
      return stored;
    }
  } catch {
    // Storage unavailable.
  }
  return undefined;
}

export function putAsset(hash: string, data: string): void {
  memory.set(hash, data);
  touch(hash);
  try {
    localStorage.setItem(STORAGE_PREFIX + hash, data);
  } catch {
    // Storage full or unavailable — keep it in memory only.
  }

  const list = loadIndex();
  while (list.length > MAX_STORED_ASSETS) {
    const evicted = list.shift()!;
    try {
      localStorage.removeItem(STORAGE_PREFIX + evicted);
    } catch {
      // ignore
    }
  }
  saveIndex();
}

/** Every distinct `asset:<hash>` reference anywhere inside a value. */
export function collectAssetRefs(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof value === "string") {
    const match = REF.exec(value);
    if (match) out.add(match[1]);
  } else if (Array.isArray(value)) {
    for (const item of value) collectAssetRefs(item, out);
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) collectAssetRefs(item, out);
  }
  return out;
}

/** References in a value whose data is not cached yet. */
export function missingAssets(value: unknown): string[] {
  return [...collectAssetRefs(value)].filter((hash) => !hasAsset(hash));
}

// A node that contained references and was fully resolved is remembered by identity, so resolving a patched
// profile hands back the very same object for every widget the patch did not touch — React then skips them.
const resolved = new WeakMap<object, unknown>();
let missingCount = 0;

/**
 * Returns the value with every `asset:<hash>` reference replaced by its cached data (an empty string for one
 * that is not cached). Untouched subtrees keep their identity; the input is never modified.
 */
export function resolveAssetRefs<T>(value: T): T {
  return resolveNode(value) as T;
}

function resolveNode(value: unknown): unknown {
  if (typeof value === "string") {
    const match = REF.exec(value);
    if (!match) return value;
    const data = getAsset(match[1]);
    if (data === undefined) missingCount++;
    return data ?? "";
  }
  if (value === null || typeof value !== "object") return value;

  const cached = resolved.get(value);
  if (cached !== undefined) return cached;

  const missingBefore = missingCount;
  let result: unknown = value;
  if (Array.isArray(value)) {
    let copy: unknown[] | null = null;
    value.forEach((item, i) => {
      const next = resolveNode(item);
      if (next !== item) {
        copy ??= value.slice();
        copy[i] = next;
      }
    });
    if (copy) result = copy;
  } else {
    let copy: Record<string, unknown> | null = null;
    for (const [key, item] of Object.entries(value)) {
      const next = resolveNode(item);
      if (next !== item) {
        copy ??= { ...(value as Record<string, unknown>) };
        copy[key] = next;
      }
    }
    if (copy) result = copy;
  }

  if (result !== value && missingCount === missingBefore) resolved.set(value, result);
  return result;
}
