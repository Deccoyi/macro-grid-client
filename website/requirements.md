---
title: Requirements
---

# Requirements

- An Android phone or tablet running **Android 7.0** (API 24) or newer.
- The **Macro Grid server** running on a Windows PC, on the **same Wi-Fi network** as the phone. Get it from [Macro Grid (PC)](https://deccoyi.github.io/macro-grid/download). Without a server the app only shows its connect screen.
- **Camera permission**, if you want to pair by scanning the QR code. You can also type the server address and PIN by hand.

The app talks to the server over plain `ws://`, without encryption, because it is meant for a trusted local network. Do not use it over the internet.

## Updates

The app can look for a newer version by itself: at start and about every six hours it asks github.com whether one exists (it sends only the app name and version). It shows what
changed and installs the new version after you tap **Update now**. The first time, Android asks you once to allow Macro Grid to install apps, and it always shows its own
confirmation (and maybe a security warning). Updates download over Wi-Fi only unless you choose otherwise. You can turn all of this off in Settings.

## No install? Use the browser deck

Macro Grid also has a browser deck: you can open the deck in a browser on any device on your network instead of installing this app. See the [phone app guide](https://deccoyi.github.io/macro-grid/guide/phone-app) for details.
