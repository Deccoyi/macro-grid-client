import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readJson, readText, removeItem, writeJson, writeText } from "./storage";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("storage", () => {
  it("round-trips text and JSON", () => {
    expect(writeText("k", "v")).toBe(true);
    expect(readText("k")).toBe("v");
    writeJson("j", { a: 1 });
    expect(localStorage.getItem("j")).toBe('{"a":1}');
    expect(readJson("j", null)).toEqual({ a: 1 });
    removeItem("k");
    expect(readText("k")).toBeNull();
  });

  it("returns the fallback for missing or corrupt JSON", () => {
    expect(readJson("missing", 5)).toBe(5);
    localStorage.setItem("bad", "{oops");
    expect(readJson("bad", [])).toEqual([]);
  });

  it("swallows storage errors", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readText("k")).toBeNull();
    expect(readJson("k", 1)).toBe(1);
    expect(writeText("k", "v")).toBe(false);
    expect(() => removeItem("k")).not.toThrow();
  });
});
