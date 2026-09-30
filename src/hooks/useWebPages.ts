import { useEffect, useState } from "react";
import { webPagesSafe } from "../native/webPages";

/** Whether the phone's system WebView is new enough to show web pages safely; null until the native side has answered (no page is shown before that). */
export function useWebPagesSafe(): boolean | null {
  const [safe, setSafe] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    webPagesSafe().then((value) => {
      if (!cancelled) setSafe(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return safe;
}

/** True while the app is in the foreground. A page in the background only costs battery and memory, so it is unmounted then. */
export function useAppVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/** How long web pages stay loaded after the app goes to the background or the screen turns off. */
export const WEB_BACKGROUND_UNLOAD_MS = 30_000;

/** True while the app is in front, and for `ms` after it left: a short trip to another app does not reload a chat, a long one unloads it. */
export function useHeldTrue(value: boolean, ms: number): boolean {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    if (value) {
      setHeld(true);
      return;
    }
    const timer = setTimeout(() => setHeld(false), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return value || held;
}
