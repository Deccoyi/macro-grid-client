import { useRef, type TouchEvent } from "react";
import {
  EDGE_SWIPE_ZONE_PX,
  PAGE_SWIPE_THRESHOLD_PX,
  SWIPE_MAX_VERTICAL_PX,
  SWIPE_OPEN_THRESHOLD_PX,
  TWO_FINGER_MAX_VERTICAL_PX,
} from "../constants";

interface DeckSwipeOptions {
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Which page a two-finger drag leads to: `next` for a long enough drag to the left, `prev` to the right,
 * `null` when it is too short or too vertical (a scroll, or the fingers pinching). Both points are the
 * midpoint of the two fingers, so pinching (the midpoint hardly moves) never changes page.
 */
export function pageForTwoFingerSwipe(start: Point, end: Point): "next" | "prev" | null {
  const dx = end.x - start.x;
  const dy = Math.abs(end.y - start.y);
  if (dy > TWO_FINGER_MAX_VERTICAL_PX) return null;
  if (dx <= -PAGE_SWIPE_THRESHOLD_PX) return "next";
  if (dx >= PAGE_SWIPE_THRESHOLD_PX) return "prev";
  return null;
}

function midpoint(touches: TouchEvent["touches"]): Point {
  const a = touches[0]!;
  const b = touches[1]!;
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

/**
 * Touch handlers for the deck's horizontal swipes.
 * - Page change: a TWO-finger horizontal swipe, anywhere on the deck (also over a slider or knob). A single
 *   finger never changes page, so dragging a slider or knob cannot flip the page.
 * - Drawer: it lives on the right (the left edge is Android gesture-nav's own back swipe), so the open swipe
 *   is a single finger that starts near the right edge and moves left; closing swipes right.
 */
export function useDeckSwipe({ drawerOpen, onDrawerOpenChange, onNextPage, onPrevPage }: DeckSwipeOptions) {
  const touchStart = useRef<{ x: number; y: number; fromEdge: boolean } | null>(null);
  const twoFinger = useRef<{ start: Point; last: Point } | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length >= 2) {
      // A second finger turns the gesture into a page swipe and cancels any single-finger swipe in progress.
      touchStart.current = null;
      if (!twoFinger.current) {
        const p = midpoint(e.touches);
        twoFinger.current = { start: p, last: p };
      }
      return;
    }
    if (twoFinger.current) return; // a finger of an ongoing two-finger gesture came back
    const touch = e.touches[0]!;
    touchStart.current = { x: touch.clientX, y: touch.clientY, fromEdge: touch.clientX >= window.innerWidth - EDGE_SWIPE_ZONE_PX };
  };

  const onTouchMove = (e: TouchEvent) => {
    // Only while both fingers are down: once one lifts, the midpoint would jump to the remaining finger.
    if (twoFinger.current && e.touches.length >= 2) twoFinger.current.last = midpoint(e.touches);
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (twoFinger.current) {
      if (e.touches.length > 0) return; // wait until every finger is up
      const { start, last } = twoFinger.current;
      twoFinger.current = null;
      const page = pageForTwoFingerSwipe(start, last);
      if (page === "next") onNextPage();
      else if (page === "prev") onPrevPage();
      return;
    }
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = e.changedTouches[0]!;
    const dx = touch.clientX - start.x;
    const dy = Math.abs(touch.clientY - start.y);
    if (dy > SWIPE_MAX_VERTICAL_PX) return;
    if (start.fromEdge && dx < -SWIPE_OPEN_THRESHOLD_PX) onDrawerOpenChange(true);
    else if (drawerOpen && dx > SWIPE_OPEN_THRESHOLD_PX) onDrawerOpenChange(false);
  };

  const onTouchCancel = () => {
    touchStart.current = null;
    twoFinger.current = null;
  };

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}
