import type { CSSProperties } from "react";
import { t } from "../i18n";
import { colors } from "../theme";
import type { ConnectionStatus } from "../ws/connection";

const badgeStyle: CSSProperties = {
  position: "fixed",
  top: "max(10px, env(safe-area-inset-top, 0px))",
  right: "max(10px, env(safe-area-inset-right, 0px))",
  zIndex: 100,
  fontSize: 11,
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(0,0,0,.6)",
};

/** Connection indicator shown over the deck while it is not live. */
export function StatusBadge({ status, usingCache }: { status: ConnectionStatus; usingCache: boolean }) {
  const label = status === "connecting" ? t("badge.connecting") : usingCache ? t("badge.offlineCached") : t("badge.offline");
  return <div style={{ ...badgeStyle, color: status === "connecting" ? colors.warning : colors.danger }}>{label}</div>;
}
