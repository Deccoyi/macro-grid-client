# Changelog

New features and fixes in the Macro Grid phone app. For technical details, see [CHANGELOG-developer.md](CHANGELOG-developer.md).

## Unreleased

## 0.2.0 - 2026-09-25
### New
- **Updates:** The app tells you when a new version is available, shows what changed, and installs it after one tap. Your pairing is kept. You can turn the check off in Settings.
- **Settings page:** Settings are now a full page. New: choose whether updates download over Wi-Fi only (the default) or also over mobile data.
- **Language:** Choose Turkish or English in Settings, or let the app follow the phone's language.

### Fixed
- **Two-finger swipe:** A two-finger swipe no longer presses a button, moves a slider or turns a knob that one of the fingers touched first.

### Changed
- **Signed releases:** New versions are signed with the project's own key. If you have version 0.1.1 on your phone, uninstall it once before installing this version; your pairing and saved servers are removed with it. Version 0.1.0 can be updated directly.
- **Page switching:** Change page with a two-finger swipe left or right, anywhere on the screen. A single finger no longer changes page, so dragging a slider or knob cannot flip the page.

## 0.1.1 - 2026-09-24
### New
- **Language:** The app now opens in Turkish when your phone's language is Turkish, and in English otherwise.
- **Licenses:** The list of open-source components and their licenses is now included with the app.
- **Profile lock:** The profile drawer has a switch with a lock icon. While it is on, your computer will not change the profile by itself.
- **Saved servers:** The app remembers the servers you connected to. Switch, delete or add one from the drawer.
- **Kiosk mode:** Now on by default. You can turn it off in Settings.
- **Error alerts:** If a button fails, a short red alert appears on screen.
- **Page switching:** Swipe left or right to change pages.
- **Full screen and orientation lock:** Turn them on in the Settings panel.

### Changed
- Buttons, toggles and labels can change their text and icon depending on a value.
- Edits from the editor now reach your phone as small updates, so the deck no longer flashes or resets while you edit.
- Icons are downloaded once and kept on the phone. Reconnecting is faster.

### Fixed
- The camera view stayed black in the QR scanner. It now shows up.

## First releases
- Connect to a server by IP or by QR code. Enter a PIN on the first connection.
- Buttons, sliders and gauges work on screen. Long press, double tap and vibration are supported.
- Open the profile drawer by pulling it from the edge of the screen.
- If the connection drops, the app reconnects by itself. The last screen is still visible offline.
- The screen stays awake while a profile is open.
