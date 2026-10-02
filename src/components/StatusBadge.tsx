import { useEffect, useState, type CSSProperties } from "react";
import { t } from "../i18n";
import { colors } from "../theme";
import type { ConnectionStatus } from "../ws/connection";

/** A reconnect that finishes within this time shows nothing at all (a normal socket swap is not worth a flash). */
const SHOW_AFTER_MS = 400;

const badgeStyle: CSSProperties = {
  position: "fixed",
  top: "max(10px, env(safe-area-inset-top, 0px))",
  right: "max(10px, env(safe-area-inset-right, 0px))",
  zIndex: 100,
  fontSize: 11,
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(0,0,0,.6)",
  color: colors.warning,
};

/**
 * Connection indicator shown over the deck while it is not live. The deck is only mounted this way while the app keeps trying, so it
 * says so calmly, and only after a short delay. The delay starts when the badge appears and is not restarted by the retries.
 */
export function StatusBadge({ usingCache }: { status?: ConnectionStatus; usingCache: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  const label = usingCache ? t("badge.reconnectingCached") : t("badge.reconnecting");
  return (
    <div role="status" style={badgeStyle}>
      {label}
    </div>
  );
}
