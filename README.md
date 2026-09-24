# Macro Station client

The phone and tablet app for [Macro Station](https://github.com/Deccoyi/macro-station). It connects over your local network to the Macro Station server running
on your Windows PC and shows the grid you designed in the server's editor as a full-screen touch deck: buttons, toggles, sliders and knobs that press keys and run
actions on the PC, with live values coming back. It is an Android app built with Capacitor, React and TypeScript.

> ## This project was written entirely by an AI assistant
>
> All code, design and documentation in this repository were written by an AI assistant (Claude) at a user's direction. It has not been reviewed line by line by a
> human, security-audited or certified for production use.
>
> **No warranty of any kind.** The software is provided "as is", without warranty of any kind, express or implied, including but not limited to
> merchantability, fitness for a particular purpose and non-infringement. You use it entirely at your own risk. See [LICENSE](LICENSE) (MIT).

The server and editor are in [macro-station](https://github.com/Deccoyi/macro-station) and the plugins in [macro-station-plugin](https://github.com/Deccoyi/macro-station-plugin).
The three are versioned independently. This app needs a Macro Station server on the same network; without one it only shows its connect screen.

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

The app's screens are currently in Turkish only.

## Requirements

- An Android phone or tablet (Android 7.0, API 24, or newer) on the same network as the server.
- A running Macro Station server.

There are no published releases yet: build the APK yourself (below). See [docs/release.md](docs/release.md).

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
icons are AI-generated.
