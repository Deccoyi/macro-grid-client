# Development

How to build, run and test the phone app, and the pitfalls that are easy to hit. For how it works see [architecture.md](architecture.md); for the rules for contributions see
[../CONTRIBUTING.md](../CONTRIBUTING.md).

## Requirements

- [Node.js](https://nodejs.org/) 20 or newer.
- For Android: Android Studio (or the Android SDK command line tools) and a JDK, with the `JAVA_HOME` and `ANDROID_HOME` environment variables set. The Android project
  targets API 36 (`android/variables.gradle`); install that platform in the SDK Manager if Gradle asks for it.
- A running Macro Station server to connect to (see the server repository).

## Run in a browser

```powershell
npm install
npm run dev
```

This serves the app on port 5191. It is the fastest way to work on the UI: you enter the server's address in the app. The native features (kiosk mode, orientation lock, QR scanner,
gesture exclusion, keep-awake) do nothing in a browser.

## Build and run on Android

```powershell
npm run build          # the web bundle into dist/
npx cap sync android   # copy it into the Android project
npx cap open android   # or build from the command line, below
```

To install a debug build on a phone with USB debugging turned on:

```powershell
cd android
.\gradlew.bat assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
adb shell am start -n com.macrostation.client/.MainActivity
```

`adb` is in the SDK's `platform-tools` folder and is usually not on the `PATH`. In Git Bash, paths that look like Unix paths on the device (`/sdcard/...`) are rewritten by MSYS; set
`MSYS_NO_PATHCONV=1` for `adb shell` and `adb pull`.

The phone and the PC must be on the same network, and the network profile on the PC should be "private" so Windows lets the connection through the firewall.

For a release build and signing, see [release.md](release.md).

## Tests and checks

```powershell
npm run typecheck                            # the app
npm test --workspace packages/renderer       # the renderer tests (Vitest)
```

## Layout of the repository

`src/` is the app and `packages/renderer/` the renderer, both in one npm workspace so there is a single hoisted copy of React. `packages/renderer/demo` is a small page that shows every widget type
(`npm run dev` inside it, port 5183).

## Pitfalls

- **Two copies of React.** `@macro/renderer` is linked with `file:`. A copy of React inside the package makes a click update state twice. Keep the npm workspace setup, keep `node_modules` out of
  `packages/renderer`, and keep `resolve.dedupe: ["react", "react-dom"]` in `vite.config.ts`.
- **Events on a Shadow DOM portal fire twice.** The renderer draws widget content into a shadow root through `createPortal`; pointer handlers passed as JSX props were called twice per native event.
  `ShadowHost` attaches them with `addEventListener` in `useLayoutEffect`. Do the same for any new event handler on content inside the shadow root.
- **`setPointerCapture` can throw** for a stale pointer id and silently kill a handler; it is wrapped in try/catch in `usePressGesture`. Do the same for similar calls.
- **React StrictMode runs effects twice in development.** A late event from a connection that was already closed must not touch the new connection's state; `ServerConnection` has a `destroyed`
  flag for this. Keep it in mind for anything long-lived created in an effect.
- **`sdk.dir` in `android/local.properties`** must use forward slashes (`C:/Users/you/AppData/Local/Android/Sdk`). A backslash is an escape character in that file format and silently corrupts the path.
- **`cap sync` rewrites `android/capacitor.settings.gradle` and `android/app/capacitor.build.gradle`.** Their line endings can change on Windows without any real change; do not commit that noise.
- **The renderer is an independent copy** of the one in the server repository. A rendering change that both need is made in both.
- **UI text** is currently hard-coded in Turkish in the components (there is no i18n layer in the app yet).
