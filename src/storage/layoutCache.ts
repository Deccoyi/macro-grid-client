import type { Profile } from "@macro/renderer";
import { resolveAssetRefs } from "../ws/assets";
import { layoutCacheKey } from "./keys";
import { readJson, writeJson } from "./storage";

/** `profile` still carries compact `asset:` references (icons live once each in the asset cache), so the
 * cache stays small however many widgets share an icon. It is resolved for display with resolveAssetRefs. */
export interface LayoutCache {
  profile: Profile;
  pageId: string;
}

export function loadLayoutCache(host: string): LayoutCache | null {
  if (!host) return null;
  return readJson<LayoutCache | null>(layoutCacheKey(host), null);
}

export function resolveCachedProfile(cache: LayoutCache | null): Profile | null {
  return cache ? resolveAssetRefs(cache.profile) : null;
}

/** Best-effort: the cache is a nice-to-have, not essential (storage may be full or unavailable). */
export function saveLayoutCache(host: string, profile: Profile, pageId: string): void {
  writeJson(layoutCacheKey(host), { profile, pageId } satisfies LayoutCache);
}
