import type { AppSettings } from "../storage/settings";

/** What the phone reports about itself; both values are approximate and may be missing. */
export interface DeviceHints {
  cores?: number;
  memoryGb?: number;
}

export interface LiveLimits {
  maxLive: number;
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
