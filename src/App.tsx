import { useCallback, useEffect, useRef, useState } from "react";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { Grid, WidgetView, type Profile, type WidgetState } from "@macro/renderer";
import { getDeviceId } from "./deviceId";
import { clearGestureExclusionZone, setGestureExclusionZone } from "./gestureExclusion";
import { QrScanScreen, type ScannedPairing } from "./QrScan";
import { ConnectionStatus, ProfileSummary, ServerConnection } from "./ws/connection";

const HOST_KEY = "macro-station.host";
const EDGE_SWIPE_ZONE_PX = 24;
const SWIPE_OPEN_THRESHOLD_PX = 60;
const HANDLE_Y_KEY = "macro-station.drawerHandleY";
const HANDLE_WIDTH_PX = 18;
const HANDLE_HEIGHT_PX = 64;
const HANDLE_DRAG_THRESHOLD_PX = 10;

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
  const [scanning, setScanning] = useState(false);
  const connectionRef = useRef<ServerConnection | null>(null);
  /** A PIN that came from a scanned QR code, submitted automatically the moment the server actually
   * asks for one — so scanning fully replaces typing both the host and the PIN by hand. */
  const pendingQrPinRef = useRef<string | null>(null);

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
      onPageChange: (nextPageId) => {
        setPageId(nextPageId);
        setProfile((prev) => {
          if (!prev) return prev;
          try {
            localStorage.setItem(layoutCacheKey(targetHost), JSON.stringify({ profile: prev, pageId: nextPageId } satisfies LayoutCache));
          } catch {
            // Cache is a nice-to-have; ignore storage errors.
          }
          return prev;
        });
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

  // A scanned QR's PIN is only usable once the server actually says it needs one — submitting it any
  // earlier (e.g. against an old accepted token) would be a spurious re-pair attempt.
  useEffect(() => {
    if (status === "pairing_required" && pendingQrPinRef.current) {
      connectionRef.current?.retryWithPin(pendingQrPinRef.current);
      pendingQrPinRef.current = null;
    }
  }, [status]);

  const handleScanned = useCallback(
    (result: ScannedPairing) => {
      setScanning(false);
      pendingQrPinRef.current = result.pin ?? null;
      setHost(result.host);
      connect(result.host);
    },
    [connect],
  );

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

  // Every hook above must run on every render — this is the first point an early return is safe.
  if (scanning) {
    return <QrScanScreen onCancel={() => setScanning(false)} onScanned={handleScanned} />;
  }

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
        onScanQr={() => setScanning(true)}
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
  // The drawer now lives on the right (see ProfileDrawer/DrawerHandle below — left conflicted with
  // Android gesture-nav's own left-edge back swipe), so the open swipe starts near the right edge and
  // moves left (negative dx); closing swipes right, same as before but mirrored.
  const touchStart = useRef<{ x: number; y: number; fromEdge: boolean } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]!;
    touchStart.current = { x: t.clientX, y: t.clientY, fromEdge: t.clientX >= window.innerWidth - EDGE_SWIPE_ZONE_PX };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0]!;
    const dx = t.clientX - start.x;
    const dy = Math.abs(t.clientY - start.y);
    if (dy > 40) return;
    if (start.fromEdge && dx < -SWIPE_OPEN_THRESHOLD_PX) onDrawerOpenChange(true);
    else if (drawerOpen && dx > SWIPE_OPEN_THRESHOLD_PX) onDrawerOpenChange(false);
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#0b0d10",
        // Edge-to-edge Android draws the WebView behind the status/nav bars — pad the grid itself
        // (not just the badge) so no widget ever sits under the clock/battery bar or the gesture bar.
        // Only the *actual* safe-area inset, though (no artificial minimum): the editor's own preview
        // doesn't add extra margin beyond a page's own `padding`, so forcing e.g. 10px here on sides
        // that have no real inset (left/right in portrait, often bottom too) made the phone look
        // padded compared to the WYSIWYG preview even when the page's own padding was 0.
        padding: "env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {status !== "connected" && <StatusBadge status={status} usingCache={usingCache} />}

      {/* Always-visible edge handle: a swipe works too, but a hidden-only gesture is easy to miss. */}
      {!drawerOpen && profiles.length > 1 && <DrawerHandle onOpen={() => onDrawerOpenChange(true)} />}

      <Grid
        page={page}
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
      {/* On the right, not the left — the left edge is Android gesture-nav's own back-swipe zone. */}
      <div
        style={{
          position: "fixed", top: 0, bottom: 0, right: 0, width: "78%", maxWidth: 300, zIndex: 101,
          background: "#16181c", borderLeft: "1px solid #2d3136", boxSizing: "border-box",
          padding: "max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px)) 16px",
          transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform .2s ease",
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

function loadHandleFraction(): number {
  try {
    const raw = localStorage.getItem(HANDLE_Y_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? Math.min(0.92, Math.max(0.08, n)) : 0.5;
  } catch {
    return 0.5;
  }
}

/**
 * The always-visible drawer handle: on the right edge (not left — that's Android gesture-nav's own
 * back-swipe zone), a plain tap opens the drawer, and press-and-drag vertically moves the handle itself
 * (Samsung Edge-panel style), remembered per device in localStorage. Also tells Android to exclude this
 * exact screen rect from its own edge-swipe-back gesture (see gestureExclusion.ts) so the two don't
 * fight over the same touch — without that, a touch landing in the OS's back-gesture strip here can be
 * intercepted before this component ever sees it, on Android 10+ at least.
 */
function DrawerHandle({ onOpen }: { onOpen: () => void }) {
  const [topFraction, setTopFraction] = useState(loadHandleFraction);
  const drag = useRef<{ startY: number; startFraction: number; dragging: boolean } | null>(null);

  useEffect(() => {
    const publishZone = () => {
      setGestureExclusionZone({
        top: topFraction * window.innerHeight - HANDLE_HEIGHT_PX / 2,
        height: HANDLE_HEIGHT_PX,
        width: HANDLE_WIDTH_PX,
        rightEdge: true,
      });
    };
    publishZone();
    window.addEventListener("resize", publishZone);
    return () => {
      window.removeEventListener("resize", publishZone);
      clearGestureExclusionZone();
    };
  }, [topFraction]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]!;
    drag.current = { startY: t.clientY, startFraction: topFraction, dragging: false };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current;
    if (!d) return;
    const t = e.touches[0]!;
    const dy = t.clientY - d.startY;
    if (!d.dragging && Math.abs(dy) < HANDLE_DRAG_THRESHOLD_PX) return;
    d.dragging = true;
    setTopFraction(Math.min(0.92, Math.max(0.08, d.startFraction + dy / window.innerHeight)));
  };
  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.dragging) {
      try {
        localStorage.setItem(HANDLE_Y_KEY, String(topFraction));
      } catch {
        // Best-effort; the handle just resets to center next launch.
      }
    } else {
      onOpen();
    }
  };

  return (
    <button
      aria-label="Profilleri göster"
      onClick={onOpen}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        position: "fixed", right: 0, top: `${topFraction * 100}%`, transform: "translateY(-50%)", zIndex: 90,
        width: HANDLE_WIDTH_PX, height: HANDLE_HEIGHT_PX, borderRadius: "8px 0 0 8px", border: "none",
        background: "rgba(255,255,255,.14)", cursor: "pointer", padding: 0, touchAction: "none",
      }}
    />
  );
}

function ConnectScreen({
  host,
  status,
  onHostChange,
  onConnect,
  onSubmitPin,
  onScanQr,
}: {
  host: string;
  status: ConnectionStatus;
  onHostChange: (v: string) => void;
  onConnect: () => void;
  onSubmitPin: (pin: string) => void;
  onScanQr: () => void;
}) {
  const [pin, setPin] = useState("");
  const pairing = status === "pairing_required";

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 14, alignItems: "center", justifyContent: "center",
        width: "100vw", height: "100vh", background: "#0b0d10", color: "#e6e7ea", fontFamily: "system-ui, sans-serif",
        padding: "max(24px, env(safe-area-inset-top, 0px)) max(24px, env(safe-area-inset-right, 0px)) max(24px, env(safe-area-inset-bottom, 0px)) max(24px, env(safe-area-inset-left, 0px))",
        boxSizing: "border-box",
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
          <button
            onClick={onScanQr}
            style={{
              padding: "10px 24px", fontSize: 15, borderRadius: 8, border: "1px solid #2d3136",
              background: "transparent", color: "#e6e7ea", cursor: "pointer",
            }}
          >
            QR ile Tara
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
        position: "fixed",
        top: "max(10px, env(safe-area-inset-top, 0px))",
        right: "max(10px, env(safe-area-inset-right, 0px))",
        zIndex: 100,
        fontSize: 11,
        padding: "4px 10px",
        borderRadius: 999, background: "rgba(0,0,0,.6)", color: status === "connecting" ? "#facc15" : "#ef4444",
      }}
    >
      {label}
    </div>
  );
}
