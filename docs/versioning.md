# Versioning

The phone app follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`. While it is before 1.0.0 (`0.MINOR.PATCH`) the same discipline applies: a breaking change or a
compatible feature is a MINOR bump, a fix is a PATCH bump.

## Where the version lives

The single source is `version` in `package.json`. The Android `versionName` is that string and the Android `versionCode` is derived from it (`major*10000 + minor*100 + patch`) in
`android/app/build.gradle`, so it always grows with the version. The app also sends the version to the server in its `hello` message (read from `package.json`).

## Independent of the server, but it says which server it needs

The app has its own version. The server and the plugin SDK share one number instead ([macro-grid versioning](https://github.com/Deccoyi/macro-grid/blob/main/docs/guides/versioning.md)), and each plugin has its own. A change here does not bump the others.

The app records the oldest Macro Grid it works with in `package.json`, as `"macroGrid": "1.0.0"` (three parts). It works with that version and every later version of the same MAJOR, the same rule a plugin follows. Raise it only when the app starts to depend on something that is new in the server (a new message, a new capability it needs); a fix or a feature that works with the old server leaves it alone.

They talk over a WebSocket. When `welcome` arrives, the app compares the server's `serverVersion` with `macroGrid` (`src/ws/serverCompat.ts`) and shows a message, without blocking the connection: an older server (or an older MAJOR) says to update Macro Grid on the computer, a newer MAJOR says to update the app. A label such as `-beta` on the server version is ignored, and a version the app cannot read never produces a warning.

Beyond that, compatibility is kept by **negotiating optional features**: the app lists the ones it understands in `hello.capabilities` (`assets`, `layout.patch`), and the server sends the older, plain form to a client that lists nothing, so a newer server keeps working with an older app and the reverse. New optional protocol features should be added the same way. Removing or changing the meaning of an existing message or field is a breaking change (a MAJOR bump of Macro Grid).

## Releasing

Work happens on the `dev` branch and is merged into `main` for a release. Before a merge to `main` the maintainer decides whether the version is bumped and by how much; a version number is never
changed silently. When a bump is approved the changelogs get their entry:

- `docs/CHANGELOG.md`: short, plain sentences for people who are not developers, with no code, file or API names and without small fixes or internal changes. It is also the source of the release notes.
- `docs/CHANGELOG-developer.md`: in [Keep a Changelog](https://keepachangelog.com/) format, only for what git history cannot carry: changes to the protocol or the announced capabilities, breaking changes, migrations and anything a maintainer has to do differently. Older entries are more detailed and stay as they are.

Both are written in English. See [release.md](release.md) for building and signing the APK, and the [central release guide](https://github.com/Deccoyi/macro-grid/blob/main/docs/guides/release.md) for the order of a release and the signing keys.
