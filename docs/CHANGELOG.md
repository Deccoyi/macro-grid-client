# Changelog

New features and fixes in the Macro Grid phone app. For technical details, see [CHANGELOG-developer.md](CHANGELOG-developer.md).

## Unreleased
### New
- **Web widgets show real pages:** a live chat, an alerts panel or any other page you put in a web widget now appears on your deck. Pages cannot open windows, download files or use your camera or location. Only the page you are looking at is loaded, and only while the app is open.
- **Web pages settings:** turn web pages off on this phone, or clear the data that embedded sites left on it.
### Changed
- **Buttons can change a web widget:** a button can show another site in a web widget, or reload it, on your phone only.
### Fixed
- **Safer images and icons:** Icons and images shown on your deck are now checked before loading, so a button or image with an unsafe address is skipped instead of shown.

## 0.3.0 - 2026-09-28
### New
- **Component list:** Every release now comes with a list of the components the app contains, and a release is only built when none of them has a known security problem.
- **Version check:** The app tells you when Macro Grid on your computer is too old for it, or too new, and what to update.
- **Encrypted connection:** When your computer offers it, the app now connects over an encrypted connection instead of a plain one, pinned to your computer's own certificate. Scan the pairing QR code again to switch an already-paired server to it.
- **Skip pairing:** A close button on the pairing screen lets you go straight to Settings without pairing first.
- **Simpler server address:** You only need to type the IP address; the port is filled in for you unless your server uses a different one.
- **Forget the current server:** You can now remove your current server from the list too, not just the others.
- **Fewer update prompts:** On Android 12 and newer, after the app has updated itself once, later updates may install without asking for confirmation each time. "Update now" is still always your choice.

### Fixed
- **Wrong PIN:** Entering a wrong pairing PIN now shows why it didn't work (wrong PIN, too many tries, or pairing closed on the computer) instead of doing nothing, and a lockout now counts down for real instead of showing a frozen number.

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
