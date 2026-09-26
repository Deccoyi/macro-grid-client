# Security policy

## What to expect from this software

Macro Grid is designed for a home or office network you trust. It is **not hardened for the internet** and must not be exposed to it.

- **Plain, unencrypted traffic.** The app talks to the server over plain `ws://`. Anyone who can see the traffic on your network can read it, including the pairing PIN and the token
  that is stored after pairing. Android is told to allow cleartext traffic for this reason.
- **One optional connection: the update check.** At start and about every six hours the app asks github.com whether a newer version exists. It sends only a program name and
  version (`MacroGridClient/<version>`), nothing about you or the phone, and installs nothing until you tap "Update now". A downloaded file is checked against the SHA-256 GitHub
  reports for it, and Android installs it only if it is signed with the same key as the installed app, which stays on the maintainer's own computer and is never put on GitHub.
  Android asks once for permission to install apps and shows its own confirmation (and possibly a security warning) each time. You can turn the check off in Settings, and
  choose whether updates may download over mobile data (Wi-Fi only by default).
- **LAN-only model.** The security model assumes that everyone on the network is at least somewhat trusted. Pairing (a six-digit PIN, then a token) keeps out casual connections; it is not
  a defense against an attacker on the same network. The whole system is described in the server repository's `docs/architecture.md`, and this app's part in
  [docs/architecture.md](docs/architecture.md#security).
- **No warranty, no liability.** This software was created entirely by AI tools, is alpha-stage and has not been independently audited or security-reviewed (see the [README](README.md)). It is provided "as is", without warranty of any kind, and the authors and contributors accept no responsibility or liability for it, including for security problems and their consequences (see the [MIT license](LICENSE)). You use it entirely at your own risk. Security reports are welcome, but they create no obligation to fix and are not a promise of support or of a response time.

## Reporting a vulnerability

Please report security problems privately, not in a public issue. Use GitHub's private vulnerability reporting: open the **Security** tab of this repository, then
**Report a vulnerability**.

For anything else about the project, open a normal issue. Please do not put vulnerability details in a public issue; use the private reporting above.

Helpful details: what is affected, the steps to reproduce, and what an attacker on the same network could do. A problem in the server or a plugin belongs in
the [server](https://github.com/Deccoyi/macro-grid) or [plugin](https://github.com/Deccoyi/macro-grid-plugin) repository.

## This is a hobby project

Macro Grid is a hobby project maintained in spare time, not a full-time job or a commercial product. Security reports are read and the
maintainer will try to fix real problems, but there is no guaranteed response time, no guaranteed fix, no support schedule and no bug
bounty. Fixes land when there is time for them. If that is not acceptable for how you use the software, do not rely on it.

## How fixes are announced

This is a hobby project, so nothing here is a promise. If a reported vulnerability gets fixed, the fix may be described in a GitHub
security advisory on this repository and under "Security" in the changelog.

## Supported versions

There is no support period and no promise of fixes: Macro Grid is a hobby project maintained in spare time. If a fix is made, it only goes
into a new release; older versions are not updated. Before the first release, fixes land on the `dev` branch. The project is in alpha.

## What a release contains

Every release has a software bill of materials (SBOM) attached: a CycloneDX JSON file (`MacroGrid-Client-<version>-sbom.cdx.json`) that lists
the npm packages bundled into the app. The Android libraries added by the Android build are not in it yet. A release is only built when none of
the bundled npm packages has a known vulnerability (moderate or higher), and every pull request runs the same check.
