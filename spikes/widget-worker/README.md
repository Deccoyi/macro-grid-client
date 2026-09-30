# Widget worker spike (phase 0)

Throwaway test page for the custom plugin widget design (a sandboxed launcher frame that starts Web Workers drawing to `OffscreenCanvas`).
It measures sandbox limits, performance, memory and touch on a real phone. It is not part of the app and is not built into it.

To run it on a phone:
1. Copy `spike.html` to `public/spike/`; in that folder also put `echarts.min.js` and `chart.umd.min.js` from the `echarts` and `chart.js` npm packages (`dist/`).
2. In `android/app/build.gradle` add `applicationIdSuffix ".spike"` to a `debug` build type so it installs next to the real app, then `assembleDebug`.
3. Open the app's WebView debug socket (`adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>`), navigate to `https://localhost/spike/spike.html`
   and call `spike.run("<test>", args)` (tests: `env`, `launcherProbe`, `appProbe`, `workerKinds`, `busy`, `draw`, `hold`/`release`, `lib`, `touch`, `heapBomb`, `memBomb`).
4. Remove `public/spike/` again before building anything real.
