import { beforeEach, describe, expect, it } from "vitest";
import type { AssetMeta, AssetStore } from "../storage/assetDb";

const H1 = "0123456789abcdef01234567";
const H2 = "aaaaaaaaaaaaaaaaaaaaaaaa";

function memoryStore(): AssetStore & { data: Map<string, string>; metas: Map<string, AssetMeta> } {
  const data = new Map<string, string>();
  const metas = new Map<string, AssetMeta>();
  return {
    data,
    metas,
    index: async () => [...metas.values()],
    read: async (hashes) => new Map(hashes.filter((h) => data.has(h)).map((h) => [h, data.get(h)!])),
    write: async (entries) => entries.forEach(({ data: d, ...m }) => (data.set(m.hash, d), metas.set(m.hash, m))),
    touch: async (entries) => entries.forEach((m) => metas.set(m.hash, m)),
    remove: async (hashes) => hashes.forEach((h) => (data.delete(h), metas.delete(h))),
  };
}

async function load() {
  vi.resetModules();
  return import("./assets");
}
import { vi } from "vitest";

beforeEach(() => localStorage.clear());

describe("assets in the device database", () => {
  it("carries the localStorage assets over and removes them only after they were written", async () => {
    localStorage.setItem("macro-grid.assets.index", JSON.stringify([H1]));
    localStorage.setItem(`macro-grid.asset.${H1}`, "data:1");
    const db = memoryStore();
    const { prepareAssets, loadAssets, resolveAssetRefs } = await load();
    await prepareAssets(async () => db);
    expect(db.data.get(H1)).toBe("data:1");
    expect(localStorage.getItem(`macro-grid.asset.${H1}`)).toBeNull();
    expect(localStorage.getItem("macro-grid.assets.index")).toBeNull();
    await loadAssets([H1]);
    expect(resolveAssetRefs({ icon: `asset:${H1}` })).toEqual({ icon: "data:1" });
  });

  it("keeps the localStorage assets when the write fails", async () => {
    localStorage.setItem("macro-grid.assets.index", JSON.stringify([H1]));
    localStorage.setItem(`macro-grid.asset.${H1}`, "data:1");
    const db = memoryStore();
    db.write = async () => { throw new Error("full"); };
    const { prepareAssets } = await load();
    await prepareAssets(async () => db);
    expect(localStorage.getItem(`macro-grid.asset.${H1}`)).toBe("data:1");
  });

  it("preloads what the cached layouts use and stores new assets in the database", async () => {
    const db = memoryStore();
    await db.write([{ hash: H2, size: 6, used: 1, data: "data:2" }]);
    localStorage.setItem("macro-grid.layoutCache.h:1", JSON.stringify({ profile: { icon: `asset:${H2}` }, pageId: "p" }));
    const { prepareAssets, missingAssets, putAsset } = await load();
    await prepareAssets(async () => db);
    expect(missingAssets({ x: `asset:${H2}` })).toEqual([]);
    putAsset(H1, "data:1");
    expect(db.data.get(H1)).toBe("data:1");
    expect(localStorage.getItem(`macro-grid.asset.${H1}`)).toBeNull();
  });

  it("falls back to localStorage when there is no database", async () => {
    const { prepareAssets, putAsset } = await load();
    await prepareAssets(async () => null);
    putAsset(H1, "data:1");
    expect(localStorage.getItem(`macro-grid.asset.${H1}`)).toBe("data:1");
  });

  it("does not wait longer than the limit for a database that never opens", async () => {
    const { prepareAssets } = await load();
    const started = Date.now();
    await prepareAssets(() => new Promise(() => undefined), 50);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
