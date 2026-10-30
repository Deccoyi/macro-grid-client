import { useEffect, useState } from "react";
import { reportRunningWebSites } from "../native/widgetGuard";

/**
 * Write-ahead for web pages: the `web:<host>` ids wanted live are written to the phone (together with the plugins that are live), and only the ids
 * the phone has confirmed may be mounted. A site that is not confirmed yet draws its placeholder, so a crash while it loads can always be blamed on it.
 * `ready` is false until the phone has said what to keep off.
 */
export function useConfirmedWebSites(wanted: readonly string[], ready: boolean): ReadonlySet<string> {
  const key = [...new Set(wanted)].sort().join("\n");
  const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const ids = key ? key.split("\n") : [];
    void reportRunningWebSites(ids).then(() => {
      if (!cancelled) setConfirmed(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, [key, ready]);
  return confirmed;
}
