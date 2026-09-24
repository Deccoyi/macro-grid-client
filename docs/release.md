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

## Not done yet

- Play Store publishing (an app bundle and Play App Signing). For now the APK is installed directly (`adb install`, or by
  copying it to the phone).
