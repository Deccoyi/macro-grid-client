import { useCallback, useEffect, useRef, useState } from "react";
import { Grid, WidgetView, type Profile, type WidgetState } from "@macro/renderer";
import { getDeviceId } from "./deviceId";
import { ConnectionStatus, ServerConnection } from "./ws/connection";

const HOST_KEY = "macro-station.host";

export function App() {
  const [host, setHost] = useState(() => localStorage.getItem(HOST_KEY) ?? "");
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, WidgetState>>({});
  const connectionRef = useRef<ServerConnection | null>(null);

  const connect = useCallback((targetHost: string) => {
    connectionRef.current?.disconnect();
    localStorage.setItem(HOST_KEY, targetHost);
    setProfile(null);
    setStates({});

    const connection = new ServerConnection(targetHost, getDeviceId(), "Telefon", {
      onStatusChange: setStatus,
      onLayout: (nextProfile, nextPageId) => {
        setProfile(nextProfile);
        setPageId(nextPageId);
        setStates({});
      },
      onWidgetState: (state) => {
        setStates((prev) => ({ ...prev, [state.widgetId]: { ...prev[state.widgetId], ...state } }));
      },
    });
    connectionRef.current = connection;
    connection.connect();
  }, []);

  // Reconnect automatically to the last known server on launch, like the plan's "reconnect + cache"
  // requirement — this only covers the WS layer for now; asset/layout caching across cold starts is
  // a follow-up increment.
  useEffect(() => {
    if (host) connect(host);
    return () => connectionRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const page = profile?.pages.find((p) => p.id === pageId) ?? profile?.pages[0];

  if (!page) {
    return (
      <ConnectScreen
        host={host}
        status={status}
        onHostChange={setHost}
        onConnect={() => host.trim() && connect(host.trim())}
      />
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0b0d10", padding: 10, boxSizing: "border-box" }}>
      {status !== "connected" && <StatusBadge status={status} />}
      <Grid
        page={page}
        gap="8px"
        renderWidget={(widget) => {
          const state = states[widget.id];
          return (
            <WidgetView
              widget={widget}
              liveText={state?.text}
              liveActive={state?.active}
              liveValue={state?.value}
              liveStyle={state?.style}
              haptics
              onPress={() => connectionRef.current?.send("widget.down", { pageId: page.id, widgetId: widget.id })}
              onRelease={() => connectionRef.current?.send("widget.up", { pageId: page.id, widgetId: widget.id })}
              onLongPress={() => connectionRef.current?.send("widget.longPress", { pageId: page.id, widgetId: widget.id })}
              onDoubleTap={() => connectionRef.current?.send("widget.doubleTap", { pageId: page.id, widgetId: widget.id })}
            />
          );
        }}
      />
    </div>
  );
}

function ConnectScreen({
  host,
  status,
  onHostChange,
  onConnect,
}: {
  host: string;
  status: ConnectionStatus;
  onHostChange: (v: string) => void;
  onConnect: () => void;
}) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 14, alignItems: "center", justifyContent: "center",
        width: "100vw", height: "100vh", background: "#0b0d10", color: "#e6e7ea", fontFamily: "system-ui, sans-serif",
        padding: 24, boxSizing: "border-box",
      }}
    >
      <h1 style={{ fontSize: 20, margin: 0 }}>Macro Station</h1>
      <p style={{ color: "#9aa0a8", fontSize: 13, textAlign: "center", margin: 0 }}>
        Bilgisayarındaki Macro Station sunucusunun IP adresini gir (aynı Wi-Fi'da olmalısınız).
      </p>
      <input
        value={host}
        onChange={(e) => onHostChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onConnect()}
        placeholder="192.168.1.20:9820"
        style={{
          width: "100%", maxWidth: 320, padding: "10px 12px", fontSize: 16, borderRadius: 8,
          border: "1px solid #2d3136", background: "#16181c", color: "#e6e7ea",
        }}
      />
      <button
        onClick={onConnect}
        style={{
          padding: "10px 24px", fontSize: 15, borderRadius: 8, border: "none",
          background: "#3b82f6", color: "white", cursor: "pointer",
        }}
      >
        Bağlan
      </button>
      {status === "connecting" && <span style={{ color: "#9aa0a8", fontSize: 12 }}>Bağlanıyor…</span>}
      {status === "disconnected" && host && <span style={{ color: "#ef4444", fontSize: 12 }}>Bağlantı koptu, yeniden deneniyor…</span>}
    </div>
  );
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  return (
    <div
      style={{
        position: "fixed", top: 10, right: 10, zIndex: 100, fontSize: 11, padding: "4px 10px",
        borderRadius: 999, background: "rgba(0,0,0,.6)", color: status === "connecting" ? "#facc15" : "#ef4444",
      }}
    >
      {status === "connecting" ? "Bağlanıyor…" : "Çevrimdışı"}
    </div>
  );
}
