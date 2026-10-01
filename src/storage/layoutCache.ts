import type { Profile } from "@macro/renderer";
import { resolveAssetRefs } from "../ws/assets";
import { perf } from "../perf/perfStats";
import { layoutCacheKey, layoutPageKey } from "./keys";
import { readJson, readText, removeItem, writeJson, writeText } from "./storage";

/** `profile` still carries compact `asset:` references (icons live once each in the asset cache), so the
 * cache stays small however many widgets share an icon. It is resolved for display with resolveAssetRefs. */
interface LayoutCache {
  profile: Profile;
  pageId: string;
}

export function loadLayoutCache(host: string): LayoutCache | null {
  if (!host) return null;
  const cache = readJson<LayoutCache | null>(layoutCacheKey(host), null);
  if (!cache) return null;
  // A page change only writes the page key; a cache written before that existed still carries its own page.
  const page = readText(layoutPageKey(host));
  return page ? { ...cache, pageId: page } : cache;
}

export function resolveCachedProfile(cache: LayoutCache | null): Profile | null {
  return cache ? resolveAssetRefs(cache.profile) : null;
}

/** Best-effort: the cache is a nice-to-have, not essential (storage may be full or unavailable). */
export function saveLayoutCache(host: string, profile: Profile, pageId: string): void {
  const value = { profile, pageId } satisfies LayoutCache;
  perf.timeCacheWrite(JSON.stringify(value).length, () => writeJson(layoutCacheKey(host), value));
  // The layout holds the page now, so an older page key must not override it.
  removeItem(layoutPageKey(host));
}

/** The shown page changed and the layout did not: write only the page. */
export function saveLayoutPage(host: string, pageId: string): void {
  writeText(layoutPageKey(host), pageId);
}
