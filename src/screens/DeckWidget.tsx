import { memo, useCallback, useMemo } from "react";
import { WidgetView, webUrlHost, type Widget, type WidgetState } from "@macro/renderer";
import { t, getLanguage } from "../i18n";
import { perf } from "../perf/perfStats";

export type WidgetEventType = "widget.down" | "widget.up" | "widget.longPress" | "widget.doubleTap";

export interface DeckWidgetProps {
  widget: Widget;
  /** This widget's own live state: it keeps its identity until a state for this widget arrives. */
  state: WidgetState | undefined;
  dragValue: number | undefined;
  /** Whether a web widget may load now (the web setting, the limit and the crash guard allow it). */
  webLive: boolean;
  /** The `web:<host>` id of the address a web widget shows, or null. */
  siteId: string | null;
  /** The crash guard keeps this site off. */
  siteOff: boolean;
  /** The widget waits for a free web slot ("Tap to load"). */
  waiting: boolean;
  blockedHosts: string[];
  webTexts: { empty: string; refused: string; off?: string };
  pluginLive: boolean;
  onWidgetEvent: (type: WidgetEventType, widgetId: string) => void;
  onWidgetValueCommit: (widgetId: string, value: number) => void;
  onDragValuesChange: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  onTurnOn: (id: string) => void;
  onTap: (widgetId: string) => void;
}

/**
 * One widget of the deck. Everything it receives is a primitive or keeps its identity until it really changes, so a state change or a
 * slider drag redraws only the widget it belongs to. A prop that changes identity on every render would silently turn this off: the draw
 * counter test guards that.
 */
export const DeckWidget = memo(function DeckWidget({
  widget, state, dragValue, webLive, siteId, siteOff, waiting, blockedHosts, webTexts, pluginLive,
  onWidgetEvent, onWidgetValueCommit, onDragValuesChange, onTurnOn, onTap,
}: DeckWidgetProps) {
  perf.count("widgetDraws");
  const id = widget.id;
  const url = state?.url || String(widget.props?.url ?? "");
  const waitingHost = waiting ? webUrlHost(url) : "";
  const language = getLanguage();

  const webBlocked = useMemo(() => {
    if (siteOff && siteId) return { text: t("web.crashedOff"), action: t("settings.widgets.turnOn"), onAction: () => onTurnOn(siteId) };
    if (waiting) return { text: waitingHost, action: t("web.tapToLoad"), onAction: () => onTap(id) };
    return undefined;
    // `language` is not read inside, but a new language must give new texts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteOff, siteId, waiting, waitingHost, id, onTurnOn, onTap, language]);

  const onPress = useCallback(() => onWidgetEvent("widget.down", id), [onWidgetEvent, id]);
  const onRelease = useCallback(() => onWidgetEvent("widget.up", id), [onWidgetEvent, id]);
  const onLongPress = useCallback(() => onWidgetEvent("widget.longPress", id), [onWidgetEvent, id]);
  const onDoubleTap = useCallback(() => onWidgetEvent("widget.doubleTap", id), [onWidgetEvent, id]);
  const onValueChange = useCallback((value: number) => onDragValuesChange((prev) => ({ ...prev, [id]: value })), [onDragValuesChange, id]);
  const onValueCommit = useCallback(
    (value: number) => {
      onDragValuesChange((prev) => ({ ...prev, [id]: value }));
      onWidgetValueCommit(id, value);
    },
    [onDragValuesChange, onWidgetValueCommit, id],
  );

  return (
    <WidgetView
      widget={widget}
      liveText={state?.text}
      liveActive={state?.active}
      liveValue={dragValue ?? state?.value}
      liveStyle={state?.style}
      webUrl={state?.url}
      webReload={state?.reload}
      webLive={webLive}
      webBlocked={webBlocked}
      webBlockedHosts={blockedHosts}
      webTexts={webTexts}
      pluginLive={pluginLive}
      haptics
      onPress={onPress}
      onRelease={onRelease}
      onLongPress={onLongPress}
      onDoubleTap={onDoubleTap}
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
    />
  );
});
