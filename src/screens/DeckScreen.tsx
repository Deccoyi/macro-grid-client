import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Grid, WidgetView, isSafeWebUrl, webUrlHost, type Profile, type Widget, type WidgetState } from "@macro/renderer";
import { ActionErrorToast } from "../components/ActionErrorToast";
import { DrawerHandle } from "../components/DrawerHandle";
import { PerfOverlay } from "../components/PerfOverlay";
import { ProfileDrawer } from "../components/ProfileDrawer";
import { StatusBadge } from "../components/StatusBadge";
import { t } from "../i18n";
import { perf } from "../perf/perfStats";
import { useConfirmedWebSites } from "../hooks/useConfirmedWebSites";
import { webGuardId } from "../native/widgetGuard";
import { planWebLoad, type WebCandidate } from "../widgets/webLoad";
import { useDeckSwipe } from "../hooks/useDeckSwipe";
import type { UpdateController } from "../hooks/useUpdate";
import { versionToString } from "../update/releaseVersion";
import { colors } from "../theme";
import type { AutoSwitchInfo, ConnectionStatus, ProfileSummary } from "../ws/connection";

// Edge-to-edge Android draws the WebView behind the status/nav bars — pad the grid itself
// (not just the badge) so no widget ever sits under the clock/battery bar or the gesture bar.
// Only the *actual* safe-area inset, though (no artificial minimum): the editor's own preview
// doesn't add extra margin beyond a page's own `padding`, so forcing e.g. 10px here on sides
// that have no real inset (left/right in portrait, often bottom too) made the phone look
// padded compared to the WYSIWYG preview even when the page's own padding was 0.
const deckStyle: CSSProperties = {
  width: "100vw",
  height: "100vh",
  background: colors.background,
  padding: "env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)",
  boxSizing: "border-box",
  position: "relative",
  overflow: "hidden",
};

type WidgetEventType = "widget.down" | "widget.up" | "widget.longPress" | "widget.doubleTap";

/** What the deck does with its web widgets: `live` false draws the placeholder, `offText` says why. */
export interface WebPagesState {
  live: boolean;
  offText?: string;
}

interface DeckScreenProps {
  page: Profile["pages"][number];
  /** Every page of the profile: a page with a "keep loaded" web widget stays mounted (hidden) once it has been shown. */
  pages: Profile["pages"];
  status: ConnectionStatus;
  usingCache: boolean;
  actionError: string | null;
  states: Record<string, WidgetState>;
  dragValues: Record<string, number>;
  onDragValuesChange: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  profiles: ProfileSummary[];
  currentProfileId: string;
  servers: string[];
  activeHost: string;
  onPickServer: (host: string) => void;
  onForgetServer: (host: string) => void;
  onAddServer: () => void;
  autoSwitch: AutoSwitchInfo | null;
  onToggleAutoSwitchLock: () => void;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  onPickProfile: (id: string) => void;
  onWidgetEvent: (type: WidgetEventType, widgetId: string) => void;
  onWidgetValueCommit: (widgetId: string, value: number) => void;
  onSwipeNextPage: () => void;
  onSwipePrevPage: () => void;
  onSettingsOpenChange: (open: boolean) => void;
  update: UpdateController;
  webPages: WebPagesState;
  /** How many web widgets may be live at once; the rest wait with a "Tap to load" placeholder. */
  webLimit: number;
  /** What the phone's crash guard says about web sites: whether it has answered, the `web:<host>` ids it keeps off, and how to turn one back on. */
  webGuard: { ready: boolean; disabled: ReadonlySet<string>; onTurnOn: (id: string) => void };
  /** False while the app is not in front: plugin widgets are paused then. */
  pluginLive: boolean;
  /** Show the performance numbers over the deck. */
  showPerformance?: boolean;
}

/** The address of the server without its port: a web widget must never show it (the page would be the server itself). */
function serverHostName(activeHost: string): string {
  const withoutPort = activeHost.startsWith("[") ? activeHost.slice(0, activeHost.indexOf("]") + 1) : activeHost.split(":")[0] ?? "";
  return withoutPort;
}

/** The live deck: the current page's grid plus the connection badge, error toast, drawer and settings. */
export function DeckScreen({
  page,
  pages,
  status,
  usingCache,
  actionError,
  states,
  dragValues,
  onDragValuesChange,
  profiles,
  currentProfileId,
  servers,
  activeHost,
  onPickServer,
  onForgetServer,
  onAddServer,
  autoSwitch,
  onToggleAutoSwitchLock,
  drawerOpen,
  onDrawerOpenChange,
  onPickProfile,
  onWidgetEvent,
  onWidgetValueCommit,
  onSwipeNextPage,
  onSwipePrevPage,
  onSettingsOpenChange,
  update,
  webPages,
  webLimit,
  webGuard,
  pluginLive,
  showPerformance,
}: DeckScreenProps) {
  const blockedHosts = useMemo(() => [serverHostName(activeHost)], [activeHost]);
  const webTexts = useMemo(() => ({ empty: t("web.empty"), refused: t("web.refused"), off: webPages.offText }), [webPages.offText]);
  /** The `web:<host>` id of the address a web widget shows now (the override of a button, else its own), or null when it shows none or a refused one. */
  const siteOf = (widget: Widget): string | null => {
    if (widget.type !== "web") return null;
    const url = states[widget.id]?.url || (typeof widget.props?.url === "string" ? widget.props.url : "");
    return isSafeWebUrl(url, blockedHosts) ? webGuardId(url) : null;
  };
  const isKept = (widget: Widget) => widget.type === "web" && widget.props?.keepLoaded === true;

  // Pages that keep a web widget loaded stay mounted, hidden, once they have been shown, so a chat does not reload on every page change.
  const [visited, setVisited] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => setVisited((v) => (v.has(page.id) ? v : new Set(v).add(page.id))), [page.id]);
  // A widget the person tapped loads even over the limit; that holds only for the page it was tapped on.
  const [tapped, setTapped] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => setTapped(new Set()), [page.id]);

  const keptPages = useMemo(() => pages.filter((p) => p.id !== page.id && visited.has(p.id) && p.widgets.some(isKept)), [pages, page.id, visited]);
  const webPlan = useMemo(() => {
    if (!webPages.live) return { live: [] as WebCandidate[], waiting: new Set<string>() };
    const candidates: WebCandidate[] = [];
    const add = (widget: Widget) => {
      const siteId = siteOf(widget);
      if (siteId && !webGuard.disabled.has(siteId)) candidates.push({ widgetId: widget.id, siteId });
    };
    // Kept widgets of other pages hold their slots first; the shown page follows in reading order.
    for (const p of keptPages) p.widgets.filter(isKept).forEach(add);
    [...page.widgets].filter((w) => w.type === "web").sort((a, b) => a.y - b.y || a.x - b.x).forEach(add);
    return planWebLoad(candidates, webLimit, tapped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.widgets, keptPages, states, webPages.live, blockedHosts, webGuard.disabled, webLimit, tapped]);
  const liveWidgetIds = useMemo(() => new Set(webPlan.live.map((c) => c.widgetId)), [webPlan]);
  // The sites that are about to be live; the phone writes them down before any iframe is mounted (write-ahead).
  const wantedSites = useMemo(() => webPlan.live.map((c) => c.siteId), [webPlan]);
  const confirmedSites = useConfirmedWebSites(wantedSites, webGuard.ready);
  const renderWidget = (widget: Widget) => {
    perf.count("widgetDraws");
    const state = states[widget.id];
    const siteId = siteOf(widget);
    const siteOff = siteId !== null && webGuard.disabled.has(siteId);
    const waiting = siteId !== null && !siteOff && webPlan.waiting.has(widget.id);
    const loadable = siteId === null || (liveWidgetIds.has(widget.id) && confirmedSites.has(siteId));
    let webBlocked;
    if (siteOff && siteId) webBlocked = { text: t("web.crashedOff"), action: t("settings.widgets.turnOn"), onAction: () => webGuard.onTurnOn(siteId) };
    else if (waiting)
      webBlocked = { text: webUrlHost(state?.url || String(widget.props?.url ?? "")), action: t("web.tapToLoad"), onAction: () => setTapped((prev) => new Set(prev).add(widget.id)) };
    return (
      <WidgetView
        widget={widget}
        liveText={state?.text}
        liveActive={state?.active}
        liveValue={dragValues[widget.id] ?? state?.value}
        liveStyle={state?.style}
        webUrl={state?.url}
        webReload={state?.reload}
        webLive={webPages.live && loadable}
        webBlocked={webBlocked}
        webBlockedHosts={blockedHosts}
        webTexts={webTexts}
        pluginLive={pluginLive}
        haptics
        onPress={() => onWidgetEvent("widget.down", widget.id)}
        onRelease={() => onWidgetEvent("widget.up", widget.id)}
        onLongPress={() => onWidgetEvent("widget.longPress", widget.id)}
        onDoubleTap={() => onWidgetEvent("widget.doubleTap", widget.id)}
        onValueChange={(value) => onDragValuesChange((prev) => ({ ...prev, [widget.id]: value }))}
        onValueCommit={(value) => {
          onDragValuesChange((prev) => ({ ...prev, [widget.id]: value }));
          onWidgetValueCommit(widget.id, value);
        }}
      />
    );
  };

  useEffect(() => perf.mark("firstDraw"), []);

  const swipe = useDeckSwipe({ drawerOpen, onDrawerOpenChange, onNextPage: onSwipeNextPage, onPrevPage: onSwipePrevPage });

  return (
    <div style={deckStyle} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} onTouchCancel={swipe.onTouchCancel}>
      {showPerformance && <PerfOverlay />}
      {status !== "connected" && <StatusBadge status={status} usingCache={usingCache} />}
      {actionError && <ActionErrorToast message={actionError} />}

      {/* Always-visible edge handle: a swipe works too, but a hidden-only gesture is easy to miss.
          Shown even with a single profile — it's also the only way to reach the settings. */}
      {!drawerOpen && <DrawerHandle onOpen={() => onDrawerOpenChange(true)} showDot={update.offer !== null} />}

      {/* In the profile's page order, so a kept page is never moved (moving an iframe in the document reloads it). */}
      {pages
        .filter((p) => p.id === page.id || keptPages.some((k) => k.id === p.id))
        .map((p) => {
          const shown = p.id === page.id;
          // A page that is not shown keeps only its "keep loaded" web widgets; everything else on it is unmounted.
          const gridPage = shown ? page : { ...p, widgets: p.widgets.filter(isKept) };
          return (
            <div key={p.id} style={{ width: "100%", height: "100%", display: shown ? "block" : "none" }}>
              <Grid page={gridPage} renderWidget={renderWidget} />
            </div>
          );
        })}

      <ProfileDrawer
        open={drawerOpen}
        profiles={profiles}
        currentProfileId={currentProfileId}
        servers={servers}
        activeHost={activeHost}
        onPickServer={onPickServer}
        onForgetServer={onForgetServer}
        onAddServer={onAddServer}
        autoSwitch={autoSwitch}
        onToggleAutoSwitchLock={onToggleAutoSwitchLock}
        onClose={() => onDrawerOpenChange(false)}
        onPick={onPickProfile}
        onOpenSettings={() => {
          onDrawerOpenChange(false);
          onSettingsOpenChange(true);
        }}
        updateVersion={update.offer ? versionToString(update.offer.latest.version) : null}
        onOpenUpdate={() => {
          onDrawerOpenChange(false);
          update.openScreen();
        }}
      />
    </div>
  );
}
