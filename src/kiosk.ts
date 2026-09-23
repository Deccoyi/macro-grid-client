import { Capacitor, registerPlugin } from "@capacitor/core";

interface KioskPlugin {
  setImmersive(opts: { enabled: boolean }): Promise<void>;
}

const Kiosk = registerPlugin<KioskPlugin>("Kiosk");

/** Hides the status/navigation bars (see KioskPlugin.java). No-ops on web — there's nothing to hide, and
 * the browser chrome isn't ours to touch anyway. */
export function setImmersive(enabled: boolean): void {
  if (!Capacitor.isNativePlatform()) return;
  Kiosk.setImmersive({ enabled }).catch(() => {});
}
