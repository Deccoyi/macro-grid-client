# Releasing the phone app

The one release guide for every part of Macro Grid (tags, order of a release, all signing keys) is [docs/guides/release.md in the server repository](https://github.com/Deccoyi/macro-grid/blob/main/docs/guides/release.md); read it first. This page only has what is specific to the APK.

`scripts\build-release-apk.ps1` builds the web bundle, syncs it into the Android project and runs Gradle's
`assembleRelease`, then copies the APK to `artifacts\`. The app version is `version` in `package.json`
(`versionName`), and `versionCode` is derived from it as `major*10000 + minor*100 + patch`, so it always grows with the version.

It needs `JAVA_HOME` and `ANDROID_HOME`; when they are not set the script falls back to Android Studio's bundled JDK and the
default SDK folder.

## Signing

A phone only installs a signed APK, and an update only installs over an app signed with the same key. So the key is created
once and kept forever.

**The release APK is signed on the maintainer's PC and uploaded to the release by hand. The key and its passwords are never put on GitHub**
(no repository or environment secrets, and CI never builds a release APK). Why: the key cannot be replaced. Whoever holds it can make phones
accept a malicious APK as an update, and changing it means every user has to uninstall and reinstall. With the key on one PC, even a
compromised GitHub account cannot push an update that installed phones accept.

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

3. Run `scripts\build-release-apk.ps1`. With that file present the APK is signed and named `MacroGrid-<version>.apk`
   (the phone app's updater looks for exactly this name); without it the build still succeeds but the APK is
   `MacroGrid-<version>-unsigned.apk` and cannot be installed. For a signed APK the script then checks the signer, `versionName` and
   `versionCode` (see the checklist).

**If the keystore is lost, the update path is closed for good:** existing installs can no longer be updated and every user has to uninstall and
reinstall. Keep an encrypted backup of the key folder outside every repository (a USB stick or encrypted storage) and the passwords in a password manager.

The release certificate (public information; the key is not) has this SHA-256 fingerprint. Every release APK must show it:

```
cba39e128ebeaa805390295c5602857f9c6bb3d1e5ba4a9b8c603bcae4c36afd
```

Check a signed APK by hand with `apksigner verify --print-certs artifacts\MacroGrid-<version>.apk` (in the Android SDK's `build-tools`).

## Release checklist

Tags are named `client-vX.Y.Z` (the server uses `server-v...`, plugins `plugin-<name>-v...`). The tag must match `version` in `package.json`.
The version is a plain `X.Y.Z` (no label, minor and patch below 100; the Gradle build refuses anything else), and "pre-release" is GitHub's flag on the release.

1. On `dev`: decide the version bump ([versioning.md](versioning.md)), set `version` in `package.json` (and `macroGrid` there, if the app now needs a newer Macro Grid than before; that server version must already be released) and move `[Unreleased]` in both changelogs to the new version. The public `CHANGELOG.md` section is what the release page and the app's update screen show, so write it for users.
2. Run `npm ci`, `npm run typecheck`, `npm test` and `npm run build`; CI on `dev` must be green.
3. Build the signed APK (`scripts\build-release-apk.ps1`). The script stops when the certificate is not the release certificate above or when `versionName` / `versionCode` do not match `package.json` (`versionCode` is `major*10000 + minor*100 + patch` and must be higher than the previous release's). Never re-release a version with a different APK.
4. Install it on a real phone **over the previous release** and pair against the release server.
5. Merge `dev` into `main`, then tag: `git tag client-vX.Y.Z` and push the tag.
6. The `Release` workflow (`.github/workflows/release.yml`) builds a debug APK as a build check only (a workflow artifact, kept a few days), and creates a **draft** pre-release whose notes are the version's section of `docs/CHANGELOG.md` plus `docs/release-notes-footer.md`. It attaches **no APK**.
7. Upload the signed `MacroGrid-<version>.apk` from step 3 to the draft (the release page, or the GitHub command-line client). Check that the asset name is exactly that, that GitHub shows a `sha256:` digest for it, and that no other APK is attached. Never attach a `-debug` or `-unsigned` file.
8. Publish the draft. Once the phone app has an updater, publishing reaches every running app within about 6 hours, so step 4 is mandatory.
9. Merge `main` back into `dev` if the release commit changed anything.

## Release notes

`scripts\release-notes.ps1 -Tag client-vX.Y.Z` prints the body of the release: the version's section of `docs/CHANGELOG.md` (a short pointer to the changelog when there is none)
then a "Works with Macro Grid X.Y.Z or newer" line (from `macroGrid` in `package.json`) and the fixed footer `docs/release-notes-footer.md` (alpha, needs the server, network). The workflow runs it; run it by hand to preview the text.

## Not done yet

- Play Store publishing (an app bundle and Play App Signing). For now the APK is installed directly (`adb install`, or by
  copying it to the phone).
