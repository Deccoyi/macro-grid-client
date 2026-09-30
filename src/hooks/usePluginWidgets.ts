import { useEffect, useMemo, useRef } from "react";
import { PluginWidgetRuntime, type PluginWidgetContextValue, type PluginWidgetTexts } from "@macro/renderer";
import { getLanguage, t } from "../i18n";
import type { AppSettings } from "../storage/settings";
import { liveLimitsFor } from "../widgets/limits";
import { DeckPluginWidgetHost } from "../widgets/pluginWidgetHost";

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
 * the app, the limits from the person's settings, and the value the renderer's provider needs. `send` is how the host reaches the connection.
 */
export function usePluginWidgets(settings: Pick<AppSettings, "showPluginWidgets" | "pluginWidgetLimit" | "pluginWidgetLimitCount">, currentPageId: string | undefined) {
  const sendRef = useRef<(type: string, data?: unknown) => void>(() => undefined);
  const pageIdRef = useRef<string | undefined>(currentPageId);
  pageIdRef.current = currentPageId;

  const { runtime, host } = useMemo(() => {
    const runtime = new PluginWidgetRuntime();
    const host = new DeckPluginWidgetHost({ send: (type, data) => sendRef.current(type, data) }, () => pageIdRef.current);
    return { runtime, host };
  }, []);
  useEffect(() => () => runtime.dispose(), [runtime]);

  const { pluginWidgetLimit, pluginWidgetLimitCount } = settings;
  useEffect(() => {
    const limits = liveLimitsFor({ pluginWidgetLimit, pluginWidgetLimitCount });
    runtime.setLiveLimits(limits.maxLive, limits.maxLiveUnverified);
  }, [runtime, pluginWidgetLimit, pluginWidgetLimitCount]);

  const language = getLanguage();
  const context = useMemo<PluginWidgetContextValue>(
    () => ({ runtime, host, enabled: settings.showPluginWidgets, texts: pluginWidgetTexts() }),
    // The texts follow the language, which t() reads globally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runtime, host, settings.showPluginWidgets, language],
  );

  return {
    context,
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
