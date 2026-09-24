/** Turkish dictionary — the key set here defines DictKey; en.ts must match it. */
export const tr = {
  "device.name": "Telefon",

  "drawer.profiles": "Profiller",
  "drawer.servers": "Sunucular",
  "drawer.addServer": "+ Sunucu ekle",
  "drawer.show": "Profilleri göster",
  "drawer.lock": "Profil kilidi",
  "drawer.lock.on": "Otomatik geçiş kilitli — açmak için dokun",
  "drawer.lock.off": "Otomatik geçiş açık — kilitlemek için dokun",
  "drawer.forget.confirm": (host: string) => `${host} sunucusu listeden silinsin mi? (Eşleşme bilgisi de silinir)`,
  "drawer.forget.label": (host: string) => `${host} sunucusunu sil`,

  "connect.hint": "Bilgisayarındaki Macro Grid sunucusunun IP adresini gir (aynı Wi-Fi'da olmalısınız).",
  "connect.button": "Bağlan",
  "connect.scanQr": "QR ile Tara",
  "connect.savedServers": "Kayıtlı sunucular",
  "connect.cancel": "Vazgeç",
  "connect.connecting": "Bağlanıyor…",
  "connect.retrying": "Bağlantı koptu, yeniden deneniyor…",
  "connect.pairHint": "Bu cihaz henüz eşleşmemiş. Bilgisayarındaki Macro Grid düzenleyicisinde \"Eşleştirme\"ye tıkla ve orada gösterilen 6 haneli PIN'i buraya gir.",
  "connect.pair": "Eşleştir",

  "badge.connecting": "Bağlanıyor…",
  "badge.offlineCached": "Çevrimdışı · önbellek",
  "badge.offline": "Çevrimdışı",

  "qr.unsupported": "Bu cihaz QR taramayı desteklemiyor.",
  "qr.permission": "Kamera izni verilmedi. Ayarlardan izin verip tekrar dene.",
  "qr.notPairingCode": "Bu QR kod bir Macro Grid eşleştirme kodu değil.",
  "qr.cameraFailed": "Kamera başlatılamadı.",
  "qr.hint": "Sunucudaki QR kodunu kareye hizala",
  "qr.cancel": "Vazgeç",
  "qr.back": "Geri",
  "qr.confirm": "Bu sunucuya bağlanılsın mı?",
  "qr.confirm.no": "İptal",
  "qr.confirm.yes": "Bağlan",

  "settings.title": "Ayarlar",
  "settings.kiosk": "Kiosk modu",
  "settings.kiosk.hint": "Durum çubuğunu ve gezinme çubuğunu gizler, tam ekran gösterir.",
  "settings.orientation": "Ekran yönü",
  "settings.orientation.auto": "Otomatik",
  "settings.orientation.portrait": "Dikey",
  "settings.orientation.landscape": "Yatay",
  "settings.disclaimer": "Macro Grid yapay zekâ ile üretilmiş, alfa aşamasında bir yazılımdır ve \"olduğu gibi\", hiçbir garanti verilmeden sunulur. Yazarlar hiçbir sorumluluk kabul etmez; kullanımın tüm riski size aittir.",
  "settings.close": "Kapat",
} satisfies Record<string, string | ((...args: string[]) => string)>;

export type DictKey = keyof typeof tr;
