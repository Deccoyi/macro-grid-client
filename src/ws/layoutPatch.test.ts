import { describe, expect, it } from "vitest";
import type { Page, Profile, Widget } from "@macro/renderer";
import { applyLayoutPatch, type LayoutPatchData } from "./layoutPatch";

const widget = (id: string, extra: Record<string, unknown> = {}) => ({ id, ...extra }) as unknown as Widget;
const page = (id: string, widgets: Widget[], extra: Record<string, unknown> = {}) =>
  ({ id, name: id, widgets, ...extra }) as unknown as Page;
const profile = (pages: Page[]) => ({ id: "p1", name: "Main", pages }) as unknown as Profile;

const base = () => profile([page("a", [widget("w1"), widget("w2")]), page("b", [widget("w3")])]);

const patch = (over: Partial<LayoutPatchData>): LayoutPatchData => ({
  profileId: "p1",
  pageId: "a",
  pageOrder: ["a", "b"],
  pages: [],
  ...over,
});

describe("applyLayoutPatch", () => {
  it("rejects a patch for another profile", () => {
    expect(applyLayoutPatch(base(), patch({ profileId: "other" }))).toBeNull();
  });

  it("keeps identity of untouched pages and widgets", () => {
    const old = base();
    const result = applyLayoutPatch(old, patch({ pages: [{ id: "a", widgets: [widget("w1", { text: "new" })] }] }))!;
    expect(result.profile.pages[1]).toBe(old.pages[1]);
    expect(result.profile.pages[0]!.widgets[1]).toBe(old.pages[0]!.widgets[1]);
    expect(result.profile.pages[0]!.widgets[0]).not.toBe(old.pages[0]!.widgets[0]);
    expect(result.changedWidgetIds).toEqual(["w1"]);
  });

  it("applies a rename and page meta", () => {
    const result = applyLayoutPatch(base(), patch({ name: "Renamed", pages: [{ id: "a", meta: { name: "A2" }, widgets: [] }] }))!;
    expect(result.profile.name).toBe("Renamed");
    expect((result.profile.pages[0] as unknown as { name: string }).name).toBe("A2");
  });

  it("adds a new page that carries meta", () => {
    const result = applyLayoutPatch(
      base(),
      patch({ pageOrder: ["a", "b", "c"], pages: [{ id: "c", meta: { name: "C" }, order: ["w9"], widgets: [widget("w9")] }] }),
    )!;
    expect(result.profile.pages.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(result.changedWidgetIds).toEqual(["w9"]);
  });

  it("returns null for a new page without meta", () => {
    expect(applyLayoutPatch(base(), patch({ pageOrder: ["a", "b", "c"], pages: [{ id: "c", widgets: [] }] }))).toBeNull();
  });

  it("returns null when an unmentioned page is unknown", () => {
    expect(applyLayoutPatch(base(), patch({ pageOrder: ["a", "zzz"] }))).toBeNull();
  });

  it("reorders widgets and marks removed ones as changed", () => {
    const result = applyLayoutPatch(base(), patch({ pages: [{ id: "a", order: ["w1"], widgets: [] }] }))!;
    expect(result.profile.pages[0]!.widgets.map((w) => w.id)).toEqual(["w1"]);
    expect(result.changedWidgetIds).toEqual(["w2"]);
  });

  it("returns null when the order references a missing widget", () => {
    expect(applyLayoutPatch(base(), patch({ pages: [{ id: "a", order: ["w1", "nope"], widgets: [] }] }))).toBeNull();
  });

  it("marks widgets of a deleted page as changed", () => {
    const result = applyLayoutPatch(base(), patch({ pageOrder: ["a"] }))!;
    expect(result.profile.pages.map((p) => p.id)).toEqual(["a"]);
    expect(result.changedWidgetIds).toEqual(["w3"]);
  });
});
