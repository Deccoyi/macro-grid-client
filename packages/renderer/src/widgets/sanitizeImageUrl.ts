const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "data:"]);

/**
 * Guards a widget-supplied image URL (icon or image `src`, both sent by the server and
 * therefore untrusted) before it is assigned to an <img> element: only http(s) and
 * data:image/ URIs are allowed, rejecting `javascript:` and other schemes that could
 * execute script or redirect the page. Must be called directly in the same condition
 * that renders the <img>, alongside the original value, so static analysis can see the
 * check guarding the sink.
 */
export function isSafeImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
  if (parsed.protocol === "data:" && !/^data:image\//i.test(trimmed)) return false;
  return true;
}

/**
 * Validates a widget-supplied image URL once, where it enters the renderer, and returns the trimmed
 * string to pass down (or undefined when it is refused), so components never receive an unchecked value.
 */
export function safeImageUrl(url: string | undefined): string | undefined {
  if (!url || !isSafeImageUrl(url)) return undefined;
  const parsed = new URL(url.trim());
  return ALLOWED_PROTOCOLS.has(parsed.protocol) ? parsed.href : undefined;
}
