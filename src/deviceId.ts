const KEY = "macro-station.deviceId";

/** A stable per-install id so the server can recognize this device across reconnects (and, once
 * Stage 5's pairing lands, tie it to an assigned profile/token). Generated once, kept in localStorage. */
export function getDeviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
