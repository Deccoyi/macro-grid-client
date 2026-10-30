import { describe, expect, it } from "vitest";
import { planWebLoad } from "./webLoad";

const c = (id: string) => ({ widgetId: id, siteId: `web:${id}.example` });

describe("planWebLoad", () => {
  it("loads the first widgets up to the limit, in order, and makes the rest wait", () => {
    const plan = planWebLoad([c("a"), c("b"), c("c")], 2, new Set());
    expect(plan.live.map((x) => x.widgetId)).toEqual(["a", "b"]);
    expect([...plan.waiting]).toEqual(["c"]);
  });

  it("loads everything when there is no limit", () => {
    expect(planWebLoad([c("a"), c("b"), c("c")], Infinity, new Set()).waiting.size).toBe(0);
  });

  it("always loads a widget the person tapped, even over the limit, and it uses a slot", () => {
    const plan = planWebLoad([c("a"), c("b"), c("c"), c("d")], 1, new Set(["c"]));
    expect(plan.live.map((x) => x.widgetId)).toEqual(["a", "c"]);
    expect([...plan.waiting]).toEqual(["b", "d"]);
  });
});
