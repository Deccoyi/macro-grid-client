import { afterEach, describe, expect, it, vi } from "vitest";
import { getLanguage, getLanguageSetting, setLanguageSetting, subscribeLanguage, t } from "./index";

afterEach(() => {
  setLanguageSetting("auto");
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("language setting", () => {
  it("switches the texts at once and remembers the choice", () => {
    setLanguageSetting("tr");
    expect(getLanguage()).toBe("tr");
    expect(t("settings.title")).toBe("Ayarlar");
    expect(localStorage.getItem("macro-grid.language")).toBe("tr");

    setLanguageSetting("en");
    expect(getLanguage()).toBe("en");
    expect(t("settings.title")).toBe("Settings");
    expect(getLanguageSetting()).toBe("en");
  });

  it("follows the phone's language in automatic mode", () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["tr-TR"]);
    setLanguageSetting("auto");
    expect(getLanguage()).toBe("tr");

    vi.spyOn(navigator, "languages", "get").mockReturnValue(["de-DE"]);
    setLanguageSetting("auto");
    expect(getLanguage()).toBe("en");
  });

  it("tells listeners when the language changes, and stops after they unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLanguage(listener);
    setLanguageSetting("tr");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setLanguageSetting("en");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("passes arguments to texts that carry a value", () => {
    setLanguageSetting("en");
    expect(t("settings.version", "0.2.0")).toBe("Version 0.2.0");
    setLanguageSetting("tr");
    expect(t("settings.version", "0.2.0")).toBe("Sürüm 0.2.0");
  });
});
