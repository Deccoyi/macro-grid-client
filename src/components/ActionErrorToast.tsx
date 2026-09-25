import type { CSSProperties } from "react";

const toastStyle: CSSProperties = {
  position: "fixed",
  left: "50%",
  bottom: "max(24px, env(safe-area-inset-bottom, 0px))",
  transform: "translateX(-50%)",
  maxWidth: "min(420px, calc(100vw - 32px))",
  padding: "10px 16px",
  borderRadius: 10,
  background: "rgba(127,29,29,.95)",
  color: "#fecaca",
  fontSize: 13,
  lineHeight: 1.4,
  boxShadow: "0 4px 16px rgba(0,0,0,.4)",
  zIndex: 200,
};

/** Transient error from a widget action that failed server-side. */
export function ActionErrorToast({ message }: { message: string }) {
  return <div style={toastStyle}>{message}</div>;
}
