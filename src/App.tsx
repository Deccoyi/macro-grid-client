import { useCallback, useEffect, useRef, useState } from "react";
import { PluginWidgetContext } from "@macro/renderer";
import { InfoToast } from "./components/InfoToast";
import { UpdateScreen } from "./components/UpdateScreen";
import { DEFAULT_SERVER_PORT } from "./constants";
import { useKeepAwake } from "./hooks/useKeepAwake";
import { useLanguage } from "./hooks/useLanguage";
import { usePluginWidgets } from "./hooks/usePluginWidgets";
import { useServerConnection } from "./hooks/useServerConnection";
import { useAppVisible, useHeldTrue, useWebPagesSafe, WEB_BACKGROUND_UNLOAD_MS } from "./hooks/useWebPages";
import { useUpdate } from "./hooks/useUpdate";
import { t } from "./i18n";
import { SettingsScreen } from "./components/SettingsScreen";
import { ConnectScreen } from "./screens/ConnectScreen";
import { DeckScreen } from "./screens/DeckScreen";
import { QrScanScreen, type ScannedPairing } from "./screens/QrScanScreen";
import { HOST_KEY } from "./storage/keys";
import { webLimitFor } from "./widgets/limits";
import { applySettings, loadSettings, saveSettings, type AppSettings } from "./storage/settings";
import { readText } from "./storage/storage";

/** Adds the default port when the person typed just an IP address, skipping the ":port" part. A saved
 * server or a scanned QR always already has one and is returned unchanged. */
function withDefaultPort(host: string): string {
  return host.includes(":") ? host : `${host}:${DEFAULT_SERVER_PORT}`;
}

/** Chooses between the QR scanner, the connect screen and the deck, and holds the UI-only state (panels, form text). */
export function App() {
  const [appSettings, setAppSettings] = useState<AppSettings>(loadSettings);
  // The widget host needs the person's settings and the shown page, and the connection needs the host: settings first, the connection next.
  const [shownPageId, setShownPageId] = useState<string | undefined>(undefined);
  const widgets = usePluginWidgets(appSettings, shownPageId);
  const conn = useServerConnection(widgets.connectionEvents);
  widgets.setSend(conn.send);
  /** The connect screen's text field — `conn.activeHost` is the server the socket is actually pointed at. */
  const [host, setHost] = useState(() => readText(HOST_KEY) ?? "");
  /** Forces the connect screen over a live/cached deck so a second server can be added. */
  const [addingServer, setAddingServer] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const update = useUpdate(appSettings);
  const webSafe = useWebPagesSafe();
  const appVisible = useAppVisible();
  // A web page runs only when the phone can keep it away from the app's native bridge, the person has not turned web pages off, and the app is in front
  // (or left it less than 30 seconds ago, so a short trip to another app does not reload a chat).
  const webAppActive = useHeldTrue(appVisible, WEB_BACKGROUND_UNLOAD_MS);
  const webPages = {
    live: webSafe === true && appSettings.showWebPages && webAppActive,
    offText: webSafe === false ? t("web.oldWebView") : !appSettings.showWebPages ? t("web.off") : undefined,
  };
  const shownPage = conn.profile?.pages.find((p) => p.id === conn.pageId) ?? conn.profile?.pages[0];
  useEffect(() => setShownPageId(shownPage?.id), [shownPage?.id]);
  // What the phone says about the last crash goes to the server once, so the plugin's author sees it in the Error List.
  const [crashReported, setCrashReported] = useState(false);
  useEffect(() => {
    if (crashReported || widgets.crashNotice.length === 0 || conn.status !== "connected" || !conn.profile) return;
    for (const plugin of widgets.crashNotice) {
      for (const p of conn.profile.pages) {
        const w = p.widgets.find((x) => x.type === "plugin-widget" && x.props?.plugin === plugin);
        if (w) {
          conn.send("plugin.widget.error", { pageId: p.id, widgetId: w.id, message: "The app closed unexpectedly while this plugin's widgets were running; the phone switched them off." });
          break;
        }
      }
    }
    setCrashReported(true);
  }, [crashReported, widgets.crashNotice, conn.status, conn.profile, conn]);
  // Stable, so the memoised widgets of the deck are not redrawn when something else changes; the page is read when the event happens.
  const pageIdRef = useRef<string | undefined>(undefined);
  pageIdRef.current = shownPage?.id;
  const { send } = conn;
  const onWidgetEvent = useCallback((type: string, widgetId: string) => send(type, { pageId: pageIdRef.current, widgetId }), [send]);
  const onWidgetValueCommit = useCallback((widgetId: string, value: number) => send("widget.value", { pageId: pageIdRef.current, widgetId, value }), [send]);
  const { language } = useLanguage(); // re-renders every screen when the language is changed in Settings

  const { connect: connectToServer, connectScanned } = conn;
  const connect = useCallback(
    (targetHost: string) => {
      setHost(targetHost);
      setAddingServer(false);
      connectToServer(targetHost);
    },
    [connectToServer],
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Android doesn't remember immersive mode / orientation lock across a cold start on its own —
  // re-push the last saved choice every launch.
  useEffect(() => {
    applySettings(appSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScanned = useCallback(
    (result: ScannedPairing) => {
      setScanning(false);
      setHost(result.host);
      setAddingServer(false);
      connectScanned(result.host, result.pin ?? null, result.tlsPort, result.fingerprint);
    },
    [connectScanned],
  );

  // Keep the screen awake whenever we're showing a deck (connected or not, as long as a profile has loaded once).
  useKeepAwake(conn.profile !== null);

  // Every hook above must run on every render — this is the first point an early return is safe.
  const screen = renderScreen();
  return (
    <PluginWidgetContext.Provider value={widgets.context}>
      {screen}
      <SettingsScreen open={settingsOpen} offPlugins={[...widgets.offPlugins, ...widgets.offSites]} onTurnOnPlugin={widgets.turnOn} settings={appSettings} onChange={(next) => { setAppSettings(next); saveSettings(next); }} onClose={() => setSettingsOpen(false)} update={update} />
      <UpdateScreen update={update} />
      {widgets.crashNotice.length > 0 && <InfoToast message={t("guard.notice", widgets.crashNotice.join(", "))} onDone={widgets.dismissNotice} durationMs={20_000} />}
      {update.justUpdatedTo && <InfoToast message={t("update.updated", update.justUpdatedTo)} onDone={update.dismissUpdated} />}
      {conn.versionNotice && (
        <InfoToast
          message={
            conn.versionNotice.compat === "server-too-old"
              ? t("version.serverTooOld", conn.versionNotice.serverVersion, conn.versionNotice.required)
              : t("version.appTooOld", conn.versionNotice.serverVersion)
          }
          onDone={conn.dismissVersionNotice}
          durationMs={12_000}
        />
      )}
    </PluginWidgetContext.Provider>
  );

  function renderScreen() {
  if (scanning) {
    return <QrScanScreen onCancel={() => setScanning(false)} onScanned={handleScanned} />;
  }

  const { profile } = conn;
  const page = profile?.pages.find((p) => p.id === conn.pageId) ?? profile?.pages[0];

  // Pairing always wins over a cached layout — a stale grid with no indication a PIN is needed would
  // just look broken ("Offline" forever) instead of telling the user what to do about it.
  if (!profile || !page || conn.status === "pairing_required" || addingServer) {
    return (
      <ConnectScreen
        host={host}
        status={conn.status}
        onHostChange={setHost}
        onConnect={() => host.trim() && connect(withDefaultPort(host.trim()))}
        onSubmitPin={conn.retryWithPin}
        onScanQr={() => setScanning(true)}
        servers={conn.servers}
        onPickServer={connect}
        pairingError={conn.pairingError}
        pairingRetrySeconds={conn.pairingRetrySeconds}
        onCancel={
          addingServer
            ? () => {
                setHost(conn.activeHost);
                setAddingServer(false);
              }
            : undefined
        }
        onOpenSettings={addingServer ? undefined : () => setSettingsOpen(true)}
      />
    );
  }

  return (
    <DeckScreen
      page={page}
      pages={profile.pages}
      status={conn.status}
      usingCache={conn.usingCache}
      actionError={conn.actionError}
      states={conn.states}
      dragValues={conn.dragValues}
      onDragValuesChange={conn.setDragValues}
      profiles={conn.profiles}
      currentProfileId={profile.id}
      servers={conn.servers}
      activeHost={conn.activeHost}
      onPickServer={(h) => {
        setDrawerOpen(false);
        if (h !== conn.activeHost) connect(h);
      }}
      onForgetServer={(h) => {
        conn.forget(h);
        if (h === conn.activeHost) setHost("");
      }}
      onAddServer={() => {
        setDrawerOpen(false);
        setHost("");
        setAddingServer(true);
      }}
      autoSwitch={conn.autoSwitch}
      onToggleAutoSwitchLock={() => conn.setProfileLock(!conn.autoSwitch?.locked)}
      drawerOpen={drawerOpen}
      onDrawerOpenChange={setDrawerOpen}
      onPickProfile={(id) => {
        conn.changeProfile(id);
        setDrawerOpen(false);
      }}
      onWidgetEvent={onWidgetEvent}
      onWidgetValueCommit={onWidgetValueCommit}
      onSwipeNextPage={conn.nextPage}
      onSwipePrevPage={conn.prevPage}
      onSettingsOpenChange={setSettingsOpen}
      update={update}
      webPages={webPages}
      webLimit={webLimitFor(appSettings)}
      webGuard={{ ready: widgets.guardReady, disabled: widgets.disabledIds, onTurnOn: widgets.turnOn }}
      pluginLive={appVisible}
      showPerformance={appSettings.showPerformance}
    />
  );
  }
}
