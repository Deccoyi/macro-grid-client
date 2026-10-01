import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Widget } from "@macro/renderer";
import { perf } from "../perf/perfStats";
import { DeckWidget, type DeckWidgetProps } from "./DeckWidget";

const button = (id: string): Widget => ({ id, type: "button", x: 0, y: 0, w: 1, h: 1, text: `Button ${id}`, actions: {} });

function props(widget: Widget, over: Partial<DeckWidgetProps> = {}): DeckWidgetProps {
  return {
    widget, state: undefined, dragValue: undefined, webLive: false, siteId: null, siteOff: false, waiting: false,
    blockedHosts: [], webTexts: { empty: "", refused: "" }, pluginLive: false,
    onWidgetEvent: vi.fn(), onWidgetValueCommit: vi.fn(), onDragValuesChange: vi.fn(), onTurnOn: vi.fn(), onTap: vi.fn(),
    ...over,
  };
}

const draws = () => perf.counters().widgetDraws;

describe("DeckWidget", () => {
  beforeEach(() => perf.reset());

  it("is not drawn again when the same values come in", () => {
    const base = props(button("a"));
    const { rerender } = render(<DeckWidget {...base} />);
    expect(draws()).toBe(1);
    rerender(<DeckWidget {...base} />);
    expect(draws()).toBe(1);
  });

  it("is drawn again only when its own state changes", () => {
    const base = props(button("a"));
    const { rerender } = render(<DeckWidget {...base} />);
    rerender(<DeckWidget {...base} state={{ widgetId: "a", text: "Live" }} />);
    expect(draws()).toBe(2);
  });

  it("reports presses with its own widget id", () => {
    const base = props(button("a"));
    const { container } = render(<DeckWidget {...base} />);
    const el = container.querySelector("[data-ms-widget-host]")!;
    fireEvent.pointerDown(el);
    fireEvent.pointerUp(el);
    expect(base.onWidgetEvent).toHaveBeenCalledWith("widget.down", "a");
    expect(base.onWidgetEvent).toHaveBeenCalledWith("widget.up", "a");
  });
});
