import type { AppSettings } from "../storage/settings";

/** What the phone reports about itself; both values are approximate and may be missing. */
export interface DeviceHints {
  cores?: number;
  memoryGb?: number;
}

export interface LiveLimits {
  /** How many plugin widgets run at once on this device. */
  maxLive: number;
  /** How many of them may belong to one plugin that is not verified. */
  maxLiveUnverified: number;
}

export function readDeviceHints(): DeviceHints {
  const nav = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { deviceMemory?: number });
  return { cores: nav?.hardwareConcurrency, memoryGb: nav?.deviceMemory };
}

/**
 * The starting point for how many plugin widgets may run at once, by how strong the phone is: a small phone gets few, a flagship phone or a tablet
 * gets more. It is only the default; the person can pick a number or no limit in Settings. The numbers are provisional until measured on real phones.
 */
export function autoLiveLimits(hints: DeviceHints = readDeviceHints()): LiveLimits {
  const cores = hints.cores && hints.cores > 0 ? hints.cores : 4;
  const memoryGb = hints.memoryGb && hints.memoryGb > 0 ? hints.memoryGb : 3;
  const maxLive = Math.min(8, Math.max(2, Math.floor(Math.min(cores, memoryGb * 2))));
  return { maxLive, maxLiveUnverified: Math.max(1, Math.floor(maxLive / 2)) };
}

/** The limits the runtime gets for the person's setting. A number the person chose is used for both, since they decided it. */
export function liveLimitsFor(settings: Pick<AppSettings, "pluginWidgetLimit" | "pluginWidgetLimitCount">, hints?: DeviceHints): LiveLimits {
  if (settings.pluginWidgetLimit === "none") return { maxLive: Infinity, maxLiveUnverified: Infinity };
  if (settings.pluginWidgetLimit === "custom") {
    const count = Math.max(1, Math.round(settings.pluginWidgetLimitCount));
    return { maxLive: count, maxLiveUnverified: count };
  }
  return autoLiveLimits(hints);
}

/**
 * The starting point for how many web widgets may be live at once. A page costs far more than a plugin widget's worker, so the numbers are small:
 * 1 on a small phone, up to 3 on a strong one. Only a recommendation; the person can pick a number or no limit in Settings. Provisional until measured.
 */
export function autoWebLimit(hints: DeviceHints = readDeviceHints()): number {
  const cores = hints.cores && hints.cores > 0 ? hints.cores : 4;
  const memoryGb = hints.memoryGb && hints.memoryGb > 0 ? hints.memoryGb : 3;
  if (memoryGb <= 2 || cores <= 4) return 1;
  if (memoryGb >= 6 && cores >= 8) return 3;
  return 2;
}

/** The number of live web widgets for the person's setting. */
export function webLimitFor(settings: Pick<AppSettings, "webWidgetLimit" | "webWidgetLimitCount">, hints?: DeviceHints): number {
  if (settings.webWidgetLimit === "none") return Infinity;
  if (settings.webWidgetLimit === "custom") return Math.max(1, Math.round(settings.webWidgetLimitCount));
  return autoWebLimit(hints);
}
