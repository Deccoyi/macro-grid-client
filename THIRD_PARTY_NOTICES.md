# Üçüncü Taraf Lisansları

Bu proje aşağıdaki açık kaynak bileşenleri kullanıyor. Her biri kendi lisansıyla dağıtılır; bu dosya sadece bir özet/envanterdir, lisans metinlerinin yerine geçmez.

| Paket | Lisans |
|---|---|
| React, ReactDOM | MIT |
| Vite, `@vitejs/plugin-react` | MIT |
| TypeScript | Apache-2.0 |
| Capacitor (`@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/cli`) | MIT |
| `@capacitor-community/keep-awake` | MIT |
| `postcss`, `postcss-safe-parser` (`packages/renderer` CSS sanitizer) | MIT |
| `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` | MIT |

Tam bağımlılık ağacı ve alt-bağımlılıkların lisansları için `npm ls` / `npm-license-checker` gibi bir araçla kendi ortamınızda ayrıca doğrulama yapmanız önerilir; bu liste yalnızca doğrudan (birinci seviye) bağımlılıkları kapsar.

## Katkıda bulunanlar için not

Yeni bir bağımlılık eklerken lisansını kontrol edin ve bu dosyaya ekleyin. Copyleft (GPL/AGPL gibi) lisanslı bir bağımlılık eklemeden önce projenin MIT lisansıyla uyumluluğunu değerlendirin.
