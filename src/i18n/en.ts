import type { DictKey } from "./tr";

/** English dictionary — must define exactly the same keys as tr.ts (enforced by the DictKey type). */
export const en: Record<DictKey, string | ((...args: string[]) => string)> = {
  "device.name": "Phone",

  "drawer.profiles": "Profiles",
  "drawer.servers": "Servers",
  "drawer.addServer": "+ Add server",
  "drawer.show": "Show profiles",
  "drawer.lock": "Profile lock",
  "drawer.lock.on": "Automatic switching is locked — tap to unlock",
  "drawer.lock.off": "Automatic switching is on — tap to lock",
  "drawer.forget.confirm": (host: string) => `Remove ${host} from the list? (Its pairing is removed too)`,
  "drawer.forget.label": (host: string) => `Remove ${host}`,

  "connect.hint": "Enter the IP address of the Macro Grid server on your computer (you must be on the same Wi-Fi).",
  "connect.button": "Connect",
  "connect.scanQr": "Scan QR",
  "connect.savedServers": "Saved servers",
  "connect.cancel": "Cancel",
  "connect.connecting": "Connecting…",
  "connect.retrying": "Connection lost, retrying…",
  "connect.pairHint": "This device is not paired yet. Open \"Pairing\" in the Macro Grid editor on your computer and enter the 6-digit PIN shown there.",
  "connect.pair": "Pair",

  "badge.connecting": "Connecting…",
  "badge.offlineCached": "Offline · cached",
  "badge.offline": "Offline",

  "qr.unsupported": "This device does not support QR scanning.",
  "qr.permission": "Camera permission was not granted. Allow it in the settings and try again.",
  "qr.notPairingCode": "This QR code is not a Macro Grid pairing code.",
  "qr.cameraFailed": "The camera could not be started.",
  "qr.hint": "Align the QR code shown on the server with the frame",
  "qr.cancel": "Cancel",
  "qr.back": "Back",
  "qr.confirm": "Connect to this server?",
  "qr.confirm.no": "Cancel",
  "qr.confirm.yes": "Connect",

  "settings.title": "Settings",
  "settings.kiosk": "Kiosk mode",
  "settings.kiosk.hint": "Hides the status bar and the navigation bar and shows the deck full screen.",
  "settings.orientation": "Screen orientation",
  "settings.orientation.auto": "Auto",
  "settings.orientation.portrait": "Portrait",
  "settings.orientation.landscape": "Landscape",
  "settings.disclaimer": "Macro Grid is software produced with AI, in an alpha stage, and provided \"as is\" without any warranty. The authors accept no liability; all risk of use is yours.",
  "settings.close": "Close",
};
