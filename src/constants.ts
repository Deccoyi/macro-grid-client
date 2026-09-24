/** Gesture and layout tuning for the deck. Pixel values are CSS px. */

export const EDGE_SWIPE_ZONE_PX = 56;
export const SWIPE_OPEN_THRESHOLD_PX = 60;
/** A swipe longer than this vertically is a scroll-like drag, not a horizontal swipe. */
export const SWIPE_MAX_VERTICAL_PX = 40;
/** A swipe across most of the screen width reads as "change page" rather than a stray drag — well past
 * anything a slider/knob drag (bounded to that one widget's cell) would ever cover, so the two gestures
 * don't fight once widgets grow their own drag handling. */
export const PAGE_SWIPE_THRESHOLD_PX = 90;

export const HANDLE_WIDTH_PX = 18;
export const HANDLE_HEIGHT_PX = 64;
/** The handle's vertical position stays within this fraction range of the screen height. */
export const HANDLE_FRACTION_MIN = 0.08;
export const HANDLE_FRACTION_MAX = 0.92;
export const HANDLE_FRACTION_DEFAULT = 0.5;
// A quick swipe over the handle (to open the drawer) must never reposition it — only a deliberate
// press-and-hold does. HANDLE_HOLD_MS is how long a still touch has to be held before it's treated as
// "start dragging"; HANDLE_HOLD_CANCEL_PX is how far the finger may wander during that hold before it's
// treated as a swipe/tap instead and the hold is cancelled.
export const HANDLE_HOLD_MS = 320;
export const HANDLE_HOLD_CANCEL_PX = 12;
// The exclusion zone is deliberately bigger than the visible handle: a touch that lands just outside
// the button but still inside the OS's back-gesture strip would otherwise get swallowed by Android
// before onTouchStart/the edge-swipe-open logic ever sees it. The handle itself stays
// HANDLE_WIDTH_PX/HANDLE_HEIGHT_PX; width matches EDGE_SWIPE_ZONE_PX so nothing falls in a dead zone
// where the OS gesture is cancelled but our own swipe-open check doesn't count it as "from the edge".
export const GESTURE_ZONE_HEIGHT_PX = 140;

/** How long an action-failed toast stays visible. */
export const ACTION_ERROR_MS = 4000;
