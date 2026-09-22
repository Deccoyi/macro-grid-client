import { Capacitor, registerPlugin } from "@capacitor/core";

interface GestureExclusionPlugin {
  setZone(opts: { top: number; height: number; width: number; rightEdge: boolean }): Promise<void>;
  clear(): Promise<void>;
}

const GestureExclusion = registerPlugin<GestureExclusionPlugin>("GestureExclusion");

/** Tells Android not to steal the edge-swipe-back gesture inside this rect — see
 * GestureExclusionPlugin.java. No-ops on web/iOS and on Android < 10 (the plugin itself no-ops there
 * too; the native-platform check just avoids a pointless bridge round-trip). */
export function setGestureExclusionZone(zone: { top: number; height: number; width: number; rightEdge: boolean }): void {
  if (!Capacitor.isNativePlatform()) return;
  GestureExclusion.setZone(zone).catch(() => {});
}

export function clearGestureExclusionZone(): void {
  if (!Capacitor.isNativePlatform()) return;
  GestureExclusion.clear().catch(() => {});
}
