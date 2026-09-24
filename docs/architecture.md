# Architecture

How the phone app works. The server side (protocol, actions, data model) is described in the
[macro-station](https://github.com/Deccoyi/macro-station) repository's `docs/architecture.md`.

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

`assets.ts` caches the large values (icons and images) the server sends once as `asset:<hash>` references: in memory and in `localStorage`, evicting the least recently used
beyond 400 entries. Resolving references keeps the identity of every part of the layout that has none, for the same redraw reason.

## Screens and behavior

- **Connect screen:** a server address field, the servers saved from earlier successful connections (a server is remembered once it has sent a layout), a QR scan button and the
  PIN field when pairing is needed. The QR scanner accepts the editor's `macrostation://pair?host=<ip>&port=<port>&pin=<pin>` code (or a plain `ip:port` or `ip:port:pin`).
- **Deck:** the current page as a grid. Widgets report `widget.down`, `widget.up`, `widget.longPress`, `widget.doubleTap` and, for sliders and knobs, `widget.value`; the
  device vibrates on touch. A horizontal swipe across most of the screen sends `page.next` or `page.prev`; the server also pushes `page.show` for `core.page` actions.
- **Drawer:** opened by a swipe from the screen edge or a handle whose height you can drag along the edge. It lists the profiles (`profile.change`), shows the lock switch for
  automatic profile switching when the device follows the active window (`profile.lock`), lists and edits the saved servers, and opens the settings.
- **Settings:** kiosk mode (on by default) and the orientation (automatic, portrait or landscape). They are stored in `localStorage` and pushed to the OS again on every start.
- **Errors:** an `error` message with code `action_failed` becomes a short red toast, so a button bound to something that no longer exists is not silent.

## Caching and storage

Everything is in `localStorage`, per server host where it makes sense: the pairing token, the last layout (in its compact `asset:` form, so it stays small), the saved servers,
the settings, the drawer handle position and the assets. On a cold start the last layout is drawn immediately with an "offline, cached" badge while the connection is made.
Pairing always takes precedence over a cached layout: if the server asks for a PIN, the connect screen is shown even when a layout is cached.

## The renderer

`packages/renderer` draws the grid and widgets. Each widget renders in its own Shadow DOM. Its custom CSS is sanitized (properties that change size or position are removed,
`@import` is removed, `url()` may only be a `data:` URI). It is an **independent copy** of the renderer in the server repository (which the editor and the browser deck use);
the two are deliberately not kept in sync, so a change that both need is made in both.

`web` and `plugin-html` widgets draw a placeholder for now.

## Native Android pieces

Two small Capacitor plugins in `android/app/src/main/java/com/macrostation/client/`:

- `KioskPlugin`: Android's immersive mode (hides the status and navigation bars). It is re-applied whenever the window regains focus, because the system clears it when the
  notification shade is pulled down. It is not screen pinning; Android does not let an app do that on its own.
- `GestureExclusionPlugin`: excludes the drawer's edge zone from Android's system back-swipe gesture so opening the drawer works (Android 10 and newer).

Cleartext traffic is allowed (`usesCleartextTraffic` and `allowMixedContent`) because the server speaks plain `ws://`. Permissions: `INTERNET`, `CAMERA` (the QR scanner) and `VIBRATE`.

## Security

- Traffic to the server is not encrypted; use the app only on a network you trust.
- The pairing token is kept in `localStorage` in the app's own storage.
- The QR scanner uses the ML Kit barcode scanner through a Capacitor plugin; scanned codes are only parsed as a server address and PIN.
