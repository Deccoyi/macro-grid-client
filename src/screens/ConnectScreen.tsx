import { useState, type CSSProperties } from "react";
import { t } from "../i18n";
import { colors, monoFont, sectionLabelStyle } from "../theme";
import type { ConnectionStatus } from "../ws/connection";

const PIN_LENGTH = 6;

const screenStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  alignItems: "center",
  justifyContent: "center",
  width: "100vw",
  height: "100vh",
  background: colors.background,
  color: colors.text,
  fontFamily: "system-ui, sans-serif",
  padding:
    "max(24px, env(safe-area-inset-top, 0px)) max(24px, env(safe-area-inset-right, 0px)) max(24px, env(safe-area-inset-bottom, 0px)) max(24px, env(safe-area-inset-left, 0px))",
  boxSizing: "border-box",
};
const titleStyle: CSSProperties = { fontSize: 20, margin: 0 };
const hintStyle: CSSProperties = { color: colors.textMuted, fontSize: 13, textAlign: "center", margin: 0 };
const pairHintStyle: CSSProperties = { ...hintStyle, maxWidth: 320 };
const hostInputStyle: CSSProperties = {
  width: "100%",
  maxWidth: 320,
  padding: "10px 12px",
  fontSize: 16,
  borderRadius: 8,
  border: `1px solid ${colors.border}`,
  background: colors.surface,
  color: colors.text,
};
const buttonBase: CSSProperties = { padding: "10px 24px", fontSize: 15, borderRadius: 8 };
const primaryButtonStyle: CSSProperties = { ...buttonBase, border: "none", background: colors.accent, color: "white", cursor: "pointer" };
const secondaryButtonStyle: CSSProperties = {
  ...buttonBase,
  border: `1px solid ${colors.border}`,
  background: "transparent",
  color: colors.text,
  cursor: "pointer",
};
const savedListStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, width: "100%", maxWidth: 320, marginTop: 6 };
const savedServerStyle: CSSProperties = {
  padding: "10px 12px",
  fontSize: 14,
  borderRadius: 8,
  border: `1px solid ${colors.border}`,
  background: colors.surface,
  color: colors.text,
  cursor: "pointer",
  textAlign: "left",
  fontFamily: monoFont,
};
const cancelStyle: CSSProperties = { border: "none", background: "transparent", color: colors.textMuted, fontSize: 14, cursor: "pointer", padding: 8 };
const connectingStyle: CSSProperties = { color: colors.textMuted, fontSize: 12 };
const retryingStyle: CSSProperties = { color: colors.danger, fontSize: 12 };
const pinInputStyle: CSSProperties = {
  width: "100%",
  maxWidth: 200,
  padding: "10px 12px",
  fontSize: 28,
  borderRadius: 8,
  textAlign: "center",
  letterSpacing: ".2em",
  fontFamily: monoFont,
  border: `1px solid ${colors.border}`,
  background: colors.surface,
  color: colors.text,
};
const pairButtonStyle = (ready: boolean): CSSProperties => ({
  ...buttonBase,
  border: "none",
  background: ready ? colors.accent : colors.border,
  color: "white",
  cursor: ready ? "pointer" : "default",
});

interface ConnectScreenProps {
  host: string;
  status: ConnectionStatus;
  onHostChange: (v: string) => void;
  onConnect: () => void;
  onSubmitPin: (pin: string) => void;
  onScanQr: () => void;
  servers: string[];
  onPickServer: (host: string) => void;
  onCancel?: () => void;
}

/** Host entry, saved servers and QR scan; switches to the PIN prompt when the server asks to pair. */
export function ConnectScreen({ host, status, onHostChange, onConnect, onSubmitPin, onScanQr, servers, onPickServer, onCancel }: ConnectScreenProps) {
  const [pin, setPin] = useState("");
  const pairing = status === "pairing_required";
  const pinReady = pin.length === PIN_LENGTH;

  return (
    <div style={screenStyle}>
      <h1 style={titleStyle}>Macro Grid</h1>

      {!pairing && (
        <>
          <p style={hintStyle}>{t("connect.hint")}</p>
          <input
            value={host}
            onChange={(e) => onHostChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onConnect()}
            placeholder="192.168.1.20:9820"
            style={hostInputStyle}
          />
          <button onClick={onConnect} style={primaryButtonStyle}>
            {t("connect.button")}
          </button>
          <button onClick={onScanQr} style={secondaryButtonStyle}>
            {t("connect.scanQr")}
          </button>
          {servers.length > 0 && (
            <div style={savedListStyle}>
              <span style={sectionLabelStyle}>{t("connect.savedServers")}</span>
              {servers.map((h) => (
                <button key={h} onClick={() => onPickServer(h)} style={savedServerStyle}>
                  {h}
                </button>
              ))}
            </div>
          )}
          {onCancel && (
            <button onClick={onCancel} style={cancelStyle}>
              {t("connect.cancel")}
            </button>
          )}
          {status === "connecting" && <span style={connectingStyle}>{t("connect.connecting")}</span>}
          {status === "disconnected" && host && <span style={retryingStyle}>{t("connect.retrying")}</span>}
        </>
      )}

      {pairing && (
        <>
          <p style={pairHintStyle}>{t("connect.pairHint")}</p>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
            onKeyDown={(e) => e.key === "Enter" && pinReady && onSubmitPin(pin)}
            placeholder="000000"
            inputMode="numeric"
            autoFocus
            style={pinInputStyle}
          />
          <button onClick={() => onSubmitPin(pin)} disabled={!pinReady} style={pairButtonStyle(pinReady)}>
            {t("connect.pair")}
          </button>
        </>
      )}
    </div>
  );
}
