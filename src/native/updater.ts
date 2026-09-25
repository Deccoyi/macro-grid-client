import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/** Codes a rejected updater call carries in `error.code` (see UpdaterPlugin.java). */
export type UpdaterErrorCode =
  | "bad_request"
  | "metered"
  | "cancelled"
  | "network"
  | "too_large"
  | "size_mismatch"
  | "verification_failed"
  | "signer_mismatch"
  | "not_downloaded"
  | "install_not_allowed"
  | "install_failed"
  | "no_settings"
  | `http_${number}`;

export interface FetchReleasesResult {
  /** 200, or 304 when the list is unchanged since `etag` (then `body` is null). */
  status: number;
  etag: string | null;
  body: string | null;
}

export interface Connection {
  connected: boolean;
  /** Wi-Fi without a data limit. A phone hotspot or mobile data is metered. */
  unmetered: boolean;
}

export interface DownloadRequest {
  url: string;
  version: string;
  size: number;
  /** Lower case hex SHA-256 the release reports. */
  sha256: string;
  /** False: the download stops when the network is metered (the Wi-Fi only setting). */
  allowMetered: boolean;
}

export interface DownloadProgress {
  received: number;
  total: number;
}

/** What Android's installer answered after its own confirmation dialog. */
export type InstallStatus = "success" | "cancelled" | "incompatible" | "storage" | "failed";

export interface InstallResult {
  status: InstallStatus;
  message: string;
}

interface UpdaterPlugin {
  fetchReleases(opts: { etag: string | null }): Promise<FetchReleasesResult>;
  getConnection(): Promise<Connection>;
  download(opts: DownloadRequest): Promise<{ version: string }>;
  cancelDownload(): Promise<void>;
  canInstall(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  install(opts: { version: string }): Promise<void>;
  cleanUp(opts: { keep: string | null }): Promise<{ removed: number }>;
  addListener(event: "downloadProgress", listener: (progress: DownloadProgress) => void): Promise<PluginListenerHandle>;
  addListener(event: "installResult", listener: (result: InstallResult) => void): Promise<PluginListenerHandle>;
}

const Updater = registerPlugin<UpdaterPlugin>("Updater");

/** Self-update only exists in the installed Android app; the browser deck never updates itself. */
export const updaterAvailable = (): boolean => Capacitor.isNativePlatform();

/** The releases list of this app's repository (the address is fixed in the native code, never passed in). */
export const fetchReleases = (etag: string | null) => Updater.fetchReleases({ etag });
export const getConnection = () => Updater.getConnection();
export const downloadUpdate = (request: DownloadRequest) => Updater.download(request);
export const cancelDownload = () => Updater.cancelDownload();
export const canInstallUpdates = async () => (await Updater.canInstall()).allowed;
export const openInstallSettings = () => Updater.openInstallSettings();
export const installUpdate = (version: string) => Updater.install({ version });

/** Removes every downloaded update except `keep` (null: all). Best effort: a failure is ignored, the next start tries again. */
export function cleanUpDownloads(keep: string | null): void {
  if (!updaterAvailable()) return;
  Updater.cleanUp({ keep }).catch(() => {});
}

export const onDownloadProgress = (listener: (progress: DownloadProgress) => void) => Updater.addListener("downloadProgress", listener);
export const onInstallResult = (listener: (result: InstallResult) => void) => Updater.addListener("installResult", listener);

/** The `code` of a rejected plugin call, or "network" for anything else. */
export function updaterErrorCode(error: unknown): UpdaterErrorCode {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? (code as UpdaterErrorCode) : "network";
}
