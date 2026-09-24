# Security policy

## What to expect from this software

Macro Grid is designed for a home or office network you trust. It is **not hardened for the internet** and must not be exposed to it.

- **Plain, unencrypted traffic.** The app talks to the server over plain `ws://`. Anyone who can see the traffic on your network can read it, including the pairing PIN and the token
  that is stored after pairing. Android is told to allow cleartext traffic for this reason.
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

This is a small project maintained in spare time, so there is no guaranteed response time, but reports are taken seriously.

## Supported versions

Only the latest release (or, before the first release, the `dev` branch) receives fixes. The project is in alpha.
