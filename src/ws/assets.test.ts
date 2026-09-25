import { beforeEach, describe, expect, it, vi } from "vitest";

const H1 = "0123456789abcdef01234567";
const H2 = "aaaaaaaaaaaaaaaaaaaaaaaa";

// The module keeps an in-memory cache and index, so each test loads a fresh copy.
async function load() {
  vi.resetModules();
  return import("./assets");
}

beforeEach(() => localStorage.clear());

describe("collectAssetRefs / missingAssets", () => {
  it("finds references in nested values and ignores other strings", async () => {
    const { collectAssetRefs } = await load();
    const refs = collectAssetRefs({ a: [`asset:${H1}`, "asset:xyz"], b: { c: `asset:${H2}` }, d: 3, e: null });
    expect([...refs].sort()).toEqual([H1, H2].sort());
  });

  it("lists only uncached hashes", async () => {
    const { putAsset, missingAssets } = await load();
    putAsset(H1, "data:1");
    expect(missingAssets({ x: `asset:${H1}`, y: `asset:${H2}` })).toEqual([H2]);
  });
});

describe("resolveAssetRefs", () => {
  it("replaces references with data and blanks missing ones", async () => {
    const { putAsset, resolveAssetRefs } = await load();
    putAsset(H1, "data:1");
    expect(resolveAssetRefs({ icon: `asset:${H1}`, other: `asset:${H2}`, n: 1 })).toEqual({ icon: "data:1", other: "", n: 1 });
  });

  it("does not modify the input and keeps identity of untouched subtrees", async () => {
    const { putAsset, resolveAssetRefs } = await load();
    putAsset(H1, "data:1");
    const plain = { k: "v" };
    const input = { plain, icon: `asset:${H1}` };
    const out = resolveAssetRefs(input);
    expect(input.icon).toBe(`asset:${H1}`);
    expect(out.plain).toBe(plain);
    expect(resolveAssetRefs(input)).toBe(out);
  });
});

describe("persistence", () => {
  it("reads a stored asset after the memory cache is gone", async () => {
    const first = await load();
    first.putAsset(H1, "data:1");
    const second = await load();
    expect(second.resolveAssetRefs(`asset:${H1}`)).toBe("data:1");
  });

  it("evicts the least recently used asset past the limit", async () => {
    const { putAsset } = await load();
    const hash = (i: number) => i.toString(16).padStart(24, "0");
    for (let i = 0; i < 401; i++) putAsset(hash(i), "d");
    expect(localStorage.getItem("macro-grid.asset." + hash(0))).toBeNull();
    expect(localStorage.getItem("macro-grid.asset." + hash(400))).toBe("d");
    expect(JSON.parse(localStorage.getItem("macro-grid.assets.index")!)).toHaveLength(400);
  });
});
