/**
 * Thin wrapper over localStorage. Storage can be unavailable (private mode, blocked) or full, and every
 * caller here treats it as a best-effort cache: reads fall back to a default, writes are dropped silently.
 * Keeping the try/catch in one place means the rest of the app never has to repeat it.
 */

/** Reads a string, or null when the key is missing or storage is unavailable. */
export function readText(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Writes a string; returns false when storage refused it (full or unavailable). */
export function writeText(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to remove if storage is unavailable.
  }
}

/** Reads and parses JSON; the fallback is returned for a missing key, corrupt JSON or unavailable storage. */
export function readJson<T>(key: string, fallback: T): T {
  const raw = readText(key);
  if (raw === null || raw === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  return writeText(key, JSON.stringify(value));
}
