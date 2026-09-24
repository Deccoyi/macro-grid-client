import { Capacitor } from "@capacitor/core";

/**
 * Runs a native plugin call only on a native platform and ignores a rejected promise. On the web (dev,
 * browser) there is nothing to control, so wrappers built on this stay platform-agnostic for callers.
 */
export function callNative(call: () => Promise<unknown>): void {
  if (!Capacitor.isNativePlatform()) return;
  call().catch(() => {});
}
