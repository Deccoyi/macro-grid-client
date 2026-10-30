import { beforeEach, describe, expect, it, vi } from "vitest";

const setRunning = vi.fn<(o: { plugins: string[] }) => Promise<void>>();

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({ setRunning: (o: { plugins: string[] }) => setRunning(o) }),
}));

import { isWebGuardId, reportRunningPlugins, reportRunningWebSites, webGuardId } from "./widgetGuard";

describe("webGuardId", () => {
  it("keeps the host only, in lower case", () => {
    expect(webGuardId("https://Chat.Example.com/alerts?token=secret#x")).toBe("web:chat.example.com");
    expect(webGuardId("http://192.168.1.5:8080/panel")).toBe("web:192.168.1.5");
  });

  it("gives null for something with no host", () => {
    expect(webGuardId("not a url")).toBeNull();
    expect(webGuardId("")).toBeNull();
  });

  it("never lets a path or a token into the id", () => {
    expect(webGuardId("https://a.example.com/x/y?token=abc123")).not.toContain("abc123");
    expect(isWebGuardId("web:a.example.com")).toBe(true);
    expect(isWebGuardId("gauges")).toBe(false);
  });
});

describe("the merged list of live plugins and web sites", () => {
  beforeEach(() => {
    setRunning.mockReset();
    setRunning.mockResolvedValue(undefined);
  });

  it("writes plugins and web sites in one list, so neither overwrites the other", async () => {
    await reportRunningPlugins(["gauges"]);
    await reportRunningWebSites(["web:chat.example.com"]);

    expect(setRunning).toHaveBeenLastCalledWith({ plugins: ["gauges", "web:chat.example.com"] });

    await reportRunningPlugins([]);
    expect(setRunning).toHaveBeenLastCalledWith({ plugins: ["web:chat.example.com"] });

    await reportRunningWebSites([]);
    expect(setRunning).toHaveBeenLastCalledWith({ plugins: [] });
  });

  it("resolves only after the phone has answered", async () => {
    let answer!: () => void;
    setRunning.mockReturnValue(new Promise<void>((resolve) => (answer = resolve)));
    let done = false;
    const pending = reportRunningWebSites(["web:a.example.com"]).then(() => (done = true));

    await Promise.resolve();
    await Promise.resolve();
    expect(done).toBe(false);

    answer();
    await pending;
    expect(done).toBe(true);
  });

  it("still resolves when the phone cannot be reached, so a widget is never blocked for good", async () => {
    setRunning.mockRejectedValue(new Error("no bridge"));
    await expect(reportRunningWebSites(["web:a.example.com"])).resolves.toBeUndefined();
  });

  it("keeps the order of reports", async () => {
    const seen: string[][] = [];
    setRunning.mockImplementation(async (o) => {
      seen.push(o.plugins);
    });
    void reportRunningWebSites(["web:a.example.com"]);
    await reportRunningWebSites(["web:b.example.com"]);

    expect(seen).toEqual([["web:a.example.com"], ["web:b.example.com"]]);
  });
});
