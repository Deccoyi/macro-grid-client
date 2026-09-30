import { Capacitor, registerPlugin } from "@capacitor/core";

/** What the phone kept across the last crash of the web view (see WidgetGuard.java). */
export interface WidgetGuardState {
  /** Plugins whose widgets stay off until the person turns them on. */
  off: string[];
  /** Plugins that stay off for this session only. */
  probation: string[];
  /** The plugins blamed for the last crash; given once. */
  notice?: { plugins: string[]; at: number };
}

interface WidgetGuardPlugin {
  setRunning(options: { plugins: string[] }): Promise<void>;
  state(): Promise<WidgetGuardState>;
  turnOn(options: { plugin: string }): Promise<void>;
  forgive(options: { plugin: string }): Promise<void>;
}

const Guard = registerPlugin<WidgetGuardPlugin>("WidgetGuard");

const EMPTY: WidgetGuardState = { off: [], probation: [] };

/** Tells the phone which plugins have live widgets now, so it knows whom to blame if the web view dies. Ignored on the web. */
export function reportRunningPlugins(plugins: string[]): void {
  if (!Capacitor.isNativePlatform()) return;
  Guard.setRunning({ plugins }).catch(() => {});
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
