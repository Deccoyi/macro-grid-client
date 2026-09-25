import type { CSSProperties, ReactNode } from "react";
import { t } from "../i18n";
import type { ReleaseInfo } from "../update/releaseFeed";
import { versionToString } from "../update/releaseVersion";
import { colors } from "../theme";

const versionHeadingStyle: CSSProperties = { color: colors.text, fontSize: 14, fontWeight: 600, margin: "14px 0 6px" };
const headingStyle: CSSProperties = { color: colors.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", margin: "10px 0 4px" };
const itemStyle: CSSProperties = { display: "flex", gap: 8, color: colors.text, fontSize: 13.5, lineHeight: 1.45, margin: "3px 0" };
const paragraphStyle: CSSProperties = { color: colors.text, fontSize: 13.5, lineHeight: 1.45, margin: "4px 0" };
const mutedStyle: CSSProperties = { color: colors.textMuted, fontSize: 13, margin: "4px 0" };

/** "**Language:** text" → the bold part as a strong element; everything else stays text. Never HTML: a release body cannot inject markup. */
function inline(text: string): ReactNode[] {
  return text
    .replace(/`/g, "")
    .split("**")
    .map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part));
}

function Notes({ body }: { body: string }) {
  // Every release body ends with the same fixed footer after a "---" line (see docs/release-notes-footer.md); it is not a change, and
  // repeating it for each version would only bury the notes.
  const lines = body.split(/\r?\n/);
  const end = lines.findIndex((l) => l.trim() === "---");
  const out: ReactNode[] = [];
  (end === -1 ? lines : lines.slice(0, end)).forEach((raw, index) => {
    const line = raw.trim();
    if (line === "") return;
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (heading) out.push(<div key={index} style={headingStyle}>{inline(heading[1])}</div>);
    else if (item)
      out.push(
        <div key={index} style={itemStyle}>
          <span aria-hidden="true">•</span>
          <span>{inline(item[1])}</span>
        </div>,
      );
    else out.push(<p key={index} style={paragraphStyle}>{inline(line)}</p>);
  });
  return out.length > 0 ? <>{out}</> : <p style={mutedStyle}>{t("update.notes.none")}</p>;
}

/** The notes of every release between the installed version and the new one, newest first, as plain text with light formatting. */
export function ReleaseNotes({ releases }: { releases: ReleaseInfo[] }) {
  return (
    <div>
      {releases.map((release) => (
        <section key={release.tag}>
          <h3 style={versionHeadingStyle}>{versionToString(release.version)}</h3>
          <Notes body={release.body} />
        </section>
      ))}
    </div>
  );
}
