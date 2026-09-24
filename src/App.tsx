import { useCallback, useEffect, useRef, useState } from "react";
import { ActionErrorToast } from "./components/ActionErrorToast";
import { StatusBadge } from "./components/StatusBadge";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { Grid, WidgetView, type Profile, type WidgetState } from "@macro/renderer";
import { getDeviceId } from "./storage/deviceId";
import { t } from "./i18n";
import { clearGestureExclusionZone, setGestureExclusionZone } from "./native/gestureExclusion";
import { ConnectScreen } from "./screens/ConnectScreen";
import { QrScanScreen, type ScannedPairing } from "./screens/QrScanScreen";
import { SettingsButton, SettingsPanel } from "./components/SettingsPanel";
import { forgetServer, loadServers, rememberServer } from "./storage/servers";
import { applySettings, loadSettings, saveSettings, type AppSettings } from "./storage/settings";
import { AutoSwitchInfo, ConnectionStatus, ProfileSummary, ServerConnection } from "./ws/connection";
import { HOST_KEY, tokenKey } from "./storage/keys";
import { loadLayoutCache, resolveCachedProfile, saveLayoutCache } from "./storage/layoutCache";
import { readText, writeText } from "./storage/storage";
import {
  ACTION_ERROR_MS,
  EDGE_SWIPE_ZONE_PX,
  GESTURE_ZONE_HEIGHT_PX,
  HANDLE_FRACTION_DEFAULT,
  HANDLE_FRACTION_MAX,
  HANDLE_FRACTION_MIN,
  HANDLE_HEIGHT_PX,
  HANDLE_HOLD_CANCEL_PX,
  HANDLE_HOLD_MS,
  HANDLE_WIDTH_PX,
  PAGE_SWIPE_THRESHOLD_PX,
  SWIPE_MAX_VERTICAL_PX,
  SWIPE_OPEN_THRESHOLD_PX,
} from "./constants";
import { HANDLE_Y_KEY } from "./storage/keys";

export function App() {
  const [host, setHost] = useState(() => readText(HOST_KEY) ?? "");
  /** The server the socket is actually pointed at — `host` is just the connect screen's text field. */
  const [activeHost, setActiveHost] = useState(() => readText(HOST_KEY) ?? "");
  const [servers, setServers] = useState<string[]>(loadServers);
  /** Forces the connect screen over a live/cached deck so a second server can be added. */
  const [addingServer, setAddingServer] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [usingCache, setUsingCache] = useState(() => loadLayoutCache(host) !== null);
  const [profile, setProfile] = useState<Profile | null>(() => resolveCachedProfile(loadLayoutCache(host)));
  const [pageId, setPageId] = useState<string | null>(() => loadLayoutCache(host)?.pageId ?? null);
  const [states, setStates] = useState<Record<string, WidgetState>>({});
  /** Local optimistic slider/knob position while dragging (and right after a commit, until the server's
   * own widget.state — if this widget is bound to a variable — confirms/overrides it). Cleared per-widget
   * the moment a real widget.state arrives for it, so a variable that's also changing from elsewhere
   * (another device, Windows itself) doesn't get stuck showing a stale local drag forever. */
  const [dragValues, setDragValues] = useState<Record<string, number>>({});
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [autoSwitch, setAutoSwitch] = useState<AutoSwitchInfo | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(loadSettings);
  const [scanning, setScanning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const actionErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionRef = useRef<ServerConnection | null>(null);
  /** The current layout in its compact `asset:` form — what gets written to the layout cache. */
  const cacheProfileRef = useRef<Profile | null>(null);
  /** A PIN that came from a scanned QR code, submitted automatically the moment the server actually
   * asks for one — so scanning fully replaces typing both the host and the PIN by hand. */
  const pendingQrPinRef = useRef<string | null>(null);

  const connect = useCallback((targetHost: string) => {
    connectionRef.current?.disconnect();
    writeText(HOST_KEY, targetHost);
    setActiveHost(targetHost);
    setHost(targetHost);
    setAddingServer(false);
    setStates({});
    setProfiles([]);
    setAutoSwitch(null);
    const cached = loadLayoutCache(targetHost);
    cacheProfileRef.current = cached?.profile ?? null;
    setProfile(resolveCachedProfile(cached));
    setPageId(cached?.pageId ?? null);
    setUsingCache(cached !== null);

    const connection = new ServerConnection(targetHost, getDeviceId(), t("device.name"), readText(tokenKey(targetHost)), {
      onStatusChange: setStatus,
      onLayout: (nextProfile, nextPageId, cacheProfile) => {
        cacheProfileRef.current = cacheProfile;
        setProfile(nextProfile);
        setPageId(nextPageId);
        setStates({});
        setUsingCache(false);
        // First layout means hello was accepted — only now is this a real, working server worth remembering.
        setServers(rememberServer(targetHost));
        saveLayoutCache(targetHost, cacheProfile, nextPageId);
      },
      onLayoutPatch: (nextProfile, nextPageId, cacheProfile, changedWidgetIds) => {
        cacheProfileRef.current = cacheProfile;
        setProfile(nextProfile);
        setPageId(nextPageId);
        // Only the changed widgets lose their live state (the server re-sends it); every other widget keeps
        // its text, toggle and slider position, so an edit elsewhere on the deck is invisible here.
        setStates((prev) => {
          const next = { ...prev };
          for (const id of changedWidgetIds) delete next[id];
          return next;
        });
        setDragValues((prev) => {
          const next = { ...prev };
          for (const id of changedWidgetIds) delete next[id];
          return next;
        });
        saveLayoutCache(targetHost, cacheProfile, nextPageId);
      },
      onPageChange: (nextPageId) => {
        setPageId(nextPageId);
        if (cacheProfileRef.current) saveLayoutCache(targetHost, cacheProfileRef.current, nextPageId);
      },
      onWidgetState: (state) => {
        setStates((prev) => ({ ...prev, [state.widgetId]: { ...prev[state.widgetId], ...state } }));
        if (state.value !== undefined) {
          setDragValues((prev) => {
            if (!(state.widgetId in prev)) return prev;
            const next = { ...prev };
            delete next[state.widgetId];
            return next;
          });
        }
      },
      onProfiles: (nextProfiles, nextAutoSwitch) => { setProfiles(nextProfiles); setAutoSwitch(nextAutoSwitch); },
      onPaired: (token) => writeText(tokenKey(targetHost), token),
      onActionError: (message) => {
        if (actionErrorTimer.current) clearTimeout(actionErrorTimer.current);
        setActionError(message);
        actionErrorTimer.current = setTimeout(() => setActionError(null), ACTION_ERROR_MS);
      },
    });
    connectionRef.current = connection;
    connection.connect();
  }, []);

  // Android doesn't remember immersive mode / orientation lock across a cold start on its own —
  // re-push the last saved choice every launch.
  useEffect(() => {
    applySettings(appSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconnect automatically to the last known server on launch, like the plan's "reconnect + cache"
  // requirement. The very first render already shows any cached layout (see the useState initializers
  // above) so a cold start looks like the deck immediately, not the connect screen.
  useEffect(() => {
    if (host) connect(host);
    return () => connectionRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A scanned QR's PIN is only usable once the server actually says it needs one — submitting it any
  // earlier (e.g. against an old accepted token) would be a spurious re-pair attempt.
  useEffect(() => {
    if (status === "pairing_required" && pendingQrPinRef.current) {
      connectionRef.current?.retryWithPin(pendingQrPinRef.current);
      pendingQrPinRef.current = null;
    }
  }, [status]);

  const handleScanned = useCallback(
    (result: ScannedPairing) => {
      setScanning(false);
      pendingQrPinRef.current = result.pin ?? null;
      setHost(result.host);
      connect(result.host);
    },
    [connect],
  );

  // The phone is meant to sit as a always-on deck while in use — keep the screen from sleeping
  // whenever we're actually showing one (connected or not, as long as a profile has loaded once).
  // Fails silently on platforms/browsers without the plugin (Capacitor's web shim no-ops).
  useEffect(() => {
    if (!profile) return;
    KeepAwake.keepAwake().catch(() => {});
    return () => {
      KeepAwake.allowSleep().catch(() => {});
    };
  }, [profile]);

  // Every hook above must run on every render — this is the first point an early return is safe.
  if (scanning) {
    return <QrScanScreen onCancel={() => setScanning(false)} onScanned={handleScanned} />;
  }

  const page = profile?.pages.find((p) => p.id === pageId) ?? profile?.pages[0];

  // Pairing always wins over a cached layout — a stale grid with no indication a PIN is needed would
  // just look broken ("Offline" forever) instead of telling the user what to do about it.
  if (!profile || !page || status === "pairing_required" || addingServer) {
    return (
      <ConnectScreen
        host={host}
        status={status}
        onHostChange={setHost}
        onConnect={() => host.trim() && connect(host.trim())}
        onSubmitPin={(pin) => connectionRef.current?.retryWithPin(pin)}
        onScanQr={() => setScanning(true)}
        servers={servers}
        onPickServer={connect}
        onCancel={
          addingServer
            ? () => {
                setHost(activeHost);
                setAddingServer(false);
              }
            : undefined
        }
      />
    );
  }

  return (
    <DeckScreen
      page={page}
      status={status}
      usingCache={usingCache}
      actionError={actionError}
      states={states}
      dragValues={dragValues}
      onDragValuesChange={setDragValues}
      profiles={profiles}
      currentProfileId={profile.id}
      servers={servers}
      activeHost={activeHost}
      onPickServer={(h) => {
        setDrawerOpen(false);
        if (h !== activeHost) connect(h);
      }}
      onForgetServer={(h) => setServers(forgetServer(h))}
      onAddServer={() => {
        setDrawerOpen(false);
        setHost("");
        setAddingServer(true);
      }}
      autoSwitch={autoSwitch}
      onToggleAutoSwitchLock={() => connectionRef.current?.setProfileLock(!autoSwitch?.locked)}
      drawerOpen={drawerOpen}
      onDrawerOpenChange={setDrawerOpen}
      onPickProfile={(id) => {
        connectionRef.current?.changeProfile(id);
        setDrawerOpen(false);
      }}
      onWidgetEvent={(type, widgetId) => connectionRef.current?.send(type, { pageId: page.id, widgetId })}
      onWidgetValueCommit={(widgetId, value) => connectionRef.current?.send("widget.value", { pageId: page.id, widgetId, value })}
      onSwipeNextPage={() => connectionRef.current?.nextPage()}
      onSwipePrevPage={() => connectionRef.current?.prevPage()}
      settingsOpen={settingsOpen}
      onSettingsOpenChange={setSettingsOpen}
      appSettings={appSettings}
      onAppSettingsChange={(next) => {
        setAppSettings(next);
        saveSettings(next);
      }}
    />
  );
}

function DeckScreen({
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
}: {
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
  onWidgetEvent: (type: "widget.down" | "widget.up" | "widget.longPress" | "widget.doubleTap", widgetId: string) => void;
  onWidgetValueCommit: (widgetId: string, value: number) => void;
  onSwipeNextPage: () => void;
  onSwipePrevPage: () => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  appSettings: AppSettings;
  onAppSettingsChange: (settings: AppSettings) => void;
}) {
  // The drawer now lives on the right (see ProfileDrawer/DrawerHandle below — left conflicted with
  // Android gesture-nav's own left-edge back swipe), so the open swipe starts near the right edge and
  // moves left (negative dx); closing swipes right, same as before but mirrored.
  const touchStart = useRef<{ x: number; y: number; fromEdge: boolean } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]!;
    touchStart.current = { x: t.clientX, y: t.clientY, fromEdge: t.clientX >= window.innerWidth - EDGE_SWIPE_ZONE_PX };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0]!;
    const dx = t.clientX - start.x;
    const dy = Math.abs(t.clientY - start.y);
    if (dy > SWIPE_MAX_VERTICAL_PX) return;
    if (start.fromEdge && dx < -SWIPE_OPEN_THRESHOLD_PX) onDrawerOpenChange(true);
    else if (drawerOpen && dx > SWIPE_OPEN_THRESHOLD_PX) onDrawerOpenChange(false);
    // A long, mostly-horizontal swipe that isn't the drawer's own edge-open/close gesture changes page —
    // same "next/prev wraps around" behavior as a core.page button, just triggered by the deck itself.
    else if (!start.fromEdge && !drawerOpen) {
      if (dx <= -PAGE_SWIPE_THRESHOLD_PX) onSwipeNextPage();
      else if (dx >= PAGE_SWIPE_THRESHOLD_PX) onSwipePrevPage();
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#0b0d10",
        // Edge-to-edge Android draws the WebView behind the status/nav bars — pad the grid itself
        // (not just the badge) so no widget ever sits under the clock/battery bar or the gesture bar.
        // Only the *actual* safe-area inset, though (no artificial minimum): the editor's own preview
        // doesn't add extra margin beyond a page's own `padding`, so forcing e.g. 10px here on sides
        // that have no real inset (left/right in portrait, often bottom too) made the phone look
        // padded compared to the WYSIWYG preview even when the page's own padding was 0.
        padding: "env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {status !== "connected" && <StatusBadge status={status} usingCache={usingCache} />}
      {actionError && <ActionErrorToast message={actionError} />}

      {/* Always-visible edge handle: a swipe works too, but a hidden-only gesture is easy to miss.
          Shown even with a single profile now — it's also the only way to reach Ayarlar. */}
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

      <SettingsPanel
        open={settingsOpen}
        settings={appSettings}
        onChange={onAppSettingsChange}
        onClose={() => onSettingsOpenChange(false)}
      />
    </div>
  );
}

function ProfileDrawer({
  open,
  profiles,
  currentProfileId,
  servers,
  activeHost,
  onPickServer,
  onForgetServer,
  onAddServer,
  autoSwitch,
  onToggleAutoSwitchLock,
  onClose,
  onPick,
  onOpenSettings,
}: {
  open: boolean;
  profiles: ProfileSummary[];
  currentProfileId: string;
  servers: string[];
  activeHost: string;
  onPickServer: (host: string) => void;
  onForgetServer: (host: string) => void;
  onAddServer: () => void;
  autoSwitch: AutoSwitchInfo | null;
  onToggleAutoSwitchLock: () => void;
  onClose: () => void;
  onPick: (id: string) => void;
  onOpenSettings: () => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100,
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .2s ease",
        }}
      />
      {/* On the right, not the left — the left edge is Android gesture-nav's own back-swipe zone. */}
      <div
        style={{
          position: "fixed", top: 0, bottom: 0, right: 0, width: "78%", maxWidth: 300, zIndex: 101,
          background: "#16181c", borderLeft: "1px solid #2d3136", boxSizing: "border-box",
          padding: "max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px)) 16px",
          transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform .2s ease",
          display: "flex", flexDirection: "column", gap: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "4px 10px 12px" }}>
          <span style={{ color: "#9aa0a8", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>{t("drawer.profiles")}</span>
          <div style={{ flex: 1 }} />
          {autoSwitch?.enabled && (
            <button
              role="switch"
              aria-checked={autoSwitch.locked}
              aria-label={t("drawer.lock")}
              onClick={onToggleAutoSwitchLock}
              title={autoSwitch.locked ? t("drawer.lock.on") : t("drawer.lock.off")}
              style={{
                position: "relative", width: 48, height: 26, padding: 0, borderRadius: 999, border: "none", cursor: "pointer",
                background: autoSwitch.locked ? "#ef4444" : "#3a3f45", transition: "background .15s ease",
              }}
            >
              <span
                style={{
                  position: "absolute", top: 3, left: autoSwitch.locked ? 25 : 3, width: 20, height: 20, borderRadius: "50%",
                  background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  color: autoSwitch.locked ? "#ef4444" : "#6b7280", transition: "left .15s ease, color .15s ease",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="11" width="16" height="10" rx="2" fill="currentColor" stroke="none" />
                  <path d={autoSwitch.locked ? "M8 11V7a4 4 0 0 1 8 0v4" : "M8 11V7a4 4 0 0 1 7.5-2"} />
                </svg>
              </span>
            </button>
          )}
        </div>
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            style={{
              display: "block", width: "100%", textAlign: "left", padding: "12px 10px", borderRadius: 8,
              border: "none", cursor: "pointer", fontSize: 15,
              background: p.id === currentProfileId ? "rgba(59,130,246,.18)" : "transparent",
              color: p.id === currentProfileId ? "#60a5fa" : "#e6e7ea",
            }}
          >
            {p.name}
          </button>
        ))}
        <div style={{ color: "#9aa0a8", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", padding: "16px 10px 6px" }}>{t("drawer.servers")}</div>
        {servers.map((h) => (
          <div key={h} style={{ display: "flex", alignItems: "center" }}>
            <button
              onClick={() => onPickServer(h)}
              style={{
                flex: 1, minWidth: 0, textAlign: "left", padding: "10px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 13, fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis",
                background: h === activeHost ? "rgba(59,130,246,.18)" : "transparent",
                color: h === activeHost ? "#60a5fa" : "#e6e7ea",
              }}
            >
              {h}
            </button>
            {h !== activeHost && (
              <button
                onClick={() => window.confirm(t("drawer.forget.confirm", h)) && onForgetServer(h)}
                aria-label={t("drawer.forget.label", h)}
                style={{ border: "none", background: "transparent", color: "#9aa0a8", fontSize: 18, padding: "6px 10px", cursor: "pointer" }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={onAddServer}
          style={{
            display: "block", width: "100%", textAlign: "left", padding: "10px", borderRadius: 8, border: "none",
            cursor: "pointer", fontSize: 14, background: "transparent", color: "#60a5fa",
          }}
        >
          {t("drawer.addServer")}
        </button>
        <SettingsButton onOpen={onOpenSettings} />
      </div>
    </>
  );
}

const clampHandleFraction = (n: number) => Math.min(HANDLE_FRACTION_MAX, Math.max(HANDLE_FRACTION_MIN, n));

function loadHandleFraction(): number {
  const raw = readText(HANDLE_Y_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? clampHandleFraction(n) : HANDLE_FRACTION_DEFAULT;
}

/**
 * The always-visible drawer handle: on the right edge (not left — that's Android gesture-nav's own
 * back-swipe zone). A tap, or a swipe that passes over it, opens the drawer. Repositioning the handle
 * itself needs a deliberate press-and-hold — a quick swipe must never drag it, since a swipe's natural
 * diagonal wobble would otherwise get misread as "start dragging" (see HANDLE_HOLD_MS below). Position
 * is remembered per device in localStorage. Also tells Android to exclude this exact screen rect from
 * its own edge-swipe-back gesture (see gestureExclusion.ts) so the two don't fight over the same touch —
 * without that, a touch landing in the OS's back-gesture strip here can be intercepted before this
 * component ever sees it, on Android 10+ at least.
 */
function DrawerHandle({ onOpen }: { onOpen: () => void }) {
  const [topFraction, setTopFraction] = useState(loadHandleFraction);
  const topFractionRef = useRef(topFraction);
  useEffect(() => {
    topFractionRef.current = topFraction;
  }, [topFraction]);

  const drag = useRef<{
    origX: number;
    origY: number;
    anchorX: number;
    anchorY: number;
    anchorFraction: number;
    lastX: number;
    lastY: number;
    holdTimer: ReturnType<typeof setTimeout> | null;
    /** Set once HANDLE_HOLD_MS has passed with the finger still near its start — only then does moving
     * the finger reposition the handle instead of being a swipe/tap. */
    active: boolean;
  } | null>(null);

  useEffect(() => {
    const publishZone = () => {
      setGestureExclusionZone({
        top: topFraction * window.innerHeight - GESTURE_ZONE_HEIGHT_PX / 2,
        height: GESTURE_ZONE_HEIGHT_PX,
        width: EDGE_SWIPE_ZONE_PX,
        rightEdge: true,
      });
    };
    publishZone();
    window.addEventListener("resize", publishZone);
    return () => {
      window.removeEventListener("resize", publishZone);
      clearGestureExclusionZone();
    };
  }, [topFraction]);

  const cancelHold = () => {
    const d = drag.current;
    if (d?.holdTimer != null) {
      clearTimeout(d.holdTimer);
      d.holdTimer = null;
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]!;
    const state: NonNullable<typeof drag.current> = {
      origX: t.clientX,
      origY: t.clientY,
      anchorX: t.clientX,
      anchorY: t.clientY,
      anchorFraction: topFractionRef.current,
      lastX: t.clientX,
      lastY: t.clientY,
      holdTimer: null,
      active: false,
    };
    state.holdTimer = setTimeout(() => {
      state.active = true;
      // Re-anchor to wherever the finger drifted to during the hold, so drag mode doesn't jump.
      state.anchorY = state.lastY;
      state.anchorFraction = topFractionRef.current;
      try {
        navigator.vibrate?.(15);
      } catch {
        // Vibration is a nice-to-have confirmation; ignore if unsupported.
      }
    }, HANDLE_HOLD_MS);
    drag.current = state;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current;
    if (!d) return;
    const t = e.touches[0]!;
    d.lastX = t.clientX;
    d.lastY = t.clientY;
    if (!d.active) {
      if (Math.hypot(t.clientX - d.anchorX, t.clientY - d.anchorY) > HANDLE_HOLD_CANCEL_PX) cancelHold();
      return;
    }
    setTopFraction(clampHandleFraction(d.anchorFraction + (t.clientY - d.anchorY) / window.innerHeight));
  };

  const endTouch = (e: React.TouchEvent) => {
    // Suppress the synthetic click that follows touchend: the handle unmounts as the drawer opens, so
    // that click would land on the drawer's backdrop and close it again instantly.
    if (e.cancelable) e.preventDefault();
    const d = drag.current;
    cancelHold();
    drag.current = null;
    if (!d) return;
    // Barely moved from where the finger first landed — a tap, even a slow/deliberate one that ran
    // past HANDLE_HOLD_MS and triggered the vibration, still opens rather than silently doing nothing.
    const barelyMoved = Math.hypot(d.lastX - d.origX, d.lastY - d.origY) <= HANDLE_HOLD_CANCEL_PX;
    if (d.active && !barelyMoved) {
      writeText(HANDLE_Y_KEY, String(topFractionRef.current)); // Best-effort; the handle just resets to center next launch.
    } else {
      onOpen();
    }
  };

  return (
    // The button's real hit area is deliberately wider/taller than the visible bar (matches the native
    // gesture-exclusion rect above) — a tap landing near the edge but just outside the thin bar used to
    // fall through to the grid underneath, which only reacts to a swipe, not a stationary tap. The bar
    // itself (the inner span) stays HANDLE_WIDTH_PX/HANDLE_HEIGHT_PX and flush with the screen edge.
    <button
      aria-label={t("drawer.show")}
      onClick={onOpen}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={endTouch}
      onTouchCancel={endTouch}
      style={{
        position: "fixed", right: 0, top: `${topFraction * 100}%`, transform: "translateY(-50%)", zIndex: 90,
        width: EDGE_SWIPE_ZONE_PX, height: GESTURE_ZONE_HEIGHT_PX, border: "none", background: "transparent",
        cursor: "pointer", padding: 0, touchAction: "none",
        display: "flex", alignItems: "center", justifyContent: "flex-end",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: HANDLE_WIDTH_PX, height: HANDLE_HEIGHT_PX, borderRadius: "8px 0 0 8px",
          background: "rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <svg width="7" height="13" viewBox="0 0 7 13" fill="none" aria-hidden="true">
          <path d="M6 1L1 6.5L6 12" stroke="rgba(255,255,255,.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
