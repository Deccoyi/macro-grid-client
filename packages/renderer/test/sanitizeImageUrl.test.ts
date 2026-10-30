import { describe, expect, it } from "vitest";
import { isSafeImageUrl, safeImageUrl } from "../src/widgets/sanitizeImageUrl";

describe("image URL guard", () => {
  it.each(["https://example.com/a.png", "http://example.com/a.png", "data:image/svg+xml;utf8,<svg/>", "HTTPS://example.com/a.png"])("allows %s", (url) => {
    expect(isSafeImageUrl(url)).toBe(true);
    expect(safeImageUrl(url)).toBe(url);
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>1</script>", "file:///etc/passwd", "ftp://example.com/a.png", "//example.com/a.png", "", "not a url"])("refuses %s", (url) => {
    expect(isSafeImageUrl(url)).toBe(false);
    expect(safeImageUrl(url)).toBeUndefined();
  });

  it("refuses an undefined value and trims a padded one", () => {
    expect(safeImageUrl(undefined)).toBeUndefined();
    expect(safeImageUrl("  https://example.com/a.png ")).toBe("https://example.com/a.png");
  });
});
