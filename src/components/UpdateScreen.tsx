import type { CSSProperties } from "react";
import { t } from "../i18n";
import type { UpdateController, UpdatePhase } from "../hooks/useUpdate";
import { versionToString } from "../update/releaseVersion";
import { colors } from "../theme";
import { ReleaseNotes } from "./ReleaseNotes";

const screenStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 300,
  background: colors.background,
  color: colors.text,
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
  padding: "max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))",
  gap: 12,
};
const titleStyle: CSSProperties = { fontSize: 18, fontWeight: 600 };
const versionsStyle: CSSProperties = { color: colors.accentText, fontSize: 14, marginTop: 2 };
const notesLabelStyle: CSSProperties = { color: colors.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" };
const notesStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: "0 12px 12px",
  background: colors.surface,
};
const panelStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
const messageStyle: CSSProperties = { fontSize: 14, lineHeight: 1.45 };
const hintStyle: CSSProperties = { color: colors.textMuted, fontSize: 12, lineHeight: 1.45 };
const errorStyle: CSSProperties = { ...messageStyle, color: colors.warning };
const rowStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const buttonStyle = (primary: boolean): CSSProperties => ({
  flex: primary ? "1 1 100%" : "1 1 0",
  minHeight: 44,
  padding: "10px 12px",
  fontSize: 14,
  borderRadius: 8,
  cursor: "pointer",
  border: primary ? "none" : `1px solid ${colors.border}`,
  background: primary ? colors.accent : "transparent",
  color: primary ? "#fff" : colors.text,
});
const linkStyle: CSSProperties = { color: colors.accentText, fontSize: 13, alignSelf: "flex-start" };
const trackStyle: CSSProperties = { height: 8, borderRadius: 4, background: colors.border, overflow: "hidden" };
const fillStyle = (percent: number): CSSProperties => ({ width: `${percent}%`, height: "100%", background: colors.accent, transition: "width .2s ease" });

const formatMegabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * The update screen: the new version, the notes of every version in between, and what to do. The steps of "Update now" (Wi-Fi rule,
 * the mobile-data question, the one-time permission, Android's confirmation) show up here as they come, each with a sentence that says
 * why, so the person is never sent to an Android page without knowing the reason.
 */
export function UpdateScreen({ update }: { update: UpdateController }) {
  const { offer, phase } = update;
  if (!update.screenOpen || !offer) return null;
  const apk = offer.latest.apk;

  return (
    <div role="dialog" aria-modal="true" aria-label={t("update.title")} style={screenStyle}>
      <div>
        <div style={titleStyle}>{t("update.title")}</div>
        <div style={versionsStyle}>{t("update.versions", update.runningVersion, versionToString(offer.latest.version))}</div>
      </div>

      <div style={notesLabelStyle}>{t("update.notes")}</div>
      <div style={notesStyle}>
        <ReleaseNotes releases={offer.releases} />
      </div>

      <div style={panelStyle}>
        {!apk && <div style={hintStyle}>{t("update.noApk")}</div>}
        {apk && <PhasePanel phase={phase} update={update} sizeBytes={apk.size} />}
        {offer.latest.pageUrl && (
          <a href={offer.latest.pageUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
            {t("update.page")}
          </a>
        )}
      </div>
    </div>
  );
}

function PhasePanel({ phase, update, sizeBytes }: { phase: UpdatePhase; update: UpdateController; sizeBytes: number }) {
  switch (phase.kind) {
    case "waitingForWifi":
      return (
        <>
          <div style={messageStyle}>{t("update.wifi.text")}</div>
          <div style={rowStyle}>
            <button style={buttonStyle(true)} onClick={update.downloadOverMobileOnce}>
              {t("update.wifi.anyway")}
            </button>
            <button style={buttonStyle(false)} onClick={update.cancel}>
              {t("update.cancel")}
            </button>
            <button style={buttonStyle(false)} onClick={update.later}>
              {t("update.later")}
            </button>
          </div>
        </>
      );
    case "confirmMobile":
      return (
        <>
          <div style={messageStyle}>{t("update.mobile.confirm", formatMegabytes(sizeBytes))}</div>
          <div style={rowStyle}>
            <button style={buttonStyle(true)} onClick={update.confirmMobile}>
              {t("update.mobile.yes")}
            </button>
            <button style={buttonStyle(false)} onClick={update.cancel}>
              {t("update.cancel")}
            </button>
          </div>
        </>
      );
    case "downloading": {
      const percent = phase.total > 0 ? Math.min(100, Math.floor((phase.received / phase.total) * 100)) : 0;
      return (
        <>
          <div style={messageStyle}>{t("update.downloading", String(percent))}</div>
          <div style={trackStyle} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div style={fillStyle(percent)} />
          </div>
          <div style={rowStyle}>
            <button style={buttonStyle(false)} onClick={update.cancel}>
              {t("update.cancel")}
            </button>
          </div>
        </>
      );
    }
    case "needsPermission":
      return (
        <>
          <div style={{ ...messageStyle, fontWeight: 600 }}>{t("update.permission.title")}</div>
          <div style={messageStyle}>{t("update.permission.text")}</div>
          <div style={rowStyle}>
            <button style={buttonStyle(true)} onClick={update.continueToPermission}>
              {t("update.permission.continue")}
            </button>
            <button style={buttonStyle(false)} onClick={update.cancel}>
              {t("update.cancel")}
            </button>
          </div>
        </>
      );
    case "installing":
      return (
        <>
          <div style={messageStyle}>{t("update.installing")}</div>
          <div style={hintStyle}>{t("update.installHint")}</div>
        </>
      );
    case "error":
      return (
        <>
          <div style={errorStyle}>{t(`update.error.${phase.key}` as const)}</div>
          <div style={rowStyle}>
            {phase.key !== "signer" && (
              <button style={buttonStyle(true)} onClick={update.startUpdate}>
                {t("update.retry")}
              </button>
            )}
            <button style={buttonStyle(false)} onClick={update.later}>
              {t("update.later")}
            </button>
          </div>
        </>
      );
    default:
      return (
        <>
          <div style={rowStyle}>
            <button style={buttonStyle(true)} onClick={update.startUpdate}>
              {t("update.now")}
            </button>
            <button style={buttonStyle(false)} onClick={update.later}>
              {t("update.later")}
            </button>
            <button style={buttonStyle(false)} onClick={update.skip}>
              {t("update.skip")}
            </button>
          </div>
          <div style={hintStyle}>{t("update.installHint")}</div>
        </>
      );
  }
}
