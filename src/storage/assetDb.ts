/**
 * The device database behind the asset cache. localStorage holds about 5 MB of text in all, which a big profile's icons and images fill
 * and then lose on the next start; IndexedDB has no such small limit. This file only stores and reads: the cache logic (the in-memory
 * map, the budget, what to evict) is in ws/assets.ts and works against this small interface, so it is tested with an in-memory store.
 */

export interface AssetMeta {
  hash: string;
  /** Characters of the data. */
  size: number;
  /** When it was last stored or used (milliseconds), for dropping the least recently used first. */
  used: number;
}

export interface AssetStore {
  /** Everything stored, without the data. */
  index(): Promise<AssetMeta[]>;
  /** The data of the hashes that are stored; the others are left out. */
  read(hashes: string[]): Promise<Map<string, string>>;
  write(entries: Array<AssetMeta & { data: string }>): Promise<void>;
  touch(entries: AssetMeta[]): Promise<void>;
  remove(hashes: string[]): Promise<void>;
}

const DB_NAME = "macro-grid-assets";
const DATA = "data";
const META = "meta";

const done = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const finished = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

/** Opens the device database, or null when it is not available (private mode, blocked, an old WebView). */
export async function openAssetStore(): Promise<AssetStore | null> {
  try {
    if (typeof indexedDB === "undefined") return null;
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore(DATA);
      open.result.createObjectStore(META);
    };
    const db = await done(open);
    return {
      async index() {
        return (await done(db.transaction(META).objectStore(META).getAll())) as AssetMeta[];
      },
      async read(hashes) {
        const tx = db.transaction(DATA);
        const store = tx.objectStore(DATA);
        const found = await Promise.all(hashes.map(async (hash) => [hash, await done(store.get(hash))] as const));
        return new Map(found.filter((entry): entry is [string, string] => typeof entry[1] === "string"));
      },
      async write(entries) {
        const tx = db.transaction([DATA, META], "readwrite");
        for (const { data, ...meta } of entries) {
          tx.objectStore(DATA).put(data, meta.hash);
          tx.objectStore(META).put(meta, meta.hash);
        }
        await finished(tx);
      },
      async touch(entries) {
        const tx = db.transaction(META, "readwrite");
        for (const meta of entries) tx.objectStore(META).put(meta, meta.hash);
        await finished(tx);
      },
      async remove(hashes) {
        const tx = db.transaction([DATA, META], "readwrite");
        for (const hash of hashes) {
          tx.objectStore(DATA).delete(hash);
          tx.objectStore(META).delete(hash);
        }
        await finished(tx);
      },
    };
  } catch {
    return null;
  }
}
