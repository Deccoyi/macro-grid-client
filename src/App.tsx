import { useCallback, useEffect, useRef, useState } from "react";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { Grid, WidgetView, type Profile, type WidgetState } from "@macro/renderer";
import { getDeviceId } from "./deviceId";
import { ConnectionStatus, ProfileSummary, ServerConnection } from "./ws/connection";

const HOST_KEY = "macro-station.host";
const EDGE_SWIPE_ZONE_PX = 24;
const SWIPE_OPEN_THRESHOLD_PX = 60;

/** One pairing token per server host, so switching between two Macro Station servers doesn't require re-pairing every time you go back to one you've already paired with. */
const tokenKey = (host: string) => `macro-station.token.${host}`;
/** Last-known layout per host, so a cold start (app relaunch, not just a live reconnect) shows the
 * deck immediately instead of the connect screen while the first real layout.full is still in flight. */
const layoutCacheKey = (host: string) => `macro-station.layoutCache.${host}`;

interface LayoutCache {
  profile: Profile;
  pageId: string;
}

function loadLayoutCache(host: string): LayoutCache | null {
  if (!host) return null;
  try {
    const raw = localStorage.getItem(layoutCacheKey(host));
    return raw ? (JSON.parse(raw) as LayoutCache) : null;
  } catch {
    return null;
  }
}

export function App() {
  const [host, setHost] = useState(() => localStorage.getItem(HOST_KEY) ?? "");
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [usingCache, setUsingCache] = useState(() => loadLayoutCache(host) !== null);
  const [profile, setProfile] = useState<Profile | null>(() => loadLayoutCache(host)?.profile ?? null);
  const [pageId, setPageId] = useState<string | null>(() => loadLayoutCache(host)?.pageId ?? null);
  const [states, setStates] = useState<Record<string, WidgetState>>({});
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const connectionRef = useRef<ServerConnection | null>(null);

  const connect = useCallback((targetHost: string) => {
    connectionRef.current?.disconnect();
    localStorage.setItem(HOST_KEY, targetHost);
    setStates({});
    setProfiles([]);
    const cached = loadLayoutCache(targetHost);
    setProfile(cached?.profile ?? null);
    setPageId(cached?.pageId ?? null);
    setUsingCache(cached !== null);

    const connection = new ServerConnection(targetHost, getDeviceId(), "Telefon", localStorage.getItem(tokenKey(targetHost)), {
      onStatusChange: setStatus,
      onLayout: (nextProfile, nextPageId) => {
        setProfile(nextProfile);
        setPageId(nextPageId);
        setStates({});
        setUsingCache(false);
        try {
          localStorage.setItem(layoutCacheKey(targetHost), JSON.stringify({ profile: nextProfile, pageId: nextPageId } satisfies LayoutCache));
        } catch {
          // Storage full or unavailable (private mode) — the cache is a nice-to-have, not essential.
        }
      },
      onWidgetState: (state) => {
        setStates((prev) => ({ ...prev, [state.widgetId]: { ...prev[state.widgetId], ...state } }));
      },
      onProfiles: setProfiles,
      onPaired: (token) => localStorage.setItem(tokenKey(targetHost), token),
    });
    connectionRef.current = connection;
    connection.connect();
  }, []);

  // Reconnect automatically to the last known server on launch, like the plan's "reconnect + cache"
  // requirement. The very first render already shows any cached layout (see the useState initializers
  // above) so a cold start looks like the deck immediately, not the connect screen.
  useEffect(() => {
    if (host) connect(host);
    return () => connectionRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The phone is meant to sit as a always-on deck while in use — keep the screen from sleeping
  // whenever we're actually showing one (connected or not, as long as a profile has loaded once).
  // Fails silently on platforms/browsers without the plugin (Capacitor's web shim no-ops).
  useEffect(() => {
    if (!profile) return;
    KeepAwake.keepAwake().catch(() => {});
    return () => {
      KeepAwake.allowSleep().catch(() => {});
    };
  }, [profile]);

  const page = profile?.pages.find((p) => p.id === pageId) ?? profile?.pages[0];

  // Pairing always wins over a cached layout — a stale grid with no indication a PIN is needed would
  // just look broken ("Çevrimdışı" forever) instead of telling the user what to do about it.
  if (!profile || !page || status === "pairing_required") {
    return (
      <ConnectScreen
        host={host}
        status={status}
        onHostChange={setHost}
        onConnect={() => host.trim() && connect(host.trim())}
        onSubmitPin={(pin) => connectionRef.current?.retryWithPin(pin)}
      />
    );
  }

  return (
    <DeckScreen
      page={page}
      status={status}
      usingCache={usingCache}
      states={states}
      profiles={profiles}
      currentProfileId={profile.id}
      drawerOpen={drawerOpen}
      onDrawerOpenChange={setDrawerOpen}
      onPickProfile={(id) => {
        connectionRef.current?.changeProfile(id);
        setDrawerOpen(false);
      }}
      onWidgetEvent={(type, widgetId) => connectionRef.current?.send(type, { pageId: page.id, widgetId })}
    />
  );
}

function DeckScreen({
  page,
  status,
  usingCache,
  states,
  profiles,
  currentProfileId,
  drawerOpen,
  onDrawerOpenChange,
  onPickProfile,
  onWidgetEvent,
}: {
  page: Profile["pages"][number];
  status: ConnectionStatus;
  usingCache: boolean;
  states: Record<string, WidgetState>;
  profiles: ProfileSummary[];
  currentProfileId: string;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  onPickProfile: (id: string) => void;
  onWidgetEvent: (type: "widget.down" | "widget.up" | "widget.longPress" | "widget.doubleTap", widgetId: string) => void;
}) {
  const touchStart = useRef<{ x: number; y: number; fromEdge: boolean } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]!;
    touchStart.current = { x: t.clientX, y: t.clientY, fromEdge: t.clientX <= EDGE_SWIPE_ZONE_PX };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0]!;
    const dx = t.clientX - start.x;
    const dy = Math.abs(t.clientY - start.y);
    if (dy > 40) return;
    if (start.fromEdge && dx > SWIPE_OPEN_THRESHOLD_PX) onDrawerOpenChange(true);
    else if (drawerOpen && dx < -SWIPE_OPEN_THRESHOLD_PX) onDrawerOpenChange(false);
  };

  return (
    <div
      style={{ width: "100vw", height: "100vh", background: "#0b0d10", padding: 10, boxSizing: "border-box", position: "relative", overflow: "hidden" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {status !== "connected" && <StatusBadge status={status} usingCache={usingCache} />}

      {/* Always-visible edge handle: a swipe works too, but a hidden-only gesture is easy to miss. */}
      {!drawerOpen && profiles.length > 1 && (
        <button
          aria-label="Profilleri göster"
          onClick={() => onDrawerOpenChange(true)}
          style={{
            position: "fixed", left: 0, top: "50%", transform: "translateY(-50%)", zIndex: 90,
            width: 14, height: 56, borderRadius: "0 8px 8px 0", border: "none",
            background: "rgba(255,255,255,.12)", cursor: "pointer", padding: 0,
          }}
        />
      )}

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
              onPress={() => onWidgetEvent("widget.down", widget.id)}
              onRelease={() => onWidgetEvent("widget.up", widget.id)}
              onLongPress={() => onWidgetEvent("widget.longPress", widget.id)}
              onDoubleTap={() => onWidgetEvent("widget.doubleTap", widget.id)}
            />
          );
        }}
      />

      <ProfileDrawer
        open={drawerOpen}
        profiles={profiles}
        currentProfileId={currentProfileId}
        onClose={() => onDrawerOpenChange(false)}
        onPick={onPickProfile}
      />
    </div>
  );
}

function ProfileDrawer({
  open,
  profiles,
  currentProfileId,
  onClose,
  onPick,
}: {
  open: boolean;
  profiles: ProfileSummary[];
  currentProfileId: string;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100,
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .2s ease",
        }}
      />
      <div
        style={{
          position: "fixed", top: 0, bottom: 0, left: 0, width: "78%", maxWidth: 300, zIndex: 101,
          background: "#16181c", borderRight: "1px solid #2d3136", boxSizing: "border-box", padding: 16,
          transform: open ? "translateX(0)" : "translateX(-100%)", transition: "transform .2s ease",
          display: "flex", flexDirection: "column", gap: 4,
        }}
      >
        <div style={{ color: "#9aa0a8", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", padding: "4px 10px 12px" }}>Profiller</div>
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            style={{
              display: "block", width: "100%", textAlign: "left", padding: "12px 10px", borderRadius: 8,
              border: "none", cursor: "pointer", fontSize: 15,
              background: p.id === currentProfileId ? "rgba(59,130,246,.18)" : "transparent",
              color: p.id === currentProfileId ? "#60a5fa" : "#e6e7ea",
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
    </>
  );
}

function ConnectScreen({
  host,
  status,
  onHostChange,
  onConnect,
  onSubmitPin,
}: {
  host: string;
  status: ConnectionStatus;
  onHostChange: (v: string) => void;
  onConnect: () => void;
  onSubmitPin: (pin: string) => void;
}) {
  const [pin, setPin] = useState("");
  const pairing = status === "pairing_required";

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 14, alignItems: "center", justifyContent: "center",
        width: "100vw", height: "100vh", background: "#0b0d10", color: "#e6e7ea", fontFamily: "system-ui, sans-serif",
        padding: 24, boxSizing: "border-box",
      }}
    >
      <h1 style={{ fontSize: 20, margin: 0 }}>Macro Station</h1>

      {!pairing && (
        <>
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
        </>
      )}

      {pairing && (
        <>
          <p style={{ color: "#9aa0a8", fontSize: 13, textAlign: "center", margin: 0, maxWidth: 320 }}>
            Bu cihaz henüz eşleşmemiş. Bilgisayarındaki Macro Station düzenleyicisinde "Eşleştirme"ye tıkla ve orada
            gösterilen 6 haneli PIN'i buraya gir.
          </p>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && pin.length === 6 && onSubmitPin(pin)}
            placeholder="000000"
            inputMode="numeric"
            autoFocus
            style={{
              width: "100%", maxWidth: 200, padding: "10px 12px", fontSize: 28, borderRadius: 8, textAlign: "center",
              letterSpacing: ".2em", fontFamily: "ui-monospace, monospace",
              border: "1px solid #2d3136", background: "#16181c", color: "#e6e7ea",
            }}
          />
          <button
            onClick={() => onSubmitPin(pin)}
            disabled={pin.length !== 6}
            style={{
              padding: "10px 24px", fontSize: 15, borderRadius: 8, border: "none",
              background: pin.length === 6 ? "#3b82f6" : "#2d3136", color: "white",
              cursor: pin.length === 6 ? "pointer" : "default",
            }}
          >
            Eşleştir
          </button>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status, usingCache }: { status: ConnectionStatus; usingCache: boolean }) {
  const label = status === "connecting" ? "Bağlanıyor…" : usingCache ? "Çevrimdışı · önbellek" : "Çevrimdışı";
  return (
    <div
      style={{
        position: "fixed", top: 10, right: 10, zIndex: 100, fontSize: 11, padding: "4px 10px",
        borderRadius: 999, background: "rgba(0,0,0,.6)", color: status === "connecting" ? "#facc15" : "#ef4444",
      }}
    >
      {label}
    </div>
  );
}
