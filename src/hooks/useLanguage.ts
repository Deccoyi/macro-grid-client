import { useSyncExternalStore } from "react";
import { getLanguage, getLanguageSetting, subscribeLanguage, type Language, type LanguageSetting } from "../i18n";

/**
 * Re-renders the component that calls it when the language changes. Call it once near the root (App): every screen below re-renders
 * with it and reads its texts through `t()` again. Returns the language in use and what the person chose.
 */
export function useLanguage(): { language: Language; setting: LanguageSetting } {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage);
  const setting = useSyncExternalStore(subscribeLanguage, getLanguageSetting);
  return { language, setting };
}
