const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "data:"]);

/**
 * Restricts a widget-supplied image URL (icon or image `src`, both sent by the server and
 * therefore untrusted) to http(s) and data: URIs, rejecting `javascript:` and other schemes
 * that could execute script or redirect the page when assigned to an <img> element.
 */
export function sanitizeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return undefined;
  if (parsed.protocol === "data:" && !/^data:image\//i.test(trimmed)) return undefined;
  return trimmed;
}
