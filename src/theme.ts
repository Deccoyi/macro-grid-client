import type { CSSProperties } from "react";

/** Palette and shared style fragments for the phone UI (dark only). */
export const colors = {
  background: "#0b0d10",
  surface: "#16181c",
  border: "#2d3136",
  text: "#e6e7ea",
  textMuted: "#9aa0a8",
  accent: "#3b82f6",
  accentText: "#60a5fa",
  danger: "#ef4444",
  warning: "#facc15",
} as const;

export const monoFont = "ui-monospace, monospace";

/** Small uppercase caption above a group of rows (profiles, servers, saved servers). */
export const sectionLabelStyle: CSSProperties = {
  color: colors.textMuted,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

/** Selected-row tint used in the drawer lists. */
export const selectedTint = "rgba(59,130,246,.18)";
