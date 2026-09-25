import { useEffect, type CSSProperties } from "react";
import { colors } from "../theme";

const toastStyle: CSSProperties = {
  position: "fixed",
  left: "50%",
  bottom: "max(24px, env(safe-area-inset-bottom, 0px))",
  transform: "translateX(-50%)",
  maxWidth: "min(420px, calc(100vw - 32px))",
  padding: "10px 16px",
  borderRadius: 10,
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  color: colors.text,
  fontSize: 13,
  lineHeight: 1.4,
  boxShadow: "0 4px 16px rgba(0,0,0,.4)",
  zIndex: 400,
};

/** A short neutral notice (for example "Macro Grid was updated to 0.2.0"). It goes away by itself. */
export function InfoToast({ message, onDone, durationMs = 6000 }: { message: string; onDone: () => void; durationMs?: number }) {
  useEffect(() => {
    const timer = setTimeout(onDone, durationMs);
    return () => clearTimeout(timer);
  }, [message, onDone, durationMs]);
  return (
    <div role="status" style={toastStyle}>
      {message}
    </div>
  );
}
