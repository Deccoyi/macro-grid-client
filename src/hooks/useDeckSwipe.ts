import { useRef, type TouchEvent } from "react";
import { EDGE_SWIPE_ZONE_PX, PAGE_SWIPE_THRESHOLD_PX, SWIPE_MAX_VERTICAL_PX, SWIPE_OPEN_THRESHOLD_PX } from "../constants";

interface DeckSwipeOptions {
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
}

/**
 * Touch handlers for the deck's horizontal swipes. The drawer lives on the right (the left edge is
 * Android gesture-nav's own back swipe), so the open swipe starts near the right edge and moves left
 * (negative dx); closing swipes right. A long swipe that is not the drawer's own edge-open/close gesture
 * changes page — the same "next/prev wraps around" behavior as a core.page button, triggered by the deck.
 */
export function useDeckSwipe({ drawerOpen, onDrawerOpenChange, onNextPage, onPrevPage }: DeckSwipeOptions) {
  const touchStart = useRef<{ x: number; y: number; fromEdge: boolean } | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]!;
    touchStart.current = { x: touch.clientX, y: touch.clientY, fromEdge: touch.clientX >= window.innerWidth - EDGE_SWIPE_ZONE_PX };
  };

  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = e.changedTouches[0]!;
    const dx = touch.clientX - start.x;
    const dy = Math.abs(touch.clientY - start.y);
    if (dy > SWIPE_MAX_VERTICAL_PX) return;
    if (start.fromEdge && dx < -SWIPE_OPEN_THRESHOLD_PX) onDrawerOpenChange(true);
    else if (drawerOpen && dx > SWIPE_OPEN_THRESHOLD_PX) onDrawerOpenChange(false);
    else if (!start.fromEdge && !drawerOpen) {
      if (dx <= -PAGE_SWIPE_THRESHOLD_PX) onNextPage();
      else if (dx >= PAGE_SWIPE_THRESHOLD_PX) onPrevPage();
    }
  };

  return { onTouchStart, onTouchEnd };
}
