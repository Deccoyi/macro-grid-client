import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile, WidgetState } from "@macro/renderer";
import { ACTION_ERROR_MS } from "../constants";
import { t } from "../i18n";
import { getDeviceId } from "../storage/deviceId";
import { HOST_KEY, tokenKey } from "../storage/keys";
import { loadLayoutCache, resolveCachedProfile, saveLayoutCache } from "../storage/layoutCache";
import { forgetServer, loadServers, rememberServer } from "../storage/servers";
import { readText, writeText } from "../storage/storage";
import { ServerConnection, type AutoSwitchInfo, type ConnectionStatus, type ProfileSummary } from "../ws/connection";

/** Removes the given keys from a record, keeping the same object when nothing would change. */
function omitKeys<T>(record: Record<string, T>, keys: Iterable<string>): Record<string, T> {
  const next = { ...record };
  for (const key of keys) delete next[key];
  return next;
}

/**
 * Owns the connection to one server at a time and everything the deck derives from it: connection status,
 * the current layout and page, live widget state, the profile list and the last action error. Reconnects
 * to the last used server on launch, and shows the cached layout of a host while the first real one is
 * still in flight.
 */
export function useServerConnection() {
  const [initialHost] = useState(() => readText(HOST_KEY) ?? "");
  const [initialCache] = useState(() => loadLayoutCache(initialHost));

  /** The server the socket is actually pointed at. */
  const [activeHost, setActiveHost] = useState(initialHost);
  const [servers, setServers] = useState<string[]>(loadServers);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [usingCache, setUsingCache] = useState(initialCache !== null);
  const [profile, setProfile] = useState<Profile | null>(() => resolveCachedProfile(initialCache));
  const [pageId, setPageId] = useState<string | null>(initialCache?.pageId ?? null);
  const [states, setStates] = useState<Record<string, WidgetState>>({});
  /** Local optimistic slider/knob position while dragging (and right after a commit, until the server's
   * own widget.state — if this widget is bound to a variable — confirms/overrides it). Cleared per-widget
   * the moment a real widget.state arrives for it, so a variable that's also changing from elsewhere
   * (another device, Windows itself) doesn't get stuck showing a stale local drag forever. */
  const [dragValues, setDragValues] = useState<Record<string, number>>({});
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [autoSwitch, setAutoSwitch] = useState<AutoSwitchInfo | null>(null);
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
        setStates((prev) => omitKeys(prev, changedWidgetIds));
        setDragValues((prev) => omitKeys(prev, changedWidgetIds));
        saveLayoutCache(targetHost, cacheProfile, nextPageId);
      },
      onPageChange: (nextPageId) => {
        setPageId(nextPageId);
        if (cacheProfileRef.current) saveLayoutCache(targetHost, cacheProfileRef.current, nextPageId);
      },
      onWidgetState: (state) => {
        setStates((prev) => ({ ...prev, [state.widgetId]: { ...prev[state.widgetId], ...state } }));
        if (state.value !== undefined) {
          setDragValues((prev) => (state.widgetId in prev ? omitKeys(prev, [state.widgetId]) : prev));
        }
      },
      onProfiles: (nextProfiles, nextAutoSwitch) => {
        setProfiles(nextProfiles);
        setAutoSwitch(nextAutoSwitch);
      },
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

  // Reconnect automatically to the last known server on launch. The very first render already shows any
  // cached layout (see the initial state above) so a cold start looks like the deck immediately, not the
  // connect screen.
  useEffect(() => {
    if (initialHost) connect(initialHost);
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

  /** Connects to a host taken from a scanned QR code, submitting its PIN when the server asks for one. */
  const connectScanned = useCallback(
    (scannedHost: string, pin: string | null) => {
      pendingQrPinRef.current = pin;
      connect(scannedHost);
    },
    [connect],
  );

  const forget = useCallback((host: string) => setServers(forgetServer(host)), []);

  return {
    activeHost,
    servers,
    status,
    usingCache,
    profile,
    pageId,
    states,
    dragValues,
    setDragValues,
    profiles,
    autoSwitch,
    actionError,
    connect,
    connectScanned,
    forget,
    /** Sends a protocol message on the live socket (dropped while disconnected). */
    send: (type: string, data?: unknown) => connectionRef.current?.send(type, data),
    retryWithPin: (pin: string) => connectionRef.current?.retryWithPin(pin),
    changeProfile: (profileId: string) => connectionRef.current?.changeProfile(profileId),
    setProfileLock: (locked: boolean) => connectionRef.current?.setProfileLock(locked),
    nextPage: () => connectionRef.current?.nextPage(),
    prevPage: () => connectionRef.current?.prevPage(),
  };
}
