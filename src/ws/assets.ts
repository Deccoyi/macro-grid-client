/**
 * Client-side cache for the large `data:` values (icons, images) the server pulls out of layouts and sends
 * once as `asset` messages, referencing them from the layout as `asset:<hash>`. The hash is the content
 * hash, so a cached asset never goes stale; it survives app restarts so a reconnect or a cold start needs
 * no asset traffic at all for icons already seen. They are kept in the device database (see storage/assetDb);
 * where that is not available they stay in localStorage as before. The in-memory map is what drawing reads,
 * so resolving a layout stays synchronous either way.
 */

import { openAssetStore, type AssetMeta, type AssetStore } from "../storage/assetDb";
import { readJson, readText, removeItem, writeJson, writeText } from "../storage/storage";

const STORAGE_PREFIX = "macro-grid.asset.";
const INDEX_KEY = "macro-grid.assets.index";
/** Least-recently-used assets beyond this many are dropped from storage (they are refetched if needed again). */
const MAX_STORED_ASSETS = 400;

/** The device database has room for far more than localStorage; these keep it from growing for ever. */
const MAX_DB_ASSETS = 1000;
const MAX_DB_CHARS = 48_000_000;

const REF = /^asset:([0-9a-f]{24})$/;
const REF_ANYWHERE = /asset:([0-9a-f]{24})/g;
const LAYOUT_CACHE_PREFIX = "macro-grid.layoutCache.";

/** Set once the device database is open; until then (and when it cannot be opened) localStorage is used. */
let store: AssetStore | null = null;
const meta = new Map<string, AssetMeta>();
let storedChars = 0;

const memory = new Map<string, string>();
/** Hashes in least- to most-recently-used order; mirrors what is in localStorage. */
let index: string[] | null = null;

function loadIndex(): string[] {
  if (index) return index;
  index = readJson<string[]>(INDEX_KEY, []);
  return index;
}

/** Best-effort: the persistent cache is a nice-to-have, the in-memory one still works. */
function saveIndex(): void {
  writeJson(INDEX_KEY, index);
}

function touch(hash: string): void {
  const list = loadIndex();
  const at = list.indexOf(hash);
  if (at !== -1) list.splice(at, 1);
  list.push(hash);
}

function hasAsset(hash: string): boolean {
  return getAsset(hash) !== undefined;
}

function getAsset(hash: string): string | undefined {
  const cached = memory.get(hash);
  if (cached !== undefined) return cached;
  const stored = readText(STORAGE_PREFIX + hash);
  if (stored === null) return undefined;
  memory.set(hash, stored);
  return stored;
}

/** How many assets are in memory and how many characters they hold (for the performance overlay). */
export function assetStats(): { count: number; chars: number } {
  let chars = 0;
  for (const data of memory.values()) chars += data.length;
  return { count: memory.size, chars };
}

export function putAsset(hash: string, data: string): void {
  memory.set(hash, data);
  if (store) {
    putInStore(store, hash, data);
    return;
  }
  touch(hash);
  writeText(STORAGE_PREFIX + hash, data); // On failure the asset simply stays in memory only.

  const list = loadIndex();
  while (list.length > MAX_STORED_ASSETS) {
    const evicted = list.shift()!;
    removeItem(STORAGE_PREFIX + evicted);
  }
  saveIndex();
}

function putInStore(db: AssetStore, hash: string, data: string): void {
  const entry: AssetMeta = { hash, size: data.length, used: Date.now() };
  storedChars += entry.size - (meta.get(hash)?.size ?? 0);
  meta.set(hash, entry);
  void db.write([{ ...entry, data }]).catch(() => undefined); // On failure the asset simply stays in memory only.

  const dropped: string[] = [];
  while ((meta.size > MAX_DB_ASSETS || storedChars > MAX_DB_CHARS) && meta.size > 1) {
    let oldest: AssetMeta | null = null;
    for (const candidate of meta.values()) if (candidate.hash !== hash && (!oldest || candidate.used < oldest.used)) oldest = candidate;
    if (!oldest) break;
    meta.delete(oldest.hash);
    storedChars -= oldest.size;
    dropped.push(oldest.hash);
  }
  if (dropped.length > 0) void db.remove(dropped).catch(() => undefined);
}

/** Marks the assets a layout uses as just used, so the ones that are still on a deck are the last to be dropped. */
export function touchAssets(hashes: Iterable<string>): void {
  if (!store) return;
  const now = Date.now();
  const touched: AssetMeta[] = [];
  for (const hash of hashes) {
    const entry = meta.get(hash);
    if (entry) touched.push((meta.set(hash, { ...entry, used: now }), meta.get(hash)!));
  }
  if (touched.length > 0) void store.touch(touched).catch(() => undefined);
}

/** Brings the stored assets among these hashes into memory, so the synchronous resolve finds them. */
export async function loadAssets(hashes: string[]): Promise<void> {
  const db = store;
  if (!db) return;
  const wanted = hashes.filter((hash) => !memory.has(hash) && meta.has(hash));
  if (wanted.length === 0) return;
  try {
    for (const [hash, data] of await db.read(wanted)) if (!memory.has(hash)) memory.set(hash, data);
  } catch {
    // The server is asked for what stays missing.
  }
}

/** Hashes the cached layouts of every server refer to, read from their text without parsing them. */
function hashesOfCachedLayouts(): string[] {
  const found = new Set<string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(LAYOUT_CACHE_PREFIX)) continue;
      for (const match of (readText(key) ?? "").matchAll(REF_ANYWHERE)) found.add(match[1]);
    }
  } catch {
    // No storage, nothing to preload.
  }
  return [...found];
}

/** Moves what the older versions kept in localStorage into the database; each one is removed only after it was written. */
async function carryOver(db: AssetStore): Promise<void> {
  const legacy = readJson<string[]>(INDEX_KEY, []);
  if (legacy.length === 0) return;
  const batch: Array<AssetMeta & { data: string }> = [];
  for (const hash of legacy) {
    const data = readText(STORAGE_PREFIX + hash);
    if (data !== null && !meta.has(hash)) batch.push({ hash, size: data.length, used: Date.now(), data });
  }
  if (batch.length > 0) await db.write(batch);
  for (const entry of batch) {
    meta.set(entry.hash, { hash: entry.hash, size: entry.size, used: entry.used });
    storedChars += entry.size;
  }
  for (const hash of legacy) removeItem(STORAGE_PREFIX + hash);
  removeItem(INDEX_KEY);
}

/**
 * Opens the device database before the first draw, carries the old localStorage assets over and loads the ones the cached layouts use. It
 * gives up waiting after `limitMs` (the app then starts with what it has and the database finishes in the background), and it never throws:
 * with no database the cache stays in localStorage.
 */
export async function prepareAssets(open: () => Promise<AssetStore | null> = openAssetStore, limitMs = 1000): Promise<void> {
  const work = (async () => {
    const db = await open();
    if (!db) return;
    for (const entry of await db.index()) {
      meta.set(entry.hash, entry);
      storedChars += entry.size;
    }
    await carryOver(db);
    store = db;
    await loadAssets(hashesOfCachedLayouts());
  })().catch(() => undefined);
  await Promise.race([work, new Promise<void>((resolve) => setTimeout(resolve, limitMs))]);
}

/**
 * A plugin widget's `props.runtime` (script and images as `asset:` references). It is not resolved or cached here: the script is fetched and run by
 * the widget host on demand, and a large script must not fill the persistent asset cache.
 */
function isWidgetRuntime(key: string, value: unknown): boolean {
  return key === "runtime" && value !== null && typeof value === "object" && typeof (value as { code?: unknown }).code === "string";
}

/** Every distinct `asset:<hash>` reference anywhere inside a value. */
export function collectAssetRefs(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof value === "string") {
    const match = REF.exec(value);
    if (match) out.add(match[1]);
  } else if (Array.isArray(value)) {
    for (const item of value) collectAssetRefs(item, out);
  } else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) if (!isWidgetRuntime(key, item)) collectAssetRefs(item, out);
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
      if (isWidgetRuntime(key, item)) continue;
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
