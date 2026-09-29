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
