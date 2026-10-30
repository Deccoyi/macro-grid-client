import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PluginWidgetRuntime, type PluginWidgetContextValue, type PluginWidgetTexts } from "@macro/renderer";
import { getLanguage, t } from "../i18n";
import { forgivePlugin, isWebGuardId, loadWidgetGuardState, reportRunningPlugins, turnOnPlugin } from "../native/widgetGuard";
import type { AppSettings } from "../storage/settings";
import { liveLimitsFor } from "../widgets/limits";
import { DeckPluginWidgetHost } from "../widgets/pluginWidgetHost";

/** A plugin whose widgets ran this long without a crash is forgiven its earlier strikes. */
const FORGIVE_AFTER_MS = 60_000;

export function pluginWidgetTexts(): PluginWidgetTexts {
  return {
    widget: t("widget.plugin"),
    restart: t("widget.restart"),
    unavailable: {
      missing: t("widget.unavailable.missing"),
      disabled: t("widget.unavailable.disabled"),
      needsApproval: t("widget.unavailable.needsApproval"),
      incompatible: t("widget.unavailable.incompatible"),
      invalid: t("widget.unavailable.invalid"),
      noWidget: t("widget.unavailable.noWidget"),
      unsupported: t("widget.unavailable.unsupported"),
      off: t("widget.unavailable.off"),
      crashedOff: t("widget.unavailable.crashedOff"),
    },
    stopped: {
      frozen: t("widget.stopped.frozen"),
      startTimeout: t("widget.stopped.startTimeout"),
      tooBusy: t("widget.stopped.tooBusy"),
      tooMany: t("widget.stopped.tooMany"),
      crashed: t("widget.stopped.crashed"),
      failed: t("widget.stopped.failed"),
    },
  };
}

/**
 * The phone's side of plugin widgets: one runtime (it owns the sandboxed frames and workers) and one host (it talks to the server) for the life of
 * the app, the limits from the person's settings, and the value the renderer's provider needs. `setSend` is how the host reaches the connection.
 *
 * It also guards the app against a widget that kills the web view: the runtime reports the plugins with live widgets to the phone before each worker
 * starts, and at start the phone says which plugins to keep off and which ones the last crash is blamed on. Widgets wait for that answer before they
 * start, so a plugin that was just switched off is never started again by the cached layout.
 */
export function usePluginWidgets(settings: Pick<AppSettings, "showPluginWidgets" | "pluginWidgetLimit" | "pluginWidgetLimitCount">, currentPageId: string | undefined) {
  const sendRef = useRef<(type: string, data?: unknown) => void>(() => undefined);
  const pageIdRef = useRef<string | undefined>(currentPageId);
  pageIdRef.current = currentPageId;
  /** When each plugin was first seen live in the current run of live widgets, for the forgiveness timer. */
  const liveSince = useRef(new Map<string, number>());

  const { runtime, host } = useMemo(() => {
    const runtime = new PluginWidgetRuntime({
      // The runtime waits for the phone's confirmation before a worker starts.
      onLiveChange: (plugins) => {
        const confirmed = reportRunningPlugins(plugins);
        const now = Date.now();
        for (const id of plugins) if (!liveSince.current.has(id)) liveSince.current.set(id, now);
        for (const id of [...liveSince.current.keys()]) if (!plugins.includes(id)) liveSince.current.delete(id);
        return confirmed;
      },
    });
    const host = new DeckPluginWidgetHost({ send: (type, data) => sendRef.current(type, data) }, () => pageIdRef.current);
    return { runtime, host };
  }, []);
  useEffect(() => () => runtime.dispose(), [runtime]);

  const [guard, setGuard] = useState<{ ready: boolean; disabled: ReadonlySet<string>; off: string[]; notice: string[] }>({ ready: false, disabled: new Set(), off: [], notice: [] });
  useEffect(() => {
    let cancelled = false;
    void loadWidgetGuardState().then((state) => {
      if (cancelled) return;
      // Plugin ids and `web:<host>` ids come in one list; the notice names a site by its host.
      setGuard({
        ready: true,
        disabled: new Set([...state.off, ...state.probation]),
        off: state.off,
        notice: (state.notice?.plugins ?? []).map((id) => (isWebGuardId(id) ? id.slice(4) : id)),
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [id, since] of liveSince.current) {
        if (now - since >= FORGIVE_AFTER_MS) {
          forgivePlugin(id);
          liveSince.current.set(id, Infinity);
        }
      }
    }, 15_000);
    return () => clearInterval(timer);
  }, []);

  const { pluginWidgetLimit, pluginWidgetLimitCount } = settings;
  useEffect(() => {
    const limits = liveLimitsFor({ pluginWidgetLimit, pluginWidgetLimitCount });
    runtime.setLiveLimits(limits.maxLive, limits.maxLiveUnverified);
  }, [runtime, pluginWidgetLimit, pluginWidgetLimitCount]);

  const language = getLanguage();
  const context = useMemo<PluginWidgetContextValue>(
    () => ({ runtime, host, enabled: settings.showPluginWidgets && guard.ready, disabledPlugins: guard.disabled, texts: pluginWidgetTexts() }),
    // The texts follow the language, which t() reads globally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runtime, host, settings.showPluginWidgets, guard.ready, guard.disabled, language],
  );

  const turnOn = useCallback((plugin: string) => {
    turnOnPlugin(plugin);
    setGuard((g) => {
      const disabled = new Set(g.disabled);
      disabled.delete(plugin);
      return { ...g, disabled, off: g.off.filter((id) => id !== plugin) };
    });
  }, []);
  const dismissNotice = useCallback(() => setGuard((g) => ({ ...g, notice: [] })), []);

  return {
    context,
    /** Plugins the phone switched off after a crash and that stay off until the person turns them on. */
    offPlugins: guard.off.filter((id) => !isWebGuardId(id)),
    /** The same for web sites, as `web:<host>` ids. */
    offSites: guard.off.filter(isWebGuardId),
    /** Whether the phone has answered; no web page starts before that. */
    guardReady: guard.ready,
    /** Everything the phone keeps off now (off for good or for this session): plugin ids and `web:<host>` ids. */
    disabledIds: guard.disabled,
    /** The plugins blamed for the last crash, to tell the person once. */
    crashNotice: guard.notice,
    dismissNotice,
    turnOnPlugin: turnOn,
    /** Turns a plugin or a `web:<host>` site back on. */
    turnOn,
    /** Called by the connection: what the host needs from it. */
    connectionEvents: {
      onPluginWidgetMessage: (type: string, data: unknown) => host.onMessage(type, data),
      onAsset: (hash: string, data: string | null) => host.onAsset(hash, data),
      onWelcome: () => host.onReconnected(),
    },
    setSend: (send: (type: string, data?: unknown) => void) => {
      sendRef.current = send;
    },
  };
}
