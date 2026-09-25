import { describe, expect, it } from "vitest";
import { PAGE_SWIPE_THRESHOLD_PX, TWO_FINGER_MAX_VERTICAL_PX } from "../constants";
import { pageForTwoFingerSwipe } from "./useDeckSwipe";

const from = { x: 200, y: 400 };

describe("pageForTwoFingerSwipe", () => {
  it("goes to the next page for a long drag to the left", () => {
    expect(pageForTwoFingerSwipe(from, { x: from.x - PAGE_SWIPE_THRESHOLD_PX, y: from.y })).toBe("next");
  });

  it("goes to the previous page for a long drag to the right", () => {
    expect(pageForTwoFingerSwipe(from, { x: from.x + PAGE_SWIPE_THRESHOLD_PX, y: from.y })).toBe("prev");
  });

  it("ignores a short drag", () => {
    expect(pageForTwoFingerSwipe(from, { x: from.x + PAGE_SWIPE_THRESHOLD_PX - 1, y: from.y })).toBeNull();
  });

  it("ignores a mostly vertical drag", () => {
    expect(pageForTwoFingerSwipe(from, { x: from.x + 200, y: from.y + TWO_FINGER_MAX_VERTICAL_PX + 1 })).toBeNull();
  });

  it("ignores a pinch, where the midpoint hardly moves", () => {
    expect(pageForTwoFingerSwipe(from, { x: from.x + 4, y: from.y - 3 })).toBeNull();
  });
});
