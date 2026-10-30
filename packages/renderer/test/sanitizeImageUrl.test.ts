import { describe, expect, it } from "vitest";
import { isSafeImageUrl, safeImageUrl } from "../src/widgets/sanitizeImageUrl";

describe("image URL guard", () => {
  it.each(["https://example.com/a.png", "http://example.com/a.png", "data:image/svg+xml;utf8,<svg/>", "HTTPS://example.com/a.png", "Data:Image/PNG;base64,AAAA"])("allows %s", (url) => {
    expect(isSafeImageUrl(url)).toBe(true);
    expect(safeImageUrl(url)).toBe(new URL(url).href);
  });

  it.each(["javascript:alert(1)", "JaVaScRiPt:alert(1)", "  javascript:alert(1)", "\tjava\nscript:alert(1)", "vbscript:msgbox(1)", "VBScript:msgbox(1)", "DATA:text/html,<script>1</script>", "data:application/javascript,1", "data:text/html,<script>1</script>", "file:///etc/passwd", "ftp://example.com/a.png", "//example.com/a.png", "", "not a url"])("refuses %s", (url) => {
    expect(isSafeImageUrl(url)).toBe(false);
    expect(safeImageUrl(url)).toBeUndefined();
  });

  it("refuses an undefined value", () => {
    expect(safeImageUrl(undefined)).toBeUndefined();
    expect(safeImageUrl("  https://example.com/a.png ")).toBe("https://example.com/a.png");
  });
});
