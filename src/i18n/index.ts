import { en } from "./en";
import { tr, type DictKey } from "./tr";

export type Language = "tr" | "en";

/** The phone speaks Turkish when the phone's own language is Turkish and English otherwise. Read once at
 * start-up: the WebView takes its locale from the system language, and a language change restarts the app anyway. */
export const language: Language = detectLanguage();

function detectLanguage(): Language {
  const preferred = typeof navigator === "undefined" ? "" : (navigator.languages?.[0] ?? navigator.language ?? "");
  return preferred.toLowerCase().startsWith("tr") ? "tr" : "en";
}

const DICT: Record<string, string | ((...args: string[]) => string)> = language === "tr" ? tr : en;

/** Looks a translated text up; a function entry receives the arguments (for texts with a value in them). */
export function t(key: DictKey, ...args: string[]): string {
  const value = DICT[key];
  return typeof value === "function" ? value(...args) : value;
}

export type { DictKey };
