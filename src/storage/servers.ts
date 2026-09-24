import { readJson, removeItem, writeJson } from "./storage";

const SERVERS_KEY = "macro-grid.servers";

/** Same keys App.tsx uses for per-host state — forgetting a server has to clear them too. */
const tokenKey = (host: string) => `macro-grid.token.${host}`;
const layoutCacheKey = (host: string) => `macro-grid.layoutCache.${host}`;

/** Every server this phone has successfully connected to, most recently used first. */
export function loadServers(): string[] {
  const parsed = readJson<unknown>(SERVERS_KEY, []);
  return Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === "string") : [];
}

/** Best-effort: the list is a convenience, the active host is stored separately. */
function saveServers(servers: string[]): void {
  writeJson(SERVERS_KEY, servers);
}

export function rememberServer(host: string): string[] {
  const next = [host, ...loadServers().filter((h) => h !== host)];
  saveServers(next);
  return next;
}

export function forgetServer(host: string): string[] {
  const next = loadServers().filter((h) => h !== host);
  saveServers(next);
  removeItem(tokenKey(host));
  removeItem(layoutCacheKey(host));
  return next;
}
