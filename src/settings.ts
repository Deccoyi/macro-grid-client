import { ScreenOrientation } from "@capacitor/screen-orientation";
import { Capacitor } from "@capacitor/core";
import { setImmersive } from "./kiosk";
import { readJson, writeJson } from "./storage/storage";

export type OrientationSetting = "auto" | "portrait" | "landscape";

export interface AppSettings {
  kiosk: boolean;
  orientation: OrientationSetting;
}

const KEY = "macro-grid.settings";
const DEFAULTS: AppSettings = { kiosk: true, orientation: "auto" };

export function loadSettings(): AppSettings {
  const stored = readJson<Partial<AppSettings> | null>(KEY, null);
  return stored ? { ...DEFAULTS, ...stored } : DEFAULTS;
}

export function saveSettings(settings: AppSettings): void {
  // Best-effort; the toggle just resets to its default next launch if this fails.
  writeJson(KEY, settings);
  applySettings(settings);
}

/** Pushes kiosk/orientation to the OS. Called on every save, and once on app start so a relaunch picks
 * the last choice back up (Android doesn't remember `ScreenOrientation.lock`/immersive mode across a
 * cold start on its own). No-ops on web/iOS beyond what each underlying plugin itself no-ops. */
export function applySettings(settings: AppSettings): void {
  setImmersive(settings.kiosk);

  if (!Capacitor.isNativePlatform()) return;
  if (settings.orientation === "auto") {
    ScreenOrientation.unlock().catch(() => {});
  } else {
    ScreenOrientation.lock({ orientation: settings.orientation }).catch(() => {});
  }
}
