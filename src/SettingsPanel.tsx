import type { CSSProperties } from "react";
import { t } from "./i18n";
import type { AppSettings, OrientationSetting } from "./storage/settings";

/** The gear button at the bottom of the profile drawer — settings are deliberately tucked in there
 * rather than getting their own always-visible entry point, since kiosk mode/orientation lock are a
 * one-time-per-setup choice, not something touched during normal use. */
export function SettingsButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
        padding: "12px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14,
        background: "transparent", color: "#9aa0a8", marginTop: "auto",
      }}
    >
      <GearIcon /> {t("settings.title")}
    </button>
  );
}

export function SettingsPanel({
  open,
  settings,
  onChange,
  onClose,
}: {
  open: boolean;
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 200,
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .2s ease",
        }}
      />
      <div
        style={{
          position: "fixed", left: "50%", top: "50%", zIndex: 201, width: "min(88vw, 320px)",
          transform: open ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(.96)",
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .15s ease, transform .15s ease",
          background: "#16181c", border: "1px solid #2d3136", borderRadius: 12, padding: 20,
          boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16,
        }}
      >
        <div style={{ color: "#e6e7ea", fontSize: 15, fontWeight: 600 }}>{t("settings.title")}</div>

        <label style={rowStyle}>
          <div>
            <div style={labelStyle}>{t("settings.kiosk")}</div>
            <div style={hintStyle}>{t("settings.kiosk.hint")}</div>
          </div>
          <Switch checked={settings.kiosk} onChange={(kiosk) => onChange({ ...settings, kiosk })} />
        </label>

        <div>
          <div style={labelStyle}>{t("settings.orientation")}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {(["auto", "portrait", "landscape"] as OrientationSetting[]).map((o) => (
              <button
                key={o}
                onClick={() => onChange({ ...settings, orientation: o })}
                style={{
                  flex: 1, padding: "8px 6px", fontSize: 12.5, borderRadius: 8, cursor: "pointer",
                  border: "1px solid #2d3136",
                  background: settings.orientation === o ? "rgba(59,130,246,.18)" : "transparent",
                  color: settings.orientation === o ? "#60a5fa" : "#e6e7ea",
                }}
              >
                {o === "auto" ? t("settings.orientation.auto") : o === "portrait" ? t("settings.orientation.portrait") : t("settings.orientation.landscape")}
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...hintStyle, maxWidth: "none", lineHeight: 1.45, borderTop: "1px solid #2d3136", paddingTop: 12 }}>
          {t("settings.disclaimer")}
        </div>

        <button
          onClick={onClose}
          style={{
            padding: "10px 0", fontSize: 14, borderRadius: 8, border: "1px solid #2d3136",
            background: "transparent", color: "#e6e7ea", cursor: "pointer", marginTop: 4,
          }}
        >
          {t("settings.close")}
        </button>
      </div>
    </>
  );
}

const rowStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer" };
const labelStyle: CSSProperties = { color: "#e6e7ea", fontSize: 14 };
const hintStyle: CSSProperties = { color: "#9aa0a8", fontSize: 11.5, marginTop: 2, maxWidth: 200 };

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 42, height: 24, borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0,
        background: checked ? "#3b82f6" : "#2d3136", position: "relative", transition: "background .15s ease",
      }}
    >
      <span
        style={{
          position: "absolute", top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: "50%",
          background: "white", transition: "left .15s ease",
        }}
      />
    </button>
  );
}

function GearIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
