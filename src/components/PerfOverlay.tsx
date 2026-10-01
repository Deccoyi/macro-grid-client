import { useEffect, useState, type CSSProperties } from "react";
import { t } from "../i18n";
import { perf, type PerfCounters } from "../perf/perfStats";
import { assetStats } from "../ws/assets";

interface Snapshot {
  fps: number;
  messages: number;
  states: number;
  draws: number;
  longTasks: number;
  heapMb: number | null;
  assets: { count: number; chars: number };
}

const boxStyle: CSSProperties = {
  position: "fixed",
  top: "env(safe-area-inset-top, 0px)",
  left: 0,
  zIndex: 50,
  padding: "4px 6px",
  background: "rgba(0,0,0,0.7)",
  color: "#9fe870",
  font: "10px/1.35 monospace",
  pointerEvents: "none",
  whiteSpace: "pre",
};

const ms = (value: number | null) => (value === null ? "-" : `${value} ms`);

/** The numbers behind "is the deck smooth": shown only while the setting is on; its own frame counter runs only then. */
export function PerfOverlay() {
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    let frames = 0;
    let raf = 0;
    const tick = () => {
      frames++;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const longTaskTimes: number[] = [];
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const _entry of list.getEntries()) longTaskTimes.push(Date.now());
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      observer = null; // this WebView does not report long tasks
    }

    let last: PerfCounters = { ...perf.counters() };
    const timer = setInterval(() => {
      const now = perf.counters();
      const cutoff = Date.now() - 10_000;
      while (longTaskTimes.length > 0 && longTaskTimes[0]! < cutoff) longTaskTimes.shift();
      const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      setSnap({
        fps: frames,
        messages: now.messages - last.messages,
        states: now.stateUpdates - last.stateUpdates,
        draws: now.widgetDraws - last.widgetDraws,
        longTasks: longTaskTimes.length,
        heapMb: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : null,
        assets: assetStats(),
      });
      last = { ...now };
      frames = 0;
    }, 1000);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
      observer?.disconnect();
    };
  }, []);

  const starts = perf.starts();
  const cache = perf.counters();
  return (
    <div style={boxStyle} aria-hidden>
      {t("perf.start", ms(starts.firstDraw), ms(starts.firstWelcome), ms(starts.firstLayout))}
      {"\n"}
      {snap ? t("perf.live", String(snap.fps), String(snap.messages), String(snap.states), String(snap.draws), String(snap.longTasks)) : "..."}
      {"\n"}
      {t("perf.storage", String(snap?.assets.count ?? 0), String(Math.round((snap?.assets.chars ?? 0) / 1000)), String(cache.layoutCacheWrites), String(cache.layoutCacheWriteMs), snap?.heapMb === null || !snap ? "-" : String(snap.heapMb))}
    </div>
  );
}
