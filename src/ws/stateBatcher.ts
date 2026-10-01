import type { WidgetState } from "@macro/renderer";

export type Schedule = (callback: () => void) => void;

const nextFrame: Schedule = (callback) => {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => callback());
  else setTimeout(callback, 16);
};

export interface StateBatcher {
  /** Adds a widget's state to the batch (merged over an earlier one for the same widget); applied at the next frame. */
  push(state: WidgetState): void;
  /** Applies what is waiting now (before a message that must see it); the scheduled frame then finds nothing to do. */
  flushNow(): void;
  /** Drops what is waiting (a layout reset wins over states that arrived before it). */
  clear(): void;
}

/**
 * Many `widget.state` messages in one frame become one state update and one draw. A busy page can send over a hundred of them in a row
 * after a layout or page change; applying each one separately drew the page that many times.
 */
export function createStateBatcher(apply: (batch: Record<string, WidgetState>) => void, schedule: Schedule = nextFrame): StateBatcher {
  let pending: Record<string, WidgetState> = {};
  let waiting = false;

  const flush = () => {
    const batch = pending;
    pending = {};
    if (Object.keys(batch).length > 0) apply(batch);
  };

  return {
    push(state) {
      pending[state.widgetId] = { ...pending[state.widgetId], ...state };
      if (waiting) return;
      waiting = true;
      schedule(() => {
        waiting = false;
        flush();
      });
    },
    flushNow: flush,
    clear() {
      pending = {};
    },
  };
}
