/**
 * Plain counters for the performance overlay (Settings > Show performance numbers). Nothing here draws, schedules or sends anything:
 * the cost with the overlay off is a few integer increments. Times are milliseconds since the page started loading.
 */
export interface PerfCounters {
  messages: number;
  widgetStateMessages: number;
  stateUpdates: number;
  widgetDraws: number;
  layoutCacheWrites: number;
  layoutCacheWriteMs: number;
  layoutCacheChars: number;
}

export interface PerfStartTimes {
  firstDraw: number | null;
  firstWelcome: number | null;
  firstLayout: number | null;
}

const zero = (): PerfCounters => ({ messages: 0, widgetStateMessages: 0, stateUpdates: 0, widgetDraws: 0, layoutCacheWrites: 0, layoutCacheWriteMs: 0, layoutCacheChars: 0 });

const counters = zero();
const starts: PerfStartTimes = { firstDraw: null, firstWelcome: null, firstLayout: null };

const now = (): number => (typeof performance === "undefined" ? 0 : Math.round(performance.now()));

export const perf = {
  count(name: keyof PerfCounters, by = 1): void {
    counters[name] += by;
  },
  /** Records the first time only. */
  mark(name: keyof PerfStartTimes): void {
    if (starts[name] === null) starts[name] = now();
  },
  /** Times a synchronous write and counts it. */
  timeCacheWrite<T>(chars: number, write: () => T): T {
    const began = now();
    try {
      return write();
    } finally {
      counters.layoutCacheWrites++;
      counters.layoutCacheWriteMs += Math.max(0, now() - began);
      counters.layoutCacheChars = chars;
    }
  },
  counters: (): Readonly<PerfCounters> => counters,
  starts: (): Readonly<PerfStartTimes> => starts,
  /** For tests. */
  reset(): void {
    Object.assign(counters, zero());
    starts.firstDraw = starts.firstWelcome = starts.firstLayout = null;
  },
};
