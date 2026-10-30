// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHeldTrue } from "./useWebPages";

describe("useHeldTrue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stays true for the delay after the value turns false, then turns false", () => {
    const { result, rerender } = renderHook(({ v }) => useHeldTrue(v, 30_000), { initialProps: { v: true } });
    rerender({ v: false });
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(29_999));
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(false);
  });

  it("does not unload when the app comes back within the delay", () => {
    const { result, rerender } = renderHook(({ v }) => useHeldTrue(v, 30_000), { initialProps: { v: true } });
    rerender({ v: false });
    act(() => vi.advanceTimersByTime(20_000));
    rerender({ v: true });
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe(true);
  });

  it("comes back true at once after it was unloaded", () => {
    const { result, rerender } = renderHook(({ v }) => useHeldTrue(v, 1000), { initialProps: { v: true } });
    rerender({ v: false });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(false);
    rerender({ v: true });
    expect(result.current).toBe(true);
  });
});
