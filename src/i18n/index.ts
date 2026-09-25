import { readText, writeText } from "../storage/storage";
import { en } from "./en";
import { tr, type DictKey } from "./tr";

export type Language = "tr" | "en";
/** What the person chose in Settings: "auto" follows the phone's own language. */
export type LanguageSetting = "auto" | Language;

const LANGUAGE_KEY = "macro-grid.language";

/** The phone's own language: Turkish when it is Turkish, English otherwise. The WebView takes its locale from the system language. */
function detectLanguage(): Language {
  const preferred = typeof navigator === "undefined" ? "" : (navigator.languages?.[0] ?? navigator.language ?? "");
  return preferred.toLowerCase().startsWith("tr") ? "tr" : "en";
}

function loadSetting(): LanguageSetting {
  const stored = readText(LANGUAGE_KEY);
  return stored === "tr" || stored === "en" ? stored : "auto";
}

const resolve = (setting: LanguageSetting): Language => (setting === "auto" ? detectLanguage() : setting);

let setting: LanguageSetting = loadSetting();
let current: Language = resolve(setting);
const listeners = new Set<() => void>();

const DICTIONARIES: Record<Language, Record<string, string | ((...args: string[]) => string)>> = { tr, en };

export const getLanguage = (): Language => current;
export const getLanguageSetting = (): LanguageSetting => setting;

/** Changes the language at once and remembers the choice; whoever renders texts re-renders through `subscribeLanguage`. */
export function setLanguageSetting(next: LanguageSetting): void {
  setting = next;
  if (next === "auto") writeText(LANGUAGE_KEY, "auto");
  else writeText(LANGUAGE_KEY, next);
  current = resolve(next);
  if (typeof document !== "undefined") document.documentElement.lang = current;
  listeners.forEach((listener) => listener());
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Looks a translated text up; a function entry receives the arguments (for texts with a value in them). */
export function t(key: DictKey, ...args: string[]): string {
  const value = DICTIONARIES[current][key];
  return typeof value === "function" ? value(...args) : value;
}

export type { DictKey };
