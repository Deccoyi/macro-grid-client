# Releasing the phone app

`scripts\build-release-apk.ps1` builds the web bundle, syncs it into the Android project and runs Gradle's
`assembleRelease`, then copies the APK to `artifacts\`. The app version is `version` in `package.json`
(`versionName`), and `versionCode` is derived from it as `major*10000 + minor*100 + patch`, so it always grows with the version.

It needs `JAVA_HOME` and `ANDROID_HOME`; when they are not set the script falls back to Android Studio's bundled JDK and the
default SDK folder.

## Signing

A phone only installs a signed APK, and an update only installs over an app signed with the same key. So the key is created
once and kept forever.

1. Create the keystore (choose your own passwords, and keep the file somewhere safe outside the repo, with a backup):

   ```powershell
   keytool -genkeypair -v -keystore C:\keys\macro-grid.jks -alias macrogrid -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Create `android\keystore.properties` (it is git-ignored, never commit it or the keystore):

   ```properties
   storeFile=C:/keys/macro-grid.jks
   storePassword=...
   keyAlias=macrogrid
   keyPassword=...
   ```

3. Run `scripts\build-release-apk.ps1`. With that file present the APK is signed and named `MacroGrid-<version>.apk`;
   without it the build still succeeds but the APK is `MacroGrid-<version>-unsigned.apk` and cannot be installed.

If the keystore is lost, existing installs can no longer be updated: users would have to uninstall and reinstall.

Check a signed APK with `apksigner verify --print-certs artifacts\MacroGrid-<version>.apk` (in the Android SDK's `build-tools`).

## Release checklist

Tags are named `client-vX.Y.Z` (the server uses `server-v...`, plugins `plugin-<name>-v...`). The tag must match `version` in `package.json`.

1. On `dev`: decide the version bump ([versioning.md](versioning.md)), set `version` in `package.json` and move `[Unreleased]` in both changelogs to the new version.
2. Run `npm ci`, `npm run typecheck`, `npm test` and `npm run build`; CI on `dev` must be green.
3. Build the signed APK (`scriptsuild-release-apk.ps1`), verify it with `apksigner`, install it on a real phone and pair against the release server.
4. Update `docs/release-notes-client-v0.x-alpha.md` (from the public `CHANGELOG.md`).
5. Merge `dev` into `main`, then tag: `git tag client-vX.Y.Z` and push the tag.
6. The `Release` workflow (`.github/workflows/release.yml`) builds the APK and creates a **draft** pre-release. Review it, replace or confirm the APK, then publish the draft.
7. Merge `main` back into `dev` if the release commit changed anything.

### Release CI and signing

The workflow signs the APK only if these repository secrets exist: `ANDROID_KEYSTORE_BASE64` (the keystore file, base64), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
Without them it attaches a debug-signed APK named `MacroGrid-<version>-debug.apk`; that installs, but it is not a real release build and cannot be updated by a later release-signed APK.
The keystore is never committed: it is decoded into the runner's temp folder for the build and deleted afterwards. Keep the master copy and a backup outside the repository.

## Not done yet

- Play Store publishing (an app bundle and Play App Signing). For now the APK is installed directly (`adb install`, or by
  copying it to the phone).
