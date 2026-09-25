import { useCallback, useEffect, useRef, useState } from "react";
import { version as APP_VERSION } from "../../package.json";
import {
  canInstallUpdates,
  cancelDownload,
  cleanUpDownloads,
  downloadUpdate,
  fetchReleases,
  getConnection,
  installUpdate,
  onDownloadProgress,
  onInstallResult,
  openInstallSettings,
  updaterAvailable,
  updaterErrorCode,
} from "../native/updater";
import { findUpdate, parseReleases, type UpdateOffer } from "../update/releaseFeed";
import { parseVersion, versionCore, versionToString } from "../update/releaseVersion";
import {
  FIRST_CHECK_DELAY_MS,
  afterAnnounced,
  afterLater,
  afterSkip,
  isCheckDue,
  shouldOpenByItself,
  updatedTo,
  versionToKeep,
} from "../update/updatePolicy";
import { loadUpdateState, saveUpdateState, type UpdateState } from "../update/updateState";
import type { AppSettings } from "../storage/settings";

/** Text keys of the errors the update screen can show (`update.error.<key>` in the dictionaries). */
export type UpdateErrorKey = "offline" | "network" | "verification" | "signer" | "cancelled" | "storage" | "incompatible" | "failed";

/** What the update screen is doing. Everything before the download is decided by the person's settings and the connection. */
export type UpdatePhase =
  | { kind: "idle" }
  /** Wi-Fi only is set and the phone is on mobile data: nothing downloads until Wi-Fi, unless the person chooses to once. */
  | { kind: "waitingForWifi" }
  /** Asks, with the file size, before a download over mobile data. */
  | { kind: "confirmMobile" }
  | { kind: "downloading"; received: number; total: number }
  /** The one-time explanation before Android's "install unknown apps" page opens. */
  | { kind: "needsPermission" }
  /** Android's own confirmation dialog is on screen. */
  | { kind: "installing" }
  | { kind: "error"; key: UpdateErrorKey };

export type CheckResult = "upToDate" | "failed" | null;

export interface UpdateController {
  /** False in a browser: the deck there never updates itself. */
  available: boolean;
  runningVersion: string;
  /** The newer release, or null. Also drives the dot and the drawer row. */
  offer: UpdateOffer | null;
  screenOpen: boolean;
  phase: UpdatePhase;
  /** A manual check is running. */
  checking: boolean;
  /** The result of the last manual check, until the next one. */
  lastCheck: CheckResult;
  /** "0.2.0" once, at the first start after an update. */
  justUpdatedTo: string | null;
  openScreen: () => void;
  later: () => void;
  skip: () => void;
  checkNow: () => void;
  startUpdate: () => void;
  /** Wi-Fi only and on mobile data: download this once anyway (asks the size first). */
  downloadOverMobileOnce: () => void;
  confirmMobile: () => void;
  /** Leaves a question or a download (back to the offer). */
  cancel: () => void;
  continueToPermission: () => void;
  dismissUpdated: () => void;
}

const RUNNING = parseVersion(APP_VERSION);
const TICK_MS = 15 * 60 * 1000;
const DEBUG_FEED: string | undefined = import.meta.env.VITE_DEBUG_UPDATE_FEED;

/**
 * The self-update of the installed Android app (plan: docs/plans/phone-app-auto-update-plan.md): looks for a newer release at start
 * (after a short delay), every six hours while the app is open and when it comes back to the foreground; keeps the offer; and runs
 * "Update now" (connection check, download, permission, Android's installer). The decisions themselves live in `update/`.
 */
export function useUpdate(settings: AppSettings): UpdateController {
  const available = updaterAvailable() && RUNNING !== null;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const stateRef = useRef<UpdateState>(loadUpdateState());
  const offerRef = useRef<UpdateOffer | null>(null);
  const checkingRef = useRef(false);
  const coldStartRef = useRef(true);
  const mobileOnceRef = useRef(false);
  const mobileConfirmedRef = useRef(false);
  const waitingForPermissionRef = useRef(false);
  const busyRef = useRef(false);

  const [offer, setOfferState] = useState<UpdateOffer | null>(null);
  const [screenOpen, setScreenOpen] = useState(false);
  const [phase, setPhaseState] = useState<UpdatePhase>({ kind: "idle" });
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<CheckResult>(null);
  const [justUpdatedTo, setJustUpdatedTo] = useState<string | null>(null);

  const setOffer = useCallback((next: UpdateOffer | null) => {
    offerRef.current = next;
    setOfferState(next);
  }, []);
  const setPhase = useCallback((next: UpdatePhase) => setPhaseState(next), []);

  const patchState = useCallback((change: (state: UpdateState) => UpdateState) => {
    stateRef.current = change(stateRef.current);
    saveUpdateState(stateRef.current);
  }, []);

  /** Reads the releases list into the offer with the current settings; false when the text is not a release list. */
  const applyReleases = useCallback(
    (json: string | null): UpdateOffer | null => {
      if (!json || !RUNNING) return null;
      try {
        const found = findUpdate(parseReleases(json), RUNNING, settingsRef.current.includePreReleases);
        setOffer(found);
        return found;
      } catch {
        return null;
      }
    },
    [setOffer],
  );

  const runCheck = useCallback(
    async (manual: boolean): Promise<void> => {
      if (!available || checkingRef.current) return;
      checkingRef.current = true;
      if (manual) {
        setChecking(true);
        setLastCheck(null);
      }
      try {
        const current = stateRef.current;
        // Only a build made with VITE_DEBUG_UPDATE_FEED set reads a made-up list (to try the screens without a release); a release
        // build has no such value, so this branch is removed from it and the address is always the fixed releases list.
        const answer = DEBUG_FEED ? { status: 200, etag: null, body: DEBUG_FEED } : await fetchReleases(current.etag);
        const json = answer.status === 304 ? current.releasesJson : answer.body;
        if (json === null) throw new Error("No releases list");
        patchState((s) => ({ ...s, etag: answer.etag ?? s.etag, releasesJson: json, lastCheckAt: Date.now() }));

        const found = applyReleases(json);
        cleanUpDownloads(versionToKeep(found));
        if (manual) {
          setLastCheck(found ? null : "upToDate");
          if (found) setScreenOpen(true);
        } else if (
          shouldOpenByItself(found, stateRef.current, { autoCheckEnabled: settingsRef.current.checkForUpdates, coldStart: coldStartRef.current, now: Date.now() })
        ) {
          patchState((s) => afterAnnounced(s, found!));
          setScreenOpen(true);
        }
      } catch {
        // Offline, GitHub unreachable or rate limited: nothing is shown; the next interval tries again (a manual check says so).
        if (manual) setLastCheck("failed");
      } finally {
        coldStartRef.current = false;
        checkingRef.current = false;
        if (manual) setChecking(false);
      }
    },
    [available, applyReleases, patchState],
  );

  // Start-up: say "Updated to X" once, show the offer that is already known, remove downloads that are not needed, then check after a delay.
  useEffect(() => {
    if (!available || !RUNNING) return;
    const notice = updatedTo(stateRef.current, RUNNING);
    if (notice) setJustUpdatedTo(notice);
    patchState((s) => ({ ...s, lastRunVersion: versionToString(RUNNING) }));

    const cached = applyReleases(stateRef.current.releasesJson);
    cleanUpDownloads(versionToKeep(cached));

    const first = setTimeout(() => {
      if (settingsRef.current.checkForUpdates) void runCheck(false);
      else coldStartRef.current = false;
    }, FIRST_CHECK_DELAY_MS);
    const tick = setInterval(() => {
      if (settingsRef.current.checkForUpdates && isCheckDue(stateRef.current, Date.now())) void runCheck(false);
    }, TICK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(tick);
    };
  }, [available, applyReleases, patchState, runCheck]);

  // The pre-release setting changes which release counts as an update.
  useEffect(() => {
    if (available) applyReleases(stateRef.current.releasesJson);
  }, [available, settings.includePreReleases, applyReleases]);

  // ---- "Update now" ------------------------------------------------------------------------------------------------

  const proceedToInstall = useCallback(async (version: string) => {
    try {
      if (!(await canInstallUpdates())) {
        waitingForPermissionRef.current = true;
        setPhase({ kind: "needsPermission" });
        return;
      }
      waitingForPermissionRef.current = false;
      setPhase({ kind: "installing" });
      await installUpdate(version);
      // The outcome arrives as an installResult event, after Android's dialog.
    } catch (error) {
      const code = updaterErrorCode(error);
      if (code === "install_not_allowed") {
        waitingForPermissionRef.current = true;
        setPhase({ kind: "needsPermission" });
      } else if (code === "signer_mismatch") setPhase({ kind: "error", key: "signer" });
      else setPhase({ kind: "error", key: "failed" });
    }
  }, [setPhase]);

  const download = useCallback(async () => {
    const current = offerRef.current;
    const apk = current?.latest.apk;
    if (!current || !apk) return;
    const version = versionCore(current.latest.version);
    busyRef.current = true;
    setPhase({ kind: "downloading", received: 0, total: apk.size });
    try {
      await downloadUpdate({
        url: apk.url,
        version,
        size: apk.size,
        sha256: apk.sha256,
        allowMetered: settingsRef.current.updateNetwork === "any" || mobileOnceRef.current,
      });
    } catch (error) {
      busyRef.current = false;
      const code = updaterErrorCode(error);
      if (code === "metered") setPhase({ kind: "waitingForWifi" });
      else if (code === "cancelled") setPhase({ kind: "idle" });
      else if (code === "signer_mismatch") setPhase({ kind: "error", key: "signer" });
      else if (code === "verification_failed" || code === "size_mismatch") setPhase({ kind: "error", key: "verification" });
      else setPhase({ kind: "error", key: "network" });
      return;
    }
    busyRef.current = false;
    await proceedToInstall(version);
  }, [proceedToInstall, setPhase]);

  const startUpdate = useCallback(async () => {
    const current = offerRef.current;
    if (!current?.latest.apk || busyRef.current) return;
    mobileOnceRef.current = false;
    mobileConfirmedRef.current = false;

    const connection = await getConnection().catch(() => ({ connected: true, unmetered: false }));
    if (!connection.connected) {
      setPhase({ kind: "error", key: "offline" });
      return;
    }
    if (!connection.unmetered) {
      if (settingsRef.current.updateNetwork === "wifi") {
        setPhase({ kind: "waitingForWifi" });
        return;
      }
      // Wi-Fi and mobile data is allowed: still ask, with the size, before spending mobile data.
      setPhase({ kind: "confirmMobile" });
      return;
    }
    await download();
  }, [download, setPhase]);

  const downloadOverMobileOnce = useCallback(() => {
    mobileOnceRef.current = true;
    setPhase({ kind: "confirmMobile" });
  }, [setPhase]);

  const confirmMobile = useCallback(() => {
    mobileConfirmedRef.current = true;
    mobileOnceRef.current = true;
    void download();
  }, [download]);

  const cancel = useCallback(() => {
    waitingForPermissionRef.current = false;
    mobileOnceRef.current = false;
    mobileConfirmedRef.current = false;
    if (busyRef.current) void cancelDownload().catch(() => {});
    setPhase({ kind: "idle" });
  }, [setPhase]);

  const continueToPermission = useCallback(() => {
    waitingForPermissionRef.current = true;
    void openInstallSettings().catch(() => setPhase({ kind: "error", key: "failed" }));
  }, [setPhase]);

  // Wi-Fi only on mobile data: while the update screen stays open, start the download by itself as soon as the phone is on Wi-Fi.
  useEffect(() => {
    if (!available || !screenOpen || phase.kind !== "waitingForWifi") return;
    const watch = setInterval(() => {
      void getConnection()
        .then((c) => {
          if (c.connected && c.unmetered && !busyRef.current) void download();
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(watch);
  }, [available, screenOpen, phase.kind, download]);

  // Progress of a running download, and Android's answer after its confirmation dialog.
  useEffect(() => {
    if (!available) return;
    const handles = [
      onDownloadProgress(({ received, total }) => setPhaseState((p) => (p.kind === "downloading" ? { kind: "downloading", received, total } : p))),
      onInstallResult(({ status }) => {
        if (status === "success") return; // Android stops the app while it replaces it.
        const key: UpdateErrorKey = status === "cancelled" ? "cancelled" : status === "storage" ? "storage" : status === "incompatible" ? "incompatible" : "failed";
        setPhaseState({ kind: "error", key });
      }),
    ];
    return () => {
      for (const handle of handles) void handle.then((h) => h.remove()).catch(() => {});
    };
  }, [available]);

  // Back from Android's settings page (or the app coming to the foreground): continue the install once it is allowed; check again when due.
  useEffect(() => {
    if (!available) return;
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      const current = offerRef.current;
      if (waitingForPermissionRef.current && current?.latest.apk && (await canInstallUpdates().catch(() => false))) {
        waitingForPermissionRef.current = false;
        await proceedToInstall(versionCore(current.latest.version));
        return;
      }
      if (settingsRef.current.checkForUpdates && isCheckDue(stateRef.current, Date.now())) void runCheck(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [available, proceedToInstall, runCheck]);

  // ---- The screen's other buttons ----------------------------------------------------------------------------------

  const openScreen = useCallback(() => {
    setPhase({ kind: "idle" });
    setScreenOpen(true);
  }, [setPhase]);

  const closeScreen = useCallback(() => {
    if (busyRef.current) void cancelDownload().catch(() => {});
    waitingForPermissionRef.current = false;
    setPhase({ kind: "idle" });
    setScreenOpen(false);
  }, [setPhase]);

  const later = useCallback(() => {
    patchState((s) => afterLater(s, Date.now()));
    closeScreen();
  }, [closeScreen, patchState]);

  const skip = useCallback(() => {
    const current = offerRef.current;
    if (current) patchState((s) => afterSkip(s, current));
    closeScreen();
  }, [closeScreen, patchState]);

  return {
    available,
    runningVersion: APP_VERSION,
    offer,
    screenOpen,
    phase,
    checking,
    lastCheck,
    justUpdatedTo,
    openScreen,
    later,
    skip,
    checkNow: () => void runCheck(true),
    startUpdate: () => void startUpdate(),
    downloadOverMobileOnce,
    confirmMobile,
    cancel,
    continueToPermission,
    dismissUpdated: () => setJustUpdatedTo(null),
  };
}
