import { useEffect } from "react";
import { KeepAwake } from "@capacitor-community/keep-awake";

/**
 * Keeps the screen from sleeping while `active` is true. The phone is meant to sit as an always-on deck
 * while in use. Fails silently on platforms/browsers without the plugin (the web shim no-ops).
 */
export function useKeepAwake(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    KeepAwake.keepAwake().catch(() => {});
    return () => {
      KeepAwake.allowSleep().catch(() => {});
    };
  }, [active]);
}
