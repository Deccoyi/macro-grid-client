# Changelog

Bu dosya [Keep a Changelog](https://keepachangelog.com/) formatını takip eder. Sürümleme kuralları için [versioning.md](versioning.md)'ye bakın.

Bu repo, Macro Station'ın **client** (telefon/tablet) tarafıdır ve server'dan (`https://github.com/Deccoyi/macro-station`) bağımsız sürümlenir.

## [Unreleased]
### Added
- **PIN ile eşleştirme:** ilk bağlantıda sunucu editöründe gösterilen 6 haneli PIN isteniyor; eşleşince sunucudan gelen kalıcı token host'a özel olarak `localStorage`'a kaydediliyor, bir daha PIN sorulmuyor. `ConnectScreen` artık `pairing_required` durumunda PIN girişi gösteriyor. Gerçek sunucuya karşı uçtan uca doğrulandı.
- Aşama 5 başladı: Capacitor + React + TS uygulaması (Capacitor 8.5.2). IP girip bağlanma ekranı, `@macro/renderer` ile aynı grid'i çizen ana ekran, WebSocket reconnect (exponential backoff). `android/` platformu eklendi, ilk `assembleDebug` build'i başarılı.
- `packages/renderer`: paylaşılan grid/widget render motoru — `Grid`, `WidgetView`, `ShadowHost`, `sanitizeWidgetCss`, `usePressGesture` (press/longPress/doubleTap/haptic).
- Profil çekmecesi: sol kenardan swipe (veya her zaman görünen ince kenar tutamacı) ile açılıyor, sunucudan gelen `profiles.list` mesajıyla tüm profilleri listeliyor, seçince `profile.change` gönderip anında yeni profile geçiyor. Uçtan uca gerçek sunucuya karşı doğrulandı.
- Ekran uyanık kalma (`@capacitor-community/keep-awake`): bir profil yüklendiği sürece cihaz uyumuyor.

### Fixed
- Bağlantı durumu React 18 StrictMode'da yanlışlıkla "bağlantı koptu" gösterebiliyordu: geliştirme modunda efekt bilerek iki kez çalıştığı için, eski (iptal edilmiş) `ServerConnection`'ın gecikmeli `onclose`'u yeni bağlantı zaten açılmışken duruma "disconnected" yazabiliyordu. `disconnect()` artık bağlantıyı kalıcı olarak "destroyed" işaretliyor, o andan sonraki hiçbir olay callback'i tetiklemiyor.
- PIN girip eşleştikten sonra durum "pairing_required"da takılı kalıyordu (veri akmasına rağmen "Çevrimdışı" gösteriyordu) — `welcome` mesajı artık her zaman durumu "connected"a çekiyor.
- `ButtonContent`'te ikon üstte/altta iken kapsayıcının `flex-direction`'ı değiştiriliyordu, bu da hizalama için ayarlanan `justify-content`/`align-items`'ın eksenlerini karıştırıyordu. İkon+metin artık kendi iç kutusunda (`.ms-content-inner`) — server repo'suyla senkron (bkz. o reponun CHANGELOG'u).
