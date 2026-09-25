import type { CSSProperties } from "react";
import { Grid, WidgetView, type Profile, type WidgetState } from "@macro/renderer";
import { ActionErrorToast } from "../components/ActionErrorToast";
import { DrawerHandle } from "../components/DrawerHandle";
import { ProfileDrawer } from "../components/ProfileDrawer";
import { SettingsPanel } from "../components/SettingsPanel";
import { StatusBadge } from "../components/StatusBadge";
import { useDeckSwipe } from "../hooks/useDeckSwipe";
import type { AppSettings } from "../storage/settings";
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
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  appSettings: AppSettings;
  onAppSettingsChange: (settings: AppSettings) => void;
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
  settingsOpen,
  onSettingsOpenChange,
  appSettings,
  onAppSettingsChange,
}: DeckScreenProps) {
  const swipe = useDeckSwipe({ drawerOpen, onDrawerOpenChange, onNextPage: onSwipeNextPage, onPrevPage: onSwipePrevPage });

  return (
    <div style={deckStyle} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} onTouchCancel={swipe.onTouchCancel}>
      {status !== "connected" && <StatusBadge status={status} usingCache={usingCache} />}
      {actionError && <ActionErrorToast message={actionError} />}

      {/* Always-visible edge handle: a swipe works too, but a hidden-only gesture is easy to miss.
          Shown even with a single profile — it's also the only way to reach the settings. */}
      {!drawerOpen && <DrawerHandle onOpen={() => onDrawerOpenChange(true)} />}

      <Grid
        page={page}
        renderWidget={(widget) => {
          const state = states[widget.id];
          return (
            <WidgetView
              widget={widget}
              liveText={state?.text}
              liveActive={state?.active}
              liveValue={dragValues[widget.id] ?? state?.value}
              liveStyle={state?.style}
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
      />

      <SettingsPanel open={settingsOpen} settings={appSettings} onChange={onAppSettingsChange} onClose={() => onSettingsOpenChange(false)} />
    </div>
  );
}
