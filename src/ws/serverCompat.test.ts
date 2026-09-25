import { describe, expect, it } from "vitest";
import { checkServerVersion } from "./serverCompat";

describe("checkServerVersion", () => {
  it.each([
    ["1.0.0", "1.0.0", "ok"],
    ["1.4.2", "1.0.0", "ok"],
    ["1.3.4", "1.3.0", "ok"],
    ["1.0.0-beta", "1.0.0", "ok"], // a label is ignored
    ["1.2.5", "1.3.0", "server-too-old"],
    ["1.3.0", "1.3.1", "server-too-old"],
    ["0.3.2", "1.0.0", "server-too-old"], // a server from before the shared version
    ["2.0.0", "1.3.0", "app-too-old"],
  ])("server %s, app needs %s: %s", (server, required, expected) => {
    expect(checkServerVersion(server, required)).toBe(expected);
  });

  it("never warns about a version it cannot read", () => {
    expect(checkServerVersion("", "1.0.0")).toBe("ok");
    expect(checkServerVersion("dev", "1.0.0")).toBe("ok");
    expect(checkServerVersion("1.0.0", "")).toBe("ok");
  });
});
