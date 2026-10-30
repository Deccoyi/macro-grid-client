import { Capacitor, registerPlugin } from "@capacitor/core";

/** What the phone kept across the last crash of the web view (see WidgetGuard.java). Ids are plugin ids or `web:<host>` (see `webGuardId`). */
export interface WidgetGuardState {
  /** Plugins and web sites whose widgets stay off until the person turns them on. */
  off: string[];
  /** Plugins and web sites that stay off for this session only. */
  probation: string[];
  /** Who is blamed for the last crash; given once. */
  notice?: { plugins: string[]; at: number };
}

const WEB_PREFIX = "web:";

/** The id a web page is blamed under: its host only (an address may carry a secret), or null when the address has no usable host. */
export function webGuardId(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host ? WEB_PREFIX + host : null;
  } catch {
    return null;
  }
}

export function isWebGuardId(id: string): boolean {
  return id.startsWith(WEB_PREFIX);
}

interface WidgetGuardPlugin {
  /** One list for everything live (plugins and web sites): the phone keeps one list, so two callers writing their own halves would overwrite each other. */
  setRunning(options: { plugins: string[] }): Promise<void>;
  state(): Promise<WidgetGuardState>;
  turnOn(options: { plugin: string }): Promise<void>;
  forgive(options: { plugin: string }): Promise<void>;
}

const Guard = registerPlugin<WidgetGuardPlugin>("WidgetGuard");

const EMPTY: WidgetGuardState = { off: [], probation: [] };

let runningPlugins: string[] = [];
let runningWeb: string[] = [];
/** Reports go one after the other, so the phone ends with the last list. */
let queue: Promise<void> = Promise.resolve();

function report(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  const plugins = [...new Set([...runningPlugins, ...runningWeb])];
  queue = queue.then(() => Guard.setRunning({ plugins })).catch(() => {});
  return queue;
}

/**
 * Tells the phone which plugins have live widgets now, so it knows whom to blame if the web view dies. Resolves when the phone has written the
 * whole list (plugins and web sites together) down: start the worker after that. Ignored on the web.
 */
export function reportRunningPlugins(plugins: string[]): Promise<void> {
  runningPlugins = plugins;
  return report();
}

/** The same for web pages: the `web:<host>` ids of the pages that are about to be mounted or are mounted. Mount an iframe only after this resolves. */
export function reportRunningWebSites(ids: string[]): Promise<void> {
  runningWeb = ids;
  return report();
}

/** What to keep off and what to tell the person about the last crash. Reading it clears the notice and the one-session list, so ask once per start. */
export async function loadWidgetGuardState(): Promise<WidgetGuardState> {
  if (!Capacitor.isNativePlatform()) return EMPTY;
  try {
    const state = await Guard.state();
    return { off: state.off ?? [], probation: state.probation ?? [], notice: state.notice };
  } catch {
    return EMPTY;
  }
}

export function turnOnPlugin(plugin: string): void {
  if (Capacitor.isNativePlatform()) Guard.turnOn({ plugin }).catch(() => {});
}

/** A plugin's widgets ran for a while without a crash: its earlier strikes are forgiven. */
export function forgivePlugin(plugin: string): void {
  if (Capacitor.isNativePlatform()) Guard.forgive({ plugin }).catch(() => {});
}
