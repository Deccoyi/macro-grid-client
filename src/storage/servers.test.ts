import { beforeEach, describe, expect, it } from "vitest";
import { forgetServer, loadServers, rememberServer } from "./servers";

beforeEach(() => localStorage.clear());

describe("servers", () => {
  it("keeps the most recently used server first without duplicates", () => {
    rememberServer("a:1");
    rememberServer("b:2");
    expect(rememberServer("a:1")).toEqual(["a:1", "b:2"]);
    expect(loadServers()).toEqual(["a:1", "b:2"]);
  });

  it("ignores non-string entries and corrupt data", () => {
    localStorage.setItem("macro-grid.servers", JSON.stringify(["a:1", 3, null]));
    expect(loadServers()).toEqual(["a:1"]);
    localStorage.setItem("macro-grid.servers", "{bad");
    expect(loadServers()).toEqual([]);
  });

  it("forgetting a server also drops its token and layout cache", () => {
    rememberServer("a:1");
    localStorage.setItem("macro-grid.token.a:1", "t");
    localStorage.setItem("macro-grid.layoutCache.a:1", "{}");
    expect(forgetServer("a:1")).toEqual([]);
    expect(localStorage.getItem("macro-grid.token.a:1")).toBeNull();
    expect(localStorage.getItem("macro-grid.layoutCache.a:1")).toBeNull();
  });
});
