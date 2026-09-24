# Contributing to the Macro Grid client

Thanks for your interest. Please read the [Code of Conduct](CODE_OF_CONDUCT.md). This repository is the Android phone and tablet app. The server and editor are in
[macro-grid](https://github.com/Deccoyi/macro-grid) and the plugins in [macro-grid-plugin](https://github.com/Deccoyi/macro-grid-plugin); each has its own version and rules.

## This is a hobby project

Macro Grid is maintained in spare time. Issues and pull requests are welcome, but replies and reviews can take a while, and there is no
promise that a request will be accepted or a pull request merged. Please be patient, and don't expect support on a schedule.

## Getting set up

See [docs/development.md](docs/development.md) for the requirements, how to run the app in a browser and on a phone, and the pitfalls.

## Before you start

- For anything bigger than a small fix, open an issue first so we can agree on the approach.
- Branching: `dev` is the integration branch, `main` holds releases only. Work on a branch from `dev` and open pull requests against `dev`.
- Keep a pull request to one topic. Several small, focused commits are better than one large one.

## Rules

- **Language.** Code, identifiers, comments, documentation, changelogs, log messages and commit messages are written in **English**. The app's screens are currently hard-coded Turkish;
  a proper translation layer is welcome as its own change. If you touch existing Turkish text in code, comments or docs that is not screen text, translate the part you touch.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`, for example `fix(client): keep the drawer open while a profile loads`.
- **Changelogs.** Update both under `[Unreleased]` when a change is finished: `docs/CHANGELOG-developer.md` (detailed, technical) and `docs/CHANGELOG.md` (short, plain sentences for
  non-developers, no code, file or API names, and without small fixes or internal changes).
- **Versions** are never bumped in a pull request; the maintainer decides at release time ([docs/versioning.md](docs/versioning.md)). Keep the protocol compatible: add optional capabilities
  instead of changing existing messages.
- **Names.** Do not mention third-party product or brand names in code, comments, docs or commits, except where the product is the functional target of the code itself.
- **The touch UI stays plain.** Widgets carry the user's own colors, but the app's own chrome (top bar, connection state, drawer, settings) stays neutral and plain: no gradients, glow or
  decorative icons, connection state as a small dot or label, lists rather than card grids, and touch targets that are not shrunk.
- **Dependencies.** Check the license of a new dependency and add it to [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No copyleft dependencies without a discussion.
- **The renderer** in `packages/renderer` is an independent copy of the server repository's. A change that both need is made in both.

## Build, test and APK

```powershell
npm ci
npm run typecheck   # TypeScript
npm run build       # web bundle
npm test            # renderer tests (packages/renderer)
```

Run typecheck and tests before you open a pull request, and add tests for renderer changes. CI runs the same steps.

To try the app on a phone, build the web bundle, run `npx cap sync android`, then build and install a debug APK from the `android` folder
(`gradlew assembleDebug`, JDK 21 and the Android SDK needed) or run it from Android Studio. Release APKs are built by the maintainer, see [docs/release.md](docs/release.md).

## Security

Please do not report security problems in a public issue; see [SECURITY.md](SECURITY.md). For other questions, open an issue.

## License

By contributing you agree that your contribution is licensed under the [MIT license](LICENSE) of this repository.
