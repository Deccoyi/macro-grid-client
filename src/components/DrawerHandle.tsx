import { useEffect, useRef, useState, type CSSProperties, type TouchEvent } from "react";
import {
  EDGE_SWIPE_ZONE_PX,
  GESTURE_ZONE_HEIGHT_PX,
  HANDLE_FRACTION_DEFAULT,
  HANDLE_FRACTION_MAX,
  HANDLE_FRACTION_MIN,
  HANDLE_HEIGHT_PX,
  HANDLE_HOLD_CANCEL_PX,
  HANDLE_HOLD_MS,
  HANDLE_WIDTH_PX,
} from "../constants";
import { t } from "../i18n";
import { clearGestureExclusionZone, setGestureExclusionZone } from "../native/gestureExclusion";
import { HANDLE_Y_KEY } from "../storage/keys";
import { readText, writeText } from "../storage/storage";
import { colors } from "../theme";

// The button's real hit area is deliberately wider/taller than the visible bar (matches the native
// gesture-exclusion rect) — a tap landing near the edge but just outside the thin bar used to fall
// through to the grid underneath, which only reacts to a swipe, not a stationary tap. The bar itself
// (the inner span) stays HANDLE_WIDTH_PX/HANDLE_HEIGHT_PX and flush with the screen edge.
const buttonStyle = (topFraction: number): CSSProperties => ({
  position: "fixed",
  right: 0,
  top: `${topFraction * 100}%`,
  transform: "translateY(-50%)",
  zIndex: 90,
  width: EDGE_SWIPE_ZONE_PX,
  height: GESTURE_ZONE_HEIGHT_PX,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  touchAction: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
});
const barStyle: CSSProperties = {
  width: HANDLE_WIDTH_PX,
  height: HANDLE_HEIGHT_PX,
  borderRadius: "8px 0 0 8px",
  background: "rgba(255,255,255,.14)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

/** Marks the handle while an update is waiting, so the person knows to open the drawer. */
const dotStyle: CSSProperties = {
  position: "absolute",
  right: HANDLE_WIDTH_PX + 6,
  top: `calc(50% - ${HANDLE_HEIGHT_PX / 2 + 8}px)`,
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: colors.accent,
  boxShadow: "0 0 0 2px rgba(0,0,0,.5)",
};

const clampHandleFraction = (n: number) => Math.min(HANDLE_FRACTION_MAX, Math.max(HANDLE_FRACTION_MIN, n));

function loadHandleFraction(): number {
  const raw = readText(HANDLE_Y_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? clampHandleFraction(n) : HANDLE_FRACTION_DEFAULT;
}

interface DragState {
  origX: number;
  origY: number;
  anchorX: number;
  anchorY: number;
  anchorFraction: number;
  lastX: number;
  lastY: number;
  holdTimer: ReturnType<typeof setTimeout> | null;
  /** Set once HANDLE_HOLD_MS has passed with the finger still near its start — only then does moving
   * the finger reposition the handle instead of being a swipe/tap. */
  active: boolean;
}

/**
 * The always-visible drawer handle: on the right edge (not left — that's Android gesture-nav's own
 * back-swipe zone). A tap, or a swipe that passes over it, opens the drawer. Repositioning the handle
 * itself needs a deliberate press-and-hold — a quick swipe must never drag it, since a swipe's natural
 * diagonal wobble would otherwise get misread as "start dragging" (see HANDLE_HOLD_MS). Position
 * is remembered per device in localStorage. Also tells Android to exclude this exact screen rect from
 * its own edge-swipe-back gesture (see native/gestureExclusion.ts) so the two don't fight over the same
 * touch — without that, a touch landing in the OS's back-gesture strip here can be intercepted before
 * this component ever sees it, on Android 10+ at least.
 */
export function DrawerHandle({ onOpen, showDot = false }: { onOpen: () => void; showDot?: boolean }) {
  const [topFraction, setTopFraction] = useState(loadHandleFraction);
  const topFractionRef = useRef(topFraction);
  useEffect(() => {
    topFractionRef.current = topFraction;
  }, [topFraction]);

  const drag = useRef<DragState | null>(null);

  useEffect(() => {
    const publishZone = () => {
      setGestureExclusionZone({
        top: topFraction * window.innerHeight - GESTURE_ZONE_HEIGHT_PX / 2,
        height: GESTURE_ZONE_HEIGHT_PX,
        width: EDGE_SWIPE_ZONE_PX,
        rightEdge: true,
      });
    };
    publishZone();
    window.addEventListener("resize", publishZone);
    return () => {
      window.removeEventListener("resize", publishZone);
      clearGestureExclusionZone();
    };
  }, [topFraction]);

  const cancelHold = () => {
    const d = drag.current;
    if (d?.holdTimer != null) {
      clearTimeout(d.holdTimer);
      d.holdTimer = null;
    }
  };

  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]!;
    const state: DragState = {
      origX: touch.clientX,
      origY: touch.clientY,
      anchorX: touch.clientX,
      anchorY: touch.clientY,
      anchorFraction: topFractionRef.current,
      lastX: touch.clientX,
      lastY: touch.clientY,
      holdTimer: null,
      active: false,
    };
    state.holdTimer = setTimeout(() => {
      state.active = true;
      // Re-anchor to wherever the finger drifted to during the hold, so drag mode doesn't jump.
      state.anchorY = state.lastY;
      state.anchorFraction = topFractionRef.current;
      try {
        navigator.vibrate?.(15);
      } catch {
        // Vibration is a nice-to-have confirmation; ignore if unsupported.
      }
    }, HANDLE_HOLD_MS);
    drag.current = state;
  };

  const onTouchMove = (e: TouchEvent) => {
    const d = drag.current;
    if (!d) return;
    const touch = e.touches[0]!;
    d.lastX = touch.clientX;
    d.lastY = touch.clientY;
    if (!d.active) {
      if (Math.hypot(touch.clientX - d.anchorX, touch.clientY - d.anchorY) > HANDLE_HOLD_CANCEL_PX) cancelHold();
      return;
    }
    setTopFraction(clampHandleFraction(d.anchorFraction + (touch.clientY - d.anchorY) / window.innerHeight));
  };

  const endTouch = (e: TouchEvent) => {
    // Suppress the synthetic click that follows touchend: the handle unmounts as the drawer opens, so
    // that click would land on the drawer's backdrop and close it again instantly.
    if (e.cancelable) e.preventDefault();
    const d = drag.current;
    cancelHold();
    drag.current = null;
    if (!d) return;
    // Barely moved from where the finger first landed — a tap, even a slow/deliberate one that ran
    // past HANDLE_HOLD_MS and triggered the vibration, still opens rather than silently doing nothing.
    const barelyMoved = Math.hypot(d.lastX - d.origX, d.lastY - d.origY) <= HANDLE_HOLD_CANCEL_PX;
    if (d.active && !barelyMoved) {
      writeText(HANDLE_Y_KEY, String(topFractionRef.current)); // Best-effort; the handle just resets to center next launch.
    } else {
      onOpen();
    }
  };

  return (
    <button
      aria-label={t("drawer.show")}
      onClick={onOpen}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={endTouch}
      onTouchCancel={endTouch}
      style={buttonStyle(topFraction)}
    >
      {showDot && <span aria-hidden="true" style={dotStyle} />}
      <span aria-hidden="true" style={barStyle}>
        <svg width="7" height="13" viewBox="0 0 7 13" fill="none" aria-hidden="true">
          <path d="M6 1L1 6.5L6 12" stroke="rgba(255,255,255,.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
