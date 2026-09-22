# Changelog

Bu dosya [Keep a Changelog](https://keepachangelog.com/) formatını takip eder. Sürümleme kuralları için [versioning.md](versioning.md)'ye bakın.

Bu repo, Macro Station'ın **client** (telefon/tablet) tarafıdır ve server'dan (`https://github.com/Deccoyi/macro-station`) bağımsız sürümlenir.

## [Unreleased]
### Added
- Aşama 5 başladı: Capacitor + React + TS uygulaması (Capacitor 8.5.2). IP girip bağlanma ekranı, `@macro/renderer` ile aynı grid'i çizen ana ekran, WebSocket reconnect (exponential backoff). `android/` platformu eklendi, ilk `assembleDebug` build'i başarılı.
- `packages/renderer`: paylaşılan grid/widget render motoru — `Grid`, `WidgetView`, `ShadowHost`, `sanitizeWidgetCss`, `usePressGesture` (press/longPress/doubleTap/haptic).
