import type { CSSProperties } from "react";
import { t } from "../i18n";
import { colors, monoFont, sectionLabelStyle, selectedTint } from "../theme";
import type { AutoSwitchInfo, ProfileSummary } from "../ws/connection";
import { SettingsButton } from "./SettingsScreen";

const LOCK_ON_COLOR = colors.danger;

const backdropStyle = (open: boolean): CSSProperties => ({
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.5)",
  zIndex: 100,
  opacity: open ? 1 : 0,
  pointerEvents: open ? "auto" : "none",
  transition: "opacity .2s ease",
});
// On the right, not the left — the left edge is Android gesture-nav's own back-swipe zone.
const panelStyle = (open: boolean): CSSProperties => ({
  position: "fixed",
  top: 0,
  bottom: 0,
  right: 0,
  width: "78%",
  maxWidth: 300,
  zIndex: 101,
  background: colors.surface,
  borderLeft: `1px solid ${colors.border}`,
  boxSizing: "border-box",
  padding: "max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px)) 16px",
  transform: open ? "translateX(0)" : "translateX(100%)",
  transition: "transform .2s ease",
  display: "flex",
  flexDirection: "column",
  gap: 4,
});
const headerStyle: CSSProperties = { display: "flex", alignItems: "center", padding: "4px 10px 12px" };
const spacerStyle: CSSProperties = { flex: 1 };
const serversLabelStyle: CSSProperties = { ...sectionLabelStyle, padding: "16px 10px 6px" };
const rowBase: CSSProperties = { textAlign: "left", borderRadius: 8, border: "none", cursor: "pointer" };
const profileRowStyle = (selected: boolean): CSSProperties => ({
  ...rowBase,
  display: "block",
  width: "100%",
  padding: "12px 10px",
  fontSize: 15,
  background: selected ? selectedTint : "transparent",
  color: selected ? colors.accentText : colors.text,
});
const serverLineStyle: CSSProperties = { display: "flex", alignItems: "center" };
const serverRowStyle = (selected: boolean): CSSProperties => ({
  ...rowBase,
  flex: 1,
  minWidth: 0,
  padding: "10px",
  fontSize: 13,
  fontFamily: monoFont,
  overflow: "hidden",
  textOverflow: "ellipsis",
  background: selected ? selectedTint : "transparent",
  color: selected ? colors.accentText : colors.text,
});
const updateRowStyle: CSSProperties = {
  ...rowBase,
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "12px 10px",
  fontSize: 14,
  marginBottom: 4,
  background: selectedTint,
  color: colors.accentText,
};
const updateDotStyle: CSSProperties = { width: 8, height: 8, borderRadius: "50%", background: colors.accent, flexShrink: 0 };
const forgetStyle: CSSProperties = { border: "none", background: "transparent", color: colors.textMuted, fontSize: 18, padding: "6px 10px", cursor: "pointer" };
const addServerStyle: CSSProperties = {
  ...rowBase,
  display: "block",
  width: "100%",
  padding: "10px",
  fontSize: 14,
  background: "transparent",
  color: colors.accentText,
};
const lockTrackStyle = (locked: boolean): CSSProperties => ({
  position: "relative",
  width: 48,
  height: 26,
  padding: 0,
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  background: locked ? LOCK_ON_COLOR : "#3a3f45",
  transition: "background .15s ease",
});
const lockKnobStyle = (locked: boolean): CSSProperties => ({
  position: "absolute",
  top: 3,
  left: locked ? 25 : 3,
  width: 20,
  height: 20,
  borderRadius: "50%",
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: locked ? LOCK_ON_COLOR : "#6b7280",
  transition: "left .15s ease, color .15s ease",
});

/** The auto-profile-switch lock: pauses following the active window while on. */
function AutoSwitchLock({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={locked}
      aria-label={t("drawer.lock")}
      onClick={onToggle}
      title={locked ? t("drawer.lock.on") : t("drawer.lock.off")}
      style={lockTrackStyle(locked)}
    >
      <span style={lockKnobStyle(locked)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="10" rx="2" fill="currentColor" stroke="none" />
          <path d={locked ? "M8 11V7a4 4 0 0 1 8 0v4" : "M8 11V7a4 4 0 0 1 7.5-2"} />
        </svg>
      </span>
    </button>
  );
}

interface ProfileDrawerProps {
  open: boolean;
  profiles: ProfileSummary[];
  currentProfileId: string;
  servers: string[];
  activeHost: string;
  onPickServer: (host: string) => void;
  onForgetServer: (host: string) => void;
  onAddServer: () => void;
  autoSwitch: AutoSwitchInfo | null;
  onToggleAutoSwitchLock: () => void;
  onClose: () => void;
  onPick: (id: string) => void;
  onOpenSettings: () => void;
  /** The newer version, or null. */
  updateVersion: string | null;
  onOpenUpdate: () => void;
}

/** Slide-in panel with the profile list, saved servers and the settings entry. */
export function ProfileDrawer({
  open,
  profiles,
  currentProfileId,
  servers,
  activeHost,
  onPickServer,
  onForgetServer,
  onAddServer,
  autoSwitch,
  onToggleAutoSwitchLock,
  onClose,
  onPick,
  onOpenSettings,
  updateVersion,
  onOpenUpdate,
}: ProfileDrawerProps) {
  return (
    <>
      <div onClick={onClose} style={backdropStyle(open)} />
      <div style={panelStyle(open)}>
        {updateVersion && (
          <button onClick={onOpenUpdate} aria-label={t("drawer.update.label")} style={updateRowStyle}>
            <span aria-hidden="true" style={updateDotStyle} />
            {t("drawer.update", updateVersion)}
          </button>
        )}
        <div style={headerStyle}>
          <span style={sectionLabelStyle}>{t("drawer.profiles")}</span>
          <div style={spacerStyle} />
          {autoSwitch?.enabled && <AutoSwitchLock locked={autoSwitch.locked} onToggle={onToggleAutoSwitchLock} />}
        </div>
        {profiles.map((p) => (
          <button key={p.id} onClick={() => onPick(p.id)} style={profileRowStyle(p.id === currentProfileId)}>
            {p.name}
          </button>
        ))}
        <div style={serversLabelStyle}>{t("drawer.servers")}</div>
        {servers.map((h) => (
          <div key={h} style={serverLineStyle}>
            <button onClick={() => onPickServer(h)} style={serverRowStyle(h === activeHost)}>
              {h}
            </button>
            {h !== activeHost && (
              <button
                onClick={() => window.confirm(t("drawer.forget.confirm", h)) && onForgetServer(h)}
                aria-label={t("drawer.forget.label", h)}
                style={forgetStyle}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button onClick={onAddServer} style={addServerStyle}>
          {t("drawer.addServer")}
        </button>
        <SettingsButton onOpen={onOpenSettings} />
      </div>
    </>
  );
}
