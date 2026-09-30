import { useMemo, type CSSProperties } from "react";
import { Grid, WidgetView, isSafeWebUrl, type Profile, type WidgetState } from "@macro/renderer";
import { ActionErrorToast } from "../components/ActionErrorToast";
import { DrawerHandle } from "../components/DrawerHandle";
import { ProfileDrawer } from "../components/ProfileDrawer";
import { StatusBadge } from "../components/StatusBadge";
import { t } from "../i18n";
import { useConfirmedWebSites } from "../hooks/useConfirmedWebSites";
import { webGuardId } from "../native/widgetGuard";
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
  /** What the phone's crash guard says about web sites: whether it has answered, the `web:<host>` ids it keeps off, and how to turn one back on. */
  webGuard: { ready: boolean; disabled: ReadonlySet<string>; onTurnOn: (id: string) => void };
  /** False while the app is not in front: plugin widgets are paused then. */
  pluginLive: boolean;
}

/** The address of the server without its port: a web widget must never show it (the page would be the server itself). */
function serverHostName(activeHost: string): string {
  const withoutPort = activeHost.startsWith("[") ? activeHost.slice(0, activeHost.indexOf("]") + 1) : activeHost.split(":")[0] ?? "";
  return withoutPort;
}

/** The live deck: the current page's grid plus the connection badge, error toast, drawer and settings. */
export function DeckScreen({
  page,
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
  webGuard,
  pluginLive,
}: DeckScreenProps) {
  const blockedHosts = useMemo(() => [serverHostName(activeHost)], [activeHost]);
  const webTexts = useMemo(() => ({ empty: t("web.empty"), refused: t("web.refused"), off: webPages.offText }), [webPages.offText]);
  // The sites of this page that are about to be live; the phone writes them down before any iframe is mounted (write-ahead).
  const wantedSites = useMemo(() => {
    if (!webPages.live) return [];
    const ids: string[] = [];
    for (const w of page.widgets) {
      if (w.type !== "web") continue;
      const url = states[w.id]?.url || (typeof w.props?.url === "string" ? w.props.url : "");
      const id = isSafeWebUrl(url, blockedHosts) ? webGuardId(url) : null;
      if (id && !webGuard.disabled.has(id)) ids.push(id);
    }
    return ids;
  }, [page.widgets, states, webPages.live, blockedHosts, webGuard.disabled]);
  const confirmedSites = useConfirmedWebSites(wantedSites, webGuard.ready);
  const swipe = useDeckSwipe({ drawerOpen, onDrawerOpenChange, onNextPage: onSwipeNextPage, onPrevPage: onSwipePrevPage });

  return (
    <div style={deckStyle} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} onTouchCancel={swipe.onTouchCancel}>
      {status !== "connected" && <StatusBadge status={status} usingCache={usingCache} />}
      {actionError && <ActionErrorToast message={actionError} />}

      {/* Always-visible edge handle: a swipe works too, but a hidden-only gesture is easy to miss.
          Shown even with a single profile — it's also the only way to reach the settings. */}
      {!drawerOpen && <DrawerHandle onOpen={() => onDrawerOpenChange(true)} showDot={update.offer !== null} />}

      <Grid
        page={page}
        renderWidget={(widget) => {
          const state = states[widget.id];
          const siteUrl = widget.type === "web" ? state?.url || (typeof widget.props?.url === "string" ? widget.props.url : "") : "";
          const siteId = siteUrl && isSafeWebUrl(siteUrl, blockedHosts) ? webGuardId(siteUrl) : null;
          const siteOff = siteId !== null && webGuard.disabled.has(siteId);
          return (
            <WidgetView
              widget={widget}
              liveText={state?.text}
              liveActive={state?.active}
              liveValue={dragValues[widget.id] ?? state?.value}
              liveStyle={state?.style}
              webUrl={state?.url}
              webReload={state?.reload}
              webLive={webPages.live && (siteId === null || confirmedSites.has(siteId))}
              webBlocked={siteOff && siteId ? { text: t("web.crashedOff"), action: t("settings.widgets.turnOn"), onAction: () => webGuard.onTurnOn(siteId) } : undefined}
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
        }}
      />

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
