# Security policy

## What to expect from this software

This app is designed for a home or office network you trust and is not hardened for the internet. Its traffic to the server is not encrypted (plain `ws://`). The security model of the
whole system is described in the server repository's `docs/architecture.md`, and this app's part of it in [docs/architecture.md](docs/architecture.md#security). The software was written by an AI assistant
and has not been independently audited (see the [README](README.md)).

## Reporting a vulnerability

Please report security problems privately, not in a public issue: use GitHub's private vulnerability reporting (the **Security** tab of the repository,
then **Report a vulnerability**). If that is not available, open an issue that says only that you have a security report and ask for a private channel,
without any details of the problem.

Helpful details: what is affected, the steps to reproduce, and what an attacker on the same network could do.

This is a small project maintained in spare time, so there is no guaranteed response time, but reports are taken seriously.

## Supported versions

Only the latest release (or, before the first release, the `dev` branch) receives fixes.
