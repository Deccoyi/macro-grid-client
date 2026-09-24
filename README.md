# Macro Grid client

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Status: alpha](https://img.shields.io/badge/status-alpha-orange.svg)
[![CI](https://github.com/Deccoyi/macro-grid-client/actions/workflows/ci.yml/badge.svg)](https://github.com/Deccoyi/macro-grid-client/actions/workflows/ci.yml)

The phone and tablet app for [Macro Grid](https://github.com/Deccoyi/macro-grid). It connects over your local network to the Macro Grid server running
on your Windows PC and shows the grid you designed in the server's editor as a full-screen touch deck: buttons, toggles, sliders and knobs that press keys and run
actions on the PC, with live values coming back. It is an Android app built with Capacitor, React and TypeScript.

> ## AI-generated software: you use it entirely at your own risk
>
> All code, design, documentation and artwork of this project were created by artificial intelligence (an AI assistant working at the
> maintainer's direction). Nothing has been reviewed line by line by a human, security-audited or certified for any purpose.
>
> **No warranty, no liability.** The software is provided "as is", without warranty of any kind, express or implied. To the fullest
> extent permitted by law, the authors and contributors accept no responsibility or liability of any kind for it, including for damage,
> data loss, misuse, security problems or any other consequence of installing or using it. All risk is yours: which software you
> install, which devices you pair, which plugins you run and which buttons you press. The installer and the app ask you to accept the
> [user agreement](https://github.com/Deccoyi/macro-grid/blob/main/installer/license-agreement.txt). See also [LICENSE](LICENSE) (MIT).

Website and download: <https://deccoyi.github.io/macro-grid-client/>. The server and editor are in [macro-grid](https://github.com/Deccoyi/macro-grid) ([site](https://deccoyi.github.io/macro-grid/)) and the plugins in [macro-grid-plugin](https://github.com/Deccoyi/macro-grid-plugin) ([store](https://deccoyi.github.io/macro-grid-plugin/store/)).
The three are versioned independently. This app needs a Macro Grid server on the same network; without one it only shows its connect screen.

> **Alpha software.** Expect rough edges and changes between versions.

<!-- Screenshots: add images to docs/images/ and link them here. -->
*Screenshots: coming soon (connect screen, deck, profile drawer).*

## What it does

- **Connects** to a server by address, by scanning the QR code in the editor's Pairing window, or from a list of servers it remembers.
- **Pairs** with the six-digit PIN once (the QR code fills it in), then keeps a token so it reconnects without asking again.
- **Shows the deck:** the server's profile, page by page, drawn by the same kind of grid and widget renderer as the editor's preview. Pressing, releasing,
  long pressing and double tapping are sent to the server; slider and knob positions are two-way.
- **Switches** profiles from a drawer (swipe from the edge or use the handle) and pages by swiping left or right.
- **Follows the active window** on the PC if you turn that on for the device in the editor; a lock switch in the drawer pauses it.
- **Keeps working when the connection drops:** it reconnects with a growing wait, shows the last layout with an "offline, cached" badge, and caches icons on the device.
- **Kiosk mode** (full screen, on by default), an **orientation lock**, and **keep-awake** while a profile is shown.
- Shows a short **error toast** when an action fails on the server.

The app opens in Turkish when the phone's language is Turkish and in English otherwise.

## Requirements

- An Android phone or tablet (Android 7.0, API 24, or newer) on the same network as the server.
- A running Macro Grid server.

## Install

1. Install and start the **Macro Grid server** on your Windows PC first ([macro-grid](https://github.com/Deccoyi/macro-grid), see its Releases). The app does nothing without it.
2. Download the APK from this repository's [Releases](https://github.com/Deccoyi/macro-grid-client/releases) page and open it on the phone (allow installing from your browser or file manager when Android asks). The [download page](https://deccoyi.github.io/macro-grid-client/download) lists the latest version and the previous ones.
3. Open the app, then scan the QR code in the editor's Pairing window or enter the server address and PIN.

Plugins for the server are in [macro-grid-plugin](https://github.com/Deccoyi/macro-grid-plugin). You can also build the APK yourself (below). See [docs/release.md](docs/release.md).

## Build from source

You need [Node.js](https://nodejs.org/) 20 or newer, and for Android Android Studio (or the Android SDK and a JDK) with `JAVA_HOME` and `ANDROID_HOME` set.

```powershell
npm install

npm run dev          # the web version in a browser, for development (you enter the server address in the app)

npm run build        # build the web bundle
npx cap sync android # copy it into the Android project
npx cap open android # open Android Studio
```

`scripts\build-release-apk.ps1` builds a release APK; see [docs/release.md](docs/release.md) for signing. More in [docs/development.md](docs/development.md).

## Repository layout

```
src/                 the app: connect screen, deck, drawer, settings, connection
packages/renderer/   the grid and widget renderer (an independent copy, not shared with the server repository)
android/             the Capacitor Android project, with two small native plugins (kiosk mode, gesture exclusion)
docs/                architecture, development, release and versioning notes
scripts/             the release build
```

## Security

The app talks to the server over plain `ws://`, without encryption, because it is meant for a trusted local network. Android is told to allow cleartext traffic for
this reason. Do not use it over the internet. Details are in [docs/architecture.md](docs/architecture.md#security). To report a security problem, see [SECURITY.md](SECURITY.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Development](docs/development.md)
- [Releasing](docs/release.md) and [versioning](docs/versioning.md)
- [Changelog](docs/CHANGELOG.md) (short) and [developer changelog](docs/CHANGELOG-developer.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).

## Third-party licenses

The app uses open-source libraries and a few proprietary Google services. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) lists every component with its version, license and
copyright holder, and the original license texts are in [licenses/](licenses/). Both are also packaged into the app build (they are copied next to the web assets). The app
icons are AI-generated (image generator output, provided as is under the repository license).
