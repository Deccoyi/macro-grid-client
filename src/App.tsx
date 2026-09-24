import { useCallback, useEffect, useRef, useState } from "react";
import { KeepAwake } from "@capacitor-community/keep-awake";
import type { Profile, WidgetState } from "@macro/renderer";
import { ACTION_ERROR_MS } from "./constants";
import { t } from "./i18n";
import { ConnectScreen } from "./screens/ConnectScreen";
import { DeckScreen } from "./screens/DeckScreen";
import { QrScanScreen, type ScannedPairing } from "./screens/QrScanScreen";
import { getDeviceId } from "./storage/deviceId";
import { HOST_KEY, tokenKey } from "./storage/keys";
import { loadLayoutCache, resolveCachedProfile, saveLayoutCache } from "./storage/layoutCache";
import { forgetServer, loadServers, rememberServer } from "./storage/servers";
import { applySettings, loadSettings, saveSettings, type AppSettings } from "./storage/settings";
import { readText, writeText } from "./storage/storage";
import { AutoSwitchInfo, ConnectionStatus, ProfileSummary, ServerConnection } from "./ws/connection";

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
