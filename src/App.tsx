import { useCallback, useEffect, useState } from "react";
import { InfoToast } from "./components/InfoToast";
import { UpdateScreen } from "./components/UpdateScreen";
import { useKeepAwake } from "./hooks/useKeepAwake";
import { useLanguage } from "./hooks/useLanguage";
import { useServerConnection } from "./hooks/useServerConnection";
import { useUpdate } from "./hooks/useUpdate";
import { t } from "./i18n";
import { ConnectScreen } from "./screens/ConnectScreen";
import { DeckScreen } from "./screens/DeckScreen";
import { QrScanScreen, type ScannedPairing } from "./screens/QrScanScreen";
import { HOST_KEY } from "./storage/keys";
import { applySettings, loadSettings, saveSettings, type AppSettings } from "./storage/settings";
import { readText } from "./storage/storage";

/** Chooses between the QR scanner, the connect screen and the deck, and holds the UI-only state (panels, form text). */
export function App() {
  const conn = useServerConnection();
  /** The connect screen's text field — `conn.activeHost` is the server the socket is actually pointed at. */
  const [host, setHost] = useState(() => readText(HOST_KEY) ?? "");
  /** Forces the connect screen over a live/cached deck so a second server can be added. */
  const [addingServer, setAddingServer] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(loadSettings);
  const [scanning, setScanning] = useState(false);
  const update = useUpdate(appSettings);
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
      connectScanned(result.host, result.pin ?? null);
    },
    [connectScanned],
  );

  // Keep the screen awake whenever we're showing a deck (connected or not, as long as a profile has loaded once).
  useKeepAwake(conn.profile !== null);

  // Every hook above must run on every render — this is the first point an early return is safe.
  const screen = renderScreen();
  return (
    <>
      {screen}
      <UpdateScreen update={update} />
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
    </>
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
        onConnect={() => host.trim() && connect(host.trim())}
        onSubmitPin={conn.retryWithPin}
        onScanQr={() => setScanning(true)}
        servers={conn.servers}
        onPickServer={connect}
        onCancel={
          addingServer
            ? () => {
                setHost(conn.activeHost);
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
      onForgetServer={conn.forget}
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
      onWidgetEvent={(type, widgetId) => conn.send(type, { pageId: page.id, widgetId })}
      onWidgetValueCommit={(widgetId, value) => conn.send("widget.value", { pageId: page.id, widgetId, value })}
      onSwipeNextPage={conn.nextPage}
      onSwipePrevPage={conn.prevPage}
      settingsOpen={settingsOpen}
      onSettingsOpenChange={setSettingsOpen}
      appSettings={appSettings}
      onAppSettingsChange={(next) => {
        setAppSettings(next);
        saveSettings(next);
      }}
      update={update}
    />
  );
  }
}
