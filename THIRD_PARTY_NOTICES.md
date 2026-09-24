# Third-party notices

The Macro Station client uses the open-source components below. Each is distributed under its own license; this file is a summary of the direct dependencies, not a replacement for the
license texts. The full dependency tree can be listed with `npm ls`.

| Package | License | Used for |
|---|---|---|
| `react`, `react-dom` | MIT | The user interface |
| `@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/cli` | MIT | The Android app shell |
| `@capacitor/screen-orientation` | MIT | The orientation lock |
| `@capacitor-community/keep-awake` | MIT | Keeping the screen on |
| `@capacitor-mlkit/barcode-scanning` | Apache-2.0 | The QR scanner. It uses Google's ML Kit barcode scanning, which is provided under Google's own terms. |
| `postcss`, `postcss-safe-parser` | MIT | The custom CSS sanitizer in `packages/renderer` |
| `vite`, `@vitejs/plugin-react` | MIT | Build tooling |
| `typescript` | Apache-2.0 | Build tooling |
| `vitest`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `jsdom` | MIT | Renderer tests only |

## For contributors

When you add a dependency, check its license and add it here. Do not add a dependency under a copyleft license (GPL, AGPL and similar) without first checking that it is compatible with this
repository's MIT license.
