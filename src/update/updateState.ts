import { readJson, writeJson } from "../storage/storage";

/**
 * What the updater remembers between runs. Kept under its own key, apart from `macro-grid.settings`, so saving the settings never
 * overwrites it (the server keeps its update state apart from its preferences for the same reason).
 */
export interface UpdateState {
  /** ETag of the last releases list, sent back as If-None-Match (an unchanged list is a 304). */
  etag: string | null;
  /** The last releases list as received, used when the answer is a 304 and to know at start-up which download may stay. */
  releasesJson: string | null;
  /** When the last check succeeded (ms since the epoch). */
  lastCheckAt: number;
  /** The update screen does not open by itself before this time (the person chose Later). */
  snoozedUntil: number;
  /** The version the person skipped: never opened by itself again. */
  skippedVersion: string | null;
  /** The version the update screen already opened for by itself (once per version). */
  announcedVersion: string | null;
  /** The version that ran last time, to say "Updated to X" once after an update. */
  lastRunVersion: string | null;
}

const KEY = "macro-grid.update";

export const EMPTY_UPDATE_STATE: UpdateState = {
  etag: null,
  releasesJson: null,
  lastCheckAt: 0,
  snoozedUntil: 0,
  skippedVersion: null,
  announcedVersion: null,
  lastRunVersion: null,
};

export function loadUpdateState(): UpdateState {
  const stored = readJson<Partial<UpdateState> | null>(KEY, null);
  if (!stored || typeof stored !== "object") return EMPTY_UPDATE_STATE;
  const text = (value: unknown) => (typeof value === "string" ? value : null);
  const time = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  return {
    etag: text(stored.etag),
    releasesJson: text(stored.releasesJson),
    lastCheckAt: time(stored.lastCheckAt),
    snoozedUntil: time(stored.snoozedUntil),
    skippedVersion: text(stored.skippedVersion),
    announcedVersion: text(stored.announcedVersion),
    lastRunVersion: text(stored.lastRunVersion),
  };
}

export function saveUpdateState(state: UpdateState): void {
  // Best effort like every other stored value; the worst case is one more check or one more announcement.
  writeJson(KEY, state);
}
