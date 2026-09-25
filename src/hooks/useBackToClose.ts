import { useEffect, useRef } from "react";

/**
 * Lets the Android back gesture close a full-screen page: while `open`, the page owns one browser history entry, so "back" pops it
 * (and calls `onClose`) instead of leaving the app. Closing the page by its own button removes the entry again.
 */
export function useBackToClose(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const marker = { macroGridPage: true };
    history.pushState(marker, "");
    const onPop = () => onCloseRef.current();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed by the page's own button: the entry is still ours, take it off. (After a real back it is already gone.)
      if ((history.state as { macroGridPage?: boolean } | null)?.macroGridPage) history.back();
    };
  }, [open]);
}
