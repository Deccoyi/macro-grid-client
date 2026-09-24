# Versioning

The phone app follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`. While it is before 1.0.0 (`0.MINOR.PATCH`) the same discipline applies: a breaking change or a
compatible feature is a MINOR bump, a fix is a PATCH bump.

## Where the version lives

The single source is `version` in `package.json`. The Android `versionName` is that string and the Android `versionCode` is derived from it (`major*10000 + minor*100 + patch`) in
`android/app/build.gradle`, so it always grows with the version. The app also sends the version to the server in its `hello` message (read from `package.json`).

## Independent of the server and the plugins

The app, the server ([macro-station](https://github.com/Deccoyi/macro-station)) and the plugins ([macro-station-plugin](https://github.com/Deccoyi/macro-station-plugin)) each have their own version. A
change here does not bump the others.

They talk over a WebSocket. The versions in `hello` and `welcome` are informational and nothing checks them. Compatibility is kept by **negotiating optional features**: the app lists the ones it
understands in `hello.capabilities` (`assets`, `layout.patch`), and the server sends the older, plain form to a client that lists nothing, so a newer server keeps working with an older app and the
reverse. New optional protocol features should be added the same way. Removing or changing the meaning of an existing message or field is a breaking change.

## Releasing

Work happens on the `dev` branch and is merged into `main` for a release. Before a merge to `main` the maintainer decides whether the version is bumped and by how much; a version number is never
changed silently. When a bump is approved both changelogs get their entry:

- `docs/CHANGELOG-developer.md`: detailed and technical, in [Keep a Changelog](https://keepachangelog.com/) format.
- `docs/CHANGELOG.md`: short, plain sentences for people who are not developers, with no code, file or API names and without small fixes or internal changes.

Both are written in English. See [release.md](release.md) for building and signing the APK.
