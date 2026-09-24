import { registerPlugin } from "@capacitor/core";
import { callNative } from "./bridge";

export interface GestureExclusionZone {
  top: number;
  height: number;
  width: number;
  rightEdge: boolean;
}

interface GestureExclusionPlugin {
  setZone(opts: GestureExclusionZone): Promise<void>;
  clear(): Promise<void>;
}

const GestureExclusion = registerPlugin<GestureExclusionPlugin>("GestureExclusion");

/** Tells Android not to steal the edge-swipe-back gesture inside this rect — see
 * GestureExclusionPlugin.java. No-ops on web/iOS and on Android < 10 (the plugin itself no-ops there
 * too; the native-platform check just avoids a pointless bridge round-trip). */
export function setGestureExclusionZone(zone: GestureExclusionZone): void {
  callNative(() => GestureExclusion.setZone(zone));
}

export function clearGestureExclusionZone(): void {
  callNative(() => GestureExclusion.clear());
}
