import { beforeEach, describe, expect, it } from "vitest";
import type { Profile } from "@macro/renderer";
import { loadLayoutCache, resolveCachedProfile, saveLayoutCache } from "./layoutCache";

const profile = { id: "p", name: "P", pages: [] } as unknown as Profile;

beforeEach(() => localStorage.clear());

describe("layout cache", () => {
  it("round-trips per host under the documented key", () => {
    saveLayoutCache("h:1", profile, "pg");
    expect(JSON.parse(localStorage.getItem("macro-grid.layoutCache.h:1")!)).toEqual({ profile, pageId: "pg" });
    expect(loadLayoutCache("h:1")).toEqual({ profile, pageId: "pg" });
    expect(loadLayoutCache("other")).toBeNull();
  });

  it("returns null without a host or for corrupt data", () => {
    expect(loadLayoutCache("")).toBeNull();
    localStorage.setItem("macro-grid.layoutCache.h:1", "{bad");
    expect(loadLayoutCache("h:1")).toBeNull();
  });

  it("resolves a cached profile for display", () => {
    expect(resolveCachedProfile(null)).toBeNull();
    expect(resolveCachedProfile({ profile, pageId: "pg" })).toEqual(profile);
  });
});
