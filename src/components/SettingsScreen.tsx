import type { CSSProperties } from "react";
import { setLanguageSetting, t, type LanguageSetting } from "../i18n";
import { useBackToClose } from "../hooks/useBackToClose";
import { useLanguage } from "../hooks/useLanguage";
import type { UpdateController } from "../hooks/useUpdate";
import type { AppSettings, OrientationSetting, UpdateNetworkSetting } from "../storage/settings";
import { versionToString } from "../update/releaseVersion";
import { colors, sectionLabelStyle, selectedTint } from "../theme";

const ORIENTATIONS: OrientationSetting[] = ["auto", "portrait", "landscape"];
const ORIENTATION_LABEL_KEYS = {
  auto: "settings.orientation.auto",
  portrait: "settings.orientation.portrait",
  landscape: "settings.orientation.landscape",
} as const;
const LANGUAGES: LanguageSetting[] = ["auto", "tr", "en"];
const LANGUAGE_LABEL_KEYS = { auto: "settings.language.auto", tr: "settings.language.tr", en: "settings.language.en" } as const;
const NETWORKS: UpdateNetworkSetting[] = ["wifi", "any"];
const NETWORK_LABEL_KEYS = { wifi: "settings.updates.network.wifi", any: "settings.updates.network.any" } as const;

const settingsButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  textAlign: "left",
  padding: "12px 10px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  fontSize: 14,
  background: "transparent",
  color: colors.textMuted,
  marginTop: "auto",
};
const pageStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 250,
  background: colors.background,
  color: colors.text,
  display: "flex",
  flexDirection: "column",
};
const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "max(8px, env(safe-area-inset-top, 0px)) max(8px, env(safe-area-inset-right, 0px)) 8px max(8px, env(safe-area-inset-left, 0px))",
  borderBottom: `1px solid ${colors.border}`,
  background: colors.surface,
};
const backStyle: CSSProperties = { width: 44, height: 44, border: "none", background: "transparent", color: colors.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
const titleStyle: CSSProperties = { fontSize: 17, fontWeight: 600 };
const bodyStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "8px max(16px, env(safe-area-inset-right, 0px)) max(24px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))",
  maxWidth: 640,
  width: "100%",
  boxSizing: "border-box",
  margin: "0 auto",
};
const sectionStyle: CSSProperties = { ...sectionLabelStyle, padding: "20px 0 4px" };
const rowStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: `1px solid ${colors.border}`, cursor: "pointer" };
const blockStyle: CSSProperties = { padding: "12px 0", borderBottom: `1px solid ${colors.border}` };
const labelStyle: CSSProperties = { color: colors.text, fontSize: 15 };
const hintStyle: CSSProperties = { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 1.4 };
const statusStyle: CSSProperties = { color: colors.textMuted, fontSize: 13, marginTop: 8 };
const segmentRowStyle: CSSProperties = { display: "flex", gap: 6, marginTop: 8 };
const segmentStyle = (selected: boolean): CSSProperties => ({
  flex: 1,
  minHeight: 40,
  padding: "8px 6px",
  fontSize: 13,
  borderRadius: 8,
  cursor: "pointer",
  border: `1px solid ${colors.border}`,
  background: selected ? selectedTint : "transparent",
  color: selected ? colors.accentText : colors.text,
});
const actionButtonStyle: CSSProperties = { minHeight: 40, padding: "8px 14px", fontSize: 14, borderRadius: 8, cursor: "pointer", border: `1px solid ${colors.border}`, background: "transparent", color: colors.text };
const disclaimerStyle: CSSProperties = { ...hintStyle, padding: "12px 0" };
const switchTrackStyle = (checked: boolean): CSSProperties => ({
  width: 42,
  height: 24,
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  flexShrink: 0,
  background: checked ? colors.accent : colors.border,
  position: "relative",
  transition: "background .15s ease",
});
const switchKnobStyle = (checked: boolean): CSSProperties => ({
  position: "absolute",
  top: 3,
  left: checked ? 21 : 3,
  width: 18,
  height: 18,
  borderRadius: "50%",
  background: "white",
  transition: "left .15s ease",
});

/** The gear button at the bottom of the profile drawer — settings are deliberately tucked in there rather than getting their own
 * always-visible entry point, since they are a one-time-per-setup choice, not something touched during normal use. */
export function SettingsButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button onClick={onOpen} style={settingsButtonStyle}>
      <GearIcon /> {t("settings.title")}
    </button>
  );
}

interface SettingsScreenProps {
  open: boolean;
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onClose: () => void;
  update: UpdateController;
}

/** The full-screen settings page: display, updates and the about text. A list of rows, not a stack of cards. */
export function SettingsScreen({ open, settings, onChange, onClose, update }: SettingsScreenProps) {
  useBackToClose(open, onClose);
  const { setting: languageSetting } = useLanguage();
  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={t("settings.title")} style={pageStyle}>
      <div style={headerStyle}>
        <button onClick={onClose} aria-label={t("settings.close")} style={backStyle}>
          <BackIcon />
        </button>
        <span style={titleStyle}>{t("settings.title")}</span>
      </div>

      <div style={bodyStyle}>
        <div style={sectionStyle}>{t("settings.section.display")}</div>
        <label style={rowStyle}>
          <div>
            <div style={labelStyle}>{t("settings.kiosk")}</div>
            <div style={hintStyle}>{t("settings.kiosk.hint")}</div>
          </div>
          <Switch checked={settings.kiosk} onChange={(kiosk) => onChange({ ...settings, kiosk })} />
        </label>
        <div style={blockStyle}>
          <div style={labelStyle}>{t("settings.orientation")}</div>
          <div style={segmentRowStyle}>
            {ORIENTATIONS.map((o) => (
              <button key={o} onClick={() => onChange({ ...settings, orientation: o })} style={segmentStyle(settings.orientation === o)}>
                {t(ORIENTATION_LABEL_KEYS[o])}
              </button>
            ))}
          </div>
        </div>

        <div style={sectionStyle}>{t("settings.section.language")}</div>
        <div style={blockStyle}>
          <div style={segmentRowStyle}>
            {LANGUAGES.map((l) => (
              <button key={l} onClick={() => setLanguageSetting(l)} style={segmentStyle(languageSetting === l)}>
                {t(LANGUAGE_LABEL_KEYS[l])}
              </button>
            ))}
          </div>
          <div style={hintStyle}>{t("settings.language.hint")}</div>
        </div>

        <div style={sectionStyle}>{t("settings.section.updates")}</div>
        <div style={blockStyle}>
          <div style={labelStyle}>{t("settings.version", update.runningVersion)}</div>
        </div>
        {update.available ? (
          <>
            <label style={rowStyle}>
              <div>
                <div style={labelStyle}>{t("settings.updates.auto")}</div>
                <div style={hintStyle}>{t("settings.updates.auto.hint")}</div>
              </div>
              <Switch checked={settings.checkForUpdates} onChange={(checkForUpdates) => onChange({ ...settings, checkForUpdates })} />
            </label>
            <label style={rowStyle}>
              <div>
                <div style={labelStyle}>{t("settings.updates.pre")}</div>
                <div style={hintStyle}>{t("settings.updates.pre.hint")}</div>
              </div>
              <Switch checked={settings.includePreReleases} onChange={(includePreReleases) => onChange({ ...settings, includePreReleases })} />
            </label>
            <div style={blockStyle}>
              <div style={labelStyle}>{t("settings.updates.network")}</div>
              <div style={segmentRowStyle}>
                {NETWORKS.map((n) => (
                  <button key={n} onClick={() => onChange({ ...settings, updateNetwork: n })} style={segmentStyle(settings.updateNetwork === n)}>
                    {t(NETWORK_LABEL_KEYS[n])}
                  </button>
                ))}
              </div>
              <div style={hintStyle}>{t("settings.updates.network.hint")}</div>
            </div>
            <div style={blockStyle}>
              <button onClick={update.checkNow} disabled={update.checking} style={actionButtonStyle}>
                {update.checking ? t("settings.updates.checking") : t("settings.updates.check")}
              </button>
              <CheckStatus update={update} />
            </div>
          </>
        ) : (
          <div style={blockStyle}>
            <div style={hintStyle}>{t("settings.updates.webOnly")}</div>
          </div>
        )}

        <div style={sectionStyle}>{t("settings.section.about")}</div>
        <div style={disclaimerStyle}>{t("settings.disclaimer")}</div>
      </div>
    </div>
  );
}

/** The result of the last manual check, or the new version when there is one (a manual check also opens the update screen itself). */
function CheckStatus({ update }: { update: UpdateController }) {
  if (update.checking) return null;
  if (update.lastCheck === "failed") return <div style={statusStyle}>{t("settings.updates.failed")}</div>;
  if (update.offer) {
    return (
      <div style={{ ...statusStyle, display: "flex", alignItems: "center", gap: 10 }}>
        <span>{t("settings.updates.available", versionToString(update.offer.latest.version))}</span>
        <button onClick={update.openScreen} style={{ ...actionButtonStyle, minHeight: 32, padding: "4px 12px" }}>
          {t("settings.updates.show")}
        </button>
      </div>
    );
  }
  if (update.lastCheck === "upToDate") return <div style={statusStyle}>{t("settings.updates.upToDate")}</div>;
  return null;
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={(e) => { e.preventDefault(); onChange(!checked); }} style={switchTrackStyle(checked)}>
      <span style={switchKnobStyle(checked)} />
    </button>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
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
