# Architecture

How the phone app works. The server side (protocol, actions, data model) is described in the
[macro-grid](https://github.com/Deccoyi/macro-grid) repository's `docs/architecture.md`.

## Overview

The app is a single-page React application (`src/`) packaged as an Android app by Capacitor. It has three screens: the connect screen, the QR scanner and the deck.

```
src/App.tsx         state and screens: ConnectScreen, DeckScreen, ProfileDrawer, DrawerHandle, toasts
src/ws/             the server connection, the asset cache and layout patching
src/QrScan.tsx      the QR scanner screen
src/SettingsPanel.tsx, settings.ts   kiosk mode and orientation lock
src/servers.ts      the saved servers
src/deviceId.ts     a stable device id
src/kiosk.ts, gestureExclusion.ts    the bridges to the two native Android plugins
packages/renderer/  the grid and widget renderer
```

## The connection (`src/ws`)

`ServerConnection` owns one WebSocket to `ws://<host>/ws`:

- On open it sends `hello { deviceId, deviceName, token, clientVersion, pin?, capabilities }`. The version is read from `package.json`. The capabilities are
  `assets` and `layout.patch` (the protocol is described in the server repository).
- If the server answers `pairing_required` the app shows a PIN field (or takes the PIN from a scanned QR code). After a successful pairing the server sends a token in
  `welcome`, which is stored per host and used from then on.
- On a drop it reconnects with an exponentially growing wait (from 0.5 s up to 10 s). A late `onclose` of an old connection cannot overwrite the state of a newer one.
- Messages are handled strictly in arrival order. A layout that references assets not cached yet asks for them with `asset.get` and waits for the replies (at most five
  seconds; an asset that never arrives only leaves that icon blank). `asset` messages skip the queue, or they would wait behind the layout that is waiting for them.
- `layout.patch` is applied to the last layout the server described (`layoutPatch.ts`). Untouched pages and widgets keep their object identity so React does not redraw
  them; only the widgets the patch changed lose their cached live state. A patch that does not fit (a missed message) makes the app close the socket, and the reconnect
  brings a full layout.

`assets.ts` caches the large values (icons and images) the server sends once as `asset:<hash>` references: in memory (what drawing reads, so resolving stays synchronous) and on the device in IndexedDB (`storage/assetDb.ts`), evicting the least recently used
beyond 1000 entries or about 48 million characters. `prepareAssets` runs before the first draw (at most one second): it opens the database, carries the old `localStorage` assets over
(each removed only after it was written) and loads the ones the cached layouts use. Without a database the cache stays in `localStorage` (400 entries) as before. Resolving references keeps the identity of every part of the layout that has none, for the same redraw reason.

## Drawing

State messages are collected and applied once per frame (`ws/stateBatcher.ts`), and every deck widget is a memoised `DeckWidget` fed its own state, so one change redraws one widget.
The event callbacks passed down are stable; keep them so, or the memo does nothing. Settings has a switch that shows performance numbers (`perf/perfStats.ts`, off by default).

## Screens and behavior

- **Connect screen:** a server address field, the servers saved from earlier successful connections (a server is remembered once it has sent a layout), a QR scan button and the
  PIN field when pairing is needed. The QR scanner accepts the editor's `macrogrid://pair?host=<ip>&port=<port>&pin=<pin>` code (or a plain `ip:port` or `ip:port:pin`).
- **Deck:** the current page as a grid. Widgets report `widget.down`, `widget.up`, `widget.longPress`, `widget.doubleTap` and, for sliders and knobs, `widget.value`; the
  device vibrates on touch. A two-finger horizontal swipe anywhere on the deck sends `page.next` or `page.prev` (a single finger never changes page, so slider and knob drags are safe); the server also pushes `page.show` for `core.page` actions.
- **Drawer:** opened by a swipe from the screen edge or a handle whose height you can drag along the edge. It lists the profiles (`profile.change`), shows the lock switch for
  automatic profile switching when the device follows the active window (`profile.lock`), lists and edits the saved servers, and opens the settings.
- **Settings:** kiosk mode (on by default) and the orientation (automatic, portrait or landscape). They are stored in `localStorage` and pushed to the OS again on every start.
- **Errors:** an `error` message with code `action_failed` becomes a short red toast, so a button bound to something that no longer exists is not silent.

## Caching and storage

Everything except the assets is in `localStorage`, per server host where it makes sense: the pairing token, the last layout (in its compact `asset:` form, so it stays small), the shown page
(its own key, so a page change does not rewrite the layout), the saved servers, the settings and the drawer handle position. The assets are in the device database. On a cold start the last layout is drawn immediately with an "offline, cached" badge while the connection is made.
Pairing always takes precedence over a cached layout: if the server asks for a PIN, the connect screen is shown even when a layout is cached.

## The renderer

`packages/renderer` draws the grid and widgets. Each widget renders in its own Shadow DOM. Its custom CSS is sanitized (properties that change size or position are removed,
`@import` is removed, `url()` may only be a `data:` URI). It is an **independent copy** of the renderer in the server repository (which the editor and the browser deck use);
the two are deliberately not kept in sync, so a change that both need is made in both.

The `web` widget is an iframe (`WebContent`, address rule `isSafeWebUrl`). Its `sandbox` has no popups, downloads, top navigation, dialogs, orientation or pointer lock, its `allow` is
empty (no camera, location, clipboard, ...) and its referrer policy is `no-referrer`; the attributes are set once when the iframe is created. An address must be `http` or `https`,
without credentials, and never the server's own address or any loopback form. A button (`core.web` on the server) can change the address on this phone only: it arrives in `widget.state`
as `url` (an empty string goes back to the widget's own) and `reload` (a counter). Only the shown page of the grid is mounted. A `plugin-html` widget draws a placeholder for now.

A page cannot be limited in memory or CPU and shares the one renderer process with the deck, so the phone guards itself around web pages:
- **Crash guard.** The crash guard of plugin widgets (`WidgetGuard`, `WidgetCrashRules`) also covers web pages. The suspect of a page is its site, written `web:<host>` (host only, never the path or query:
  an alerts link carries a secret). The ids of everything live, plugins and `web:` hosts, go to the phone in one call, and an iframe is mounted only after the phone has confirmed it (write-ahead,
  `useConfirmedWebSites`; the plugin widgets' own report waits for it too). A page that navigates to another site on its own stays blamed under its starting host. A site the guard turned off draws a
  placeholder with a "Turn on" button, and Settings lists it next to the plugins.
- **Recommended live number.** Web widgets have their own number (`autoWebLimit` in `widgets/limits.ts`: 1 on a small phone, up to 3 on a strong one; Settings can choose a number or no limit) and do not
  take slots from plugin widgets. `planWebLoad` gives the slots in order (widgets kept loaded on other pages first, then the shown page in reading order); the rest draw a "Tap to load" placeholder,
  and a tap loads that widget even over the number (until the page is left).
- **Keep loaded.** A web widget with `props.keepLoaded` stays mounted, hidden, when its page is left (`DeckScreen` keeps such a page in the document with `display: none`, in the profile's page order,
  because moving an iframe reloads it). Only that widget stays; the rest of the page is unmounted. It counts toward the live number.
- **Background.** Web pages are unloaded 30 seconds after the app goes to the background or the screen turns off (`useHeldTrue`), and load again when it is back (a chat reconnects by itself). Plugin widgets are paused at once instead.
- **Not built: slow-page detection.** A frozen iframe blocks the parent's own long-task report, so no widget can be named as slow; only the crash guard and Tap to load exist.

## Native Android pieces

Small Capacitor plugins in `android/app/src/main/java/com/macrogrid/client/`:

- `KioskPlugin`: Android's immersive mode (hides the status and navigation bars). It is re-applied whenever the window regains focus, because the system clears it when the
  notification shade is pulled down. It is not screen pinning; Android does not let an app do that on its own.
- `GestureExclusionPlugin`: excludes the drawer's edge zone from Android's system back-swipe gesture so opening the drawer works (Android 10 and newer).
- `UpdaterPlugin` (with `UpdaterRules` and `InstallResultReceiver`): the app's self-update, everything that must not run in the WebView. It fetches the fixed releases list of this
  repository (ETag, no data about the phone), reads whether the network is unmetered, downloads the APK into the private cache folder (https on GitHub hosts only, redirects
  checked at every hop, size and SHA-256 verified), refuses a file signed by another key than the installed app, hands it to Android's `PackageInstaller` and removes what is
  not needed, so at most one downloaded APK stays. The decisions (which release, when to check, Later and Skip) are TypeScript in `src/update/` and `src/hooks/useUpdate.ts`;
  the design is in the server repository (`docs/design/phone-app-auto-update.md`).

- `WebPagesPlugin`, `SafeWebViewClient`, `SafeWebChromeClient` and `WebPageGuard`: the second lock for the `web` widget. A page in an iframe gets no permission (camera, microphone, location,
  notifications), no script dialog, no file picker, no new window and no download, and a navigation inside a frame only loads when it is `http` or `https` (it can never start another app or
  the system browser). The plugin also answers whether web pages may run at all: when the phone's system WebView lacks the "web message listener" feature the framework registers its native
  bridge in every frame, including a page's, so web widgets are turned off on that phone (a placeholder says why). The app config must never get an `allowNavigation` list; it widens the origins
  the bridge is registered for, and the same check turns web pages off if it does. Settings has a "Show web pages" switch and a "Clear web page data" button (cookies, cache and the stored data
  of every origin except the app's own).

Cleartext traffic is allowed (`usesCleartextTraffic` and `allowMixedContent`) because the server speaks plain `ws://`. Permissions: `INTERNET`, `ACCESS_NETWORK_STATE` (Wi-Fi or mobile data, for the update download), `REQUEST_INSTALL_PACKAGES` (install its own updates), `CAMERA` (the QR scanner) and `VIBRATE`.

## Security

- Traffic to the server is not encrypted; use the app only on a network you trust.
- The pairing token is kept in `localStorage` in the app's own storage. An update keeps it (same app, same signing key).
- The only other connection is the optional update check to `api.github.com` and the download from GitHub hosts. Nothing is installed without a tap, Android shows its own
  confirmation, and an APK signed with another key cannot replace the app. The release signing key never leaves the maintainer's computer (`docs/release.md`).
- The QR scanner uses the ML Kit barcode scanner through a Capacitor plugin; scanned codes are only parsed as a server address and PIN.
