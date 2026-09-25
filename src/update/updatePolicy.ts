import { compareVersions, parseVersion, versionCore, versionToString, type ReleaseVersion } from "./releaseVersion";
import type { UpdateOffer } from "./releaseFeed";
import type { UpdateState } from "./updateState";

/** How often the app looks for a release while it is open (the phone often stands as a deck with the app open for hours). */
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** "Later": the update screen does not open by itself for this long. */
export const SNOOZE_MS = 24 * 60 * 60 * 1000;
/** The first check after the app starts waits a little so it never competes with the first connection. */
export const FIRST_CHECK_DELAY_MS = 30 * 1000;

/** True when the last successful check is older than the interval. `now` is injected so tests need no clock. */
export function isCheckDue(state: UpdateState, now: number): boolean {
  return now - state.lastCheckAt >= CHECK_INTERVAL_MS || state.lastCheckAt > now;
}

/**
 * Whether the update screen opens by itself: only at a cold start, only once per version, not while snoozed or skipped, and only when
 * the person has not turned the automatic check off. (While the deck is in use it never opens by itself: a dialog over a live deck
 * is the interruption this app avoids; the drawer row and the dot wait for a tap.)
 */
export function shouldOpenByItself(
  offer: UpdateOffer | null,
  state: UpdateState,
  options: { autoCheckEnabled: boolean; coldStart: boolean; now: number },
): boolean {
  if (!offer || !options.autoCheckEnabled || !options.coldStart) return false;
  const version = versionToString(offer.latest.version);
  if (state.skippedVersion === version || state.announcedVersion === version) return false;
  return options.now >= state.snoozedUntil;
}

/** Later: snooze the automatic opening (the row and the dot stay). */
export function afterLater(state: UpdateState, now: number): UpdateState {
  return { ...state, snoozedUntil: now + SNOOZE_MS };
}

/** Skip this version: exactly that version is never opened by itself again; a newer one is offered as usual. */
export function afterSkip(state: UpdateState, offer: UpdateOffer): UpdateState {
  return { ...state, skippedVersion: versionToString(offer.latest.version) };
}

/** The screen opened by itself for this version. */
export function afterAnnounced(state: UpdateState, offer: UpdateOffer): UpdateState {
  return { ...state, announcedVersion: versionToString(offer.latest.version) };
}

/** The version to say "Updated to X" for, once: the running version when it is newer than the one that ran last time. */
export function updatedTo(state: UpdateState, running: ReleaseVersion): string | null {
  const previous = parseVersion(state.lastRunVersion);
  // A first run, the same version, or a downgrade by hand is not an update.
  return previous && compareVersions(running, previous) > 0 ? versionToString(running) : null;
}

/**
 * The version whose downloaded APK may stay on the phone: the offered one while it is newer than the running version, otherwise none
 * (then the clean-up removes every download). At most one download is ever kept.
 */
export function versionToKeep(offer: UpdateOffer | null): string | null {
  return offer && offer.latest.apk ? versionCore(offer.latest.version) : null;
}
