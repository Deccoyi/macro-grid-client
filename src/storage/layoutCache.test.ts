import { beforeEach, describe, expect, it } from "vitest";
import type { Profile } from "@macro/renderer";
import { loadLayoutCache, resolveCachedProfile, saveLayoutCache, saveLayoutPage } from "./layoutCache";

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

  it("a page change writes only the page key and the next start shows that page", () => {
    saveLayoutCache("h:1", profile, "pg");
    const before = localStorage.getItem("macro-grid.layoutCache.h:1");
    saveLayoutPage("h:1", "pg2");
    expect(localStorage.getItem("macro-grid.layoutCache.h:1")).toBe(before);
    expect(localStorage.getItem("macro-grid.layoutPage.h:1")).toBe("pg2");
    expect(loadLayoutCache("h:1")).toEqual({ profile, pageId: "pg2" });
  });

  it("a new layout replaces an older page key, and a page key alone shows nothing", () => {
    saveLayoutCache("h:1", profile, "pg");
    saveLayoutPage("h:1", "old");
    saveLayoutCache("h:1", profile, "fresh");
    expect(loadLayoutCache("h:1")?.pageId).toBe("fresh");
    localStorage.removeItem("macro-grid.layoutCache.h:1");
    expect(loadLayoutCache("h:1")).toBeNull();
  });
});
