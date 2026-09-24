import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BarcodeFormat, BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";

export interface ScannedPairing {
  host: string;
  pin?: string;
}

/**
 * Accepts whatever format the editor ends up encoding the pairing QR in — a `macrostation://pair`
 * URI, or a plain `ip:port:pin` / `ip:port` string — so client and server can settle on the final
 * format independently without a synchronized release. Returns null for anything unrecognized.
 */
function parsePairingQr(raw: string): ScannedPairing | null {
  const trimmed = raw.trim();

  if (/^macrostation:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const ip = url.searchParams.get("host");
      if (!ip) return null;
      // The editor encodes host and port as separate query params (confirmed from a real scanned
      // code: macrostation://pair?host=192.168.1.20&port=9820&pin=...) rather than "ip:port" in a
      // single host param — ServerConnection needs them combined into one "ip:port" string.
      const port = url.searchParams.get("port");
      const host = port ? `${ip}:${port}` : ip;
      return { host, pin: url.searchParams.get("pin") ?? undefined };
    } catch {
      return null;
    }
  }

  const parts = trimmed.split(":");
  if (parts.length === 3 && /^\d+$/.test(parts[1]!) && /^\d+$/.test(parts[2]!)) {
    return { host: `${parts[0]}:${parts[1]}`, pin: parts[2] };
  }
  if (parts.length === 2 && /^\d+$/.test(parts[1]!)) {
    return { host: `${parts[0]}:${parts[1]}` };
  }
  return null;
}

/**
 * Full-screen QR scanner for pairing: scans once, shows a confirm step with the parsed host (so a
 * stray/wrong QR doesn't silently connect), then hands the result back. Caller is responsible for
 * actually connecting and, if a PIN came with the code, submitting it.
 */
export function QrScanScreen({ onCancel, onScanned }: { onCancel: () => void; onScanned: (result: ScannedPairing) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ScannedPairing | null>(null);
  const scanStartedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let listenerHandle: { remove: () => void } | null = null;

    async function start() {
      try {
        const { supported } = await BarcodeScanner.isSupported();
        if (!supported) {
          setError("Bu cihaz QR taramayı desteklemiyor.");
          return;
        }

        let perm = await BarcodeScanner.checkPermissions();
        if (perm.camera !== "granted" && perm.camera !== "limited") {
          perm = await BarcodeScanner.requestPermissions();
        }
        if (perm.camera !== "granted" && perm.camera !== "limited") {
          setError("Kamera izni verilmedi. Ayarlardan izin verip tekrar dene.");
          return;
        }
        if (cancelled) return;

        listenerHandle = await BarcodeScanner.addListener("barcodesScanned", (event) => {
          const raw = event.barcodes[0]?.rawValue;
          if (!raw) return;
          const parsed = parsePairingQr(raw);
          if (!parsed) {
            setError("Bu QR kod bir Macro Station eşleştirme kodu değil.");
            return;
          }
          setPending(parsed);
        });

        document.body.classList.add("barcode-scanner-active");
        document.documentElement.classList.add("barcode-scanner-active");
        scanStartedRef.current = true;
        await BarcodeScanner.startScan({ formats: [BarcodeFormat.QrCode] });
      } catch {
        if (!cancelled) setError("Kamera başlatılamadı.");
      }
    }

    start();

    return () => {
      cancelled = true;
      document.body.classList.remove("barcode-scanner-active");
      document.documentElement.classList.remove("barcode-scanner-active");
      listenerHandle?.remove();
      if (scanStartedRef.current) {
        scanStartedRef.current = false;
        BarcodeScanner.stopScan().catch(() => {});
      }
    };
  }, []);

  // Stop the camera as soon as we have a candidate code — the confirm step itself doesn't need it,
  // and leaving it running would keep firing the listener for the same still-visible QR code.
  useEffect(() => {
    if (!pending) return;
    document.body.classList.remove("barcode-scanner-active");
    document.documentElement.classList.remove("barcode-scanner-active");
    if (scanStartedRef.current) {
      scanStartedRef.current = false;
      BarcodeScanner.stopScan().catch(() => {});
    }
  }, [pending]);

  return (
    <div className="barcode-scanner-modal" style={overlayStyle}>
      {!pending && !error && (
        <>
          <div style={frameStyle} />
          <p style={hintTextStyle}>Sunucudaki QR kodunu kareye hizala</p>
          <button onClick={onCancel} style={secondaryButtonStyle}>
            Vazgeç
          </button>
        </>
      )}

      {error && (
        <div style={cardStyle}>
          <p style={{ color: "#ef4444", fontSize: 14, margin: "0 0 16px" }}>{error}</p>
          <button onClick={onCancel} style={secondaryButtonStyle}>
            Geri
          </button>
        </div>
      )}

      {pending && (
        <div style={cardStyle}>
          <p style={{ color: "#e6e7ea", fontSize: 14, margin: "0 0 16px", lineHeight: 1.5 }}>
            Bu sunucuya bağlanılsın mı?
            <br />
            <strong style={{ fontFamily: "ui-monospace, monospace", fontSize: 15 }}>{pending.host}</strong>
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={onCancel} style={secondaryButtonStyle}>
              İptal
            </button>
            <button onClick={() => onScanned(pending)} style={primaryButtonStyle}>
              Bağlan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 200,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  padding: "max(24px, env(safe-area-inset-top, 0px)) 24px max(24px, env(safe-area-inset-bottom, 0px)) 24px",
  boxSizing: "border-box",
  background: "transparent",
};

const frameStyle: CSSProperties = {
  width: "70vw",
  maxWidth: 280,
  aspectRatio: "1",
  border: "3px solid #3b82f6",
  borderRadius: 16,
  boxShadow: "0 0 0 2000px rgba(0,0,0,.35)",
};

const hintTextStyle: CSSProperties = {
  color: "#fff",
  fontSize: 14,
  textAlign: "center",
  textShadow: "0 1px 3px rgba(0,0,0,.6)",
};

const cardStyle: CSSProperties = {
  background: "#16181c",
  border: "1px solid #2d3136",
  borderRadius: 12,
  padding: 20,
  maxWidth: 320,
  width: "100%",
  textAlign: "center",
  boxSizing: "border-box",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "10px 20px",
  fontSize: 14,
  borderRadius: 8,
  border: "1px solid #2d3136",
  background: "rgba(22,24,28,.85)",
  color: "#e6e7ea",
  cursor: "pointer",
};

const primaryButtonStyle: CSSProperties = {
  padding: "10px 20px",
  fontSize: 14,
  borderRadius: 8,
  border: "none",
  background: "#3b82f6",
  color: "white",
  cursor: "pointer",
};
