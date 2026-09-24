# Macro Grid client (alpha)

The Android phone and tablet app for [Macro Grid](https://github.com/Deccoyi/macro-grid). **This is alpha software**, written by an AI assistant and not independently audited.
It is provided as is, without warranty.

## Before you install

- You need the Macro Grid server running on a Windows PC on the same network. Without it the app only shows its connect screen.
- Traffic between the app and the server is not encrypted (plain `ws://`). Use it on a network you trust, never over the internet.
- Needs Android 7.0 or newer. Screens are in Turkish for now.
- If the file name ends in `-debug.apk` it is not signed with the release key and cannot be updated by a later release-signed build.

## What is in this release

- Connect to a server by address or QR code; pair once with a PIN.
- Buttons, toggles, sliders, knobs and labels with live values; long press and double tap.
- Profile drawer, page switching by swipe, saved servers, profile lock.
- Reconnects by itself and shows the last layout offline. Icons are cached on the phone.
- Kiosk mode (on by default), orientation lock, screen stays awake.
- Short alert when a button action fails.
- Edits in the editor reach the phone without the deck flashing.
- The list of open-source licenses ships with the app.

See the full [changelog](https://github.com/Deccoyi/macro-grid-client/blob/main/docs/CHANGELOG.md).
