const SERVERS_KEY = "macro-grid.servers";

/** Same keys App.tsx uses for per-host state — forgetting a server has to clear them too. */
const tokenKey = (host: string) => `macro-grid.token.${host}`;
const layoutCacheKey = (host: string) => `macro-grid.layoutCache.${host}`;

/** Every server this phone has successfully connected to, most recently used first. */
export function loadServers(): string[] {
  try {
    const raw = localStorage.getItem(SERVERS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === "string") : [];
  } catch {
    return [];
  }
}

function saveServers(servers: string[]): void {
  try {
    localStorage.setItem(SERVERS_KEY, JSON.stringify(servers));
  } catch {
    // Storage full or unavailable — the list is a convenience, the active host is stored separately.
  }
}

export function rememberServer(host: string): string[] {
  const next = [host, ...loadServers().filter((h) => h !== host)];
  saveServers(next);
  return next;
}

export function forgetServer(host: string): string[] {
  const next = loadServers().filter((h) => h !== host);
  saveServers(next);
  try {
    localStorage.removeItem(tokenKey(host));
    localStorage.removeItem(layoutCacheKey(host));
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
  return next;
}
