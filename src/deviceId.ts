import { readText, writeText } from "./storage/storage";

const KEY = "macro-grid.deviceId";

/** A stable per-install id so the server can recognize this device across reconnects (and, once
 * Stage 5's pairing lands, tie it to an assigned profile/token). Generated once, kept in localStorage. */
export function getDeviceId(): string {
  let id = readText(KEY);
  if (!id) {
    id = crypto.randomUUID();
    writeText(KEY, id);
  }
  return id;
}
