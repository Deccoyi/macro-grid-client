# Third-party notices

The Macro Grid client is released under the [MIT License](LICENSE) (Copyright (c) 2026 Deccoyi). It ships with the open-source and third-party components listed below.
Each one stays under its own license. The original license texts are copied verbatim into the [`licenses/`](licenses/) folder, one sub-folder per library, and the
table below points to them. The list was built from `package.json`, `package-lock.json`, the installed `node_modules` packages and the resolved Android release
runtime classpath (`gradlew :app:dependencies --configuration releaseRuntimeClasspath`). Development-only tools (build, type-check and test tooling) are not part of
the app and are not listed.

The same files are packaged into the app: the built web assets contain `THIRD_PARTY_NOTICES.md` and `licenses/`, so they travel inside the APK.

## Project assets

- **App icons** (`public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `public/favicon.ico` and the Android launcher and splash images) are
  AI-generated artwork. They are not taken from any third-party icon set.
- **Fonts:** the app does not bundle any font files. It uses the fonts of the device.
- **Icon libraries:** the client does not include any icon library. (The shared renderer only accepts icons that are already baked into a layout.)

## JavaScript packages (production dependencies)

| Name | Version | License (SPDX) | Copyright holder | URL | License text |
|---|---|---|---|---|---|
| @capacitor/core | 8.5.2 | MIT | Drifty Co. | https://github.com/ionic-team/capacitor | [licenses/capacitor-core](licenses/capacitor-core/LICENSE) |
| @capacitor/android | 8.5.2 | MIT | Drifty Co. | https://github.com/ionic-team/capacitor | [licenses/capacitor-android](licenses/capacitor-android/LICENSE) |
| @capacitor/screen-orientation | 8.0.1 | MIT | Ionic | https://github.com/ionic-team/capacitor-plugins | [licenses/capacitor-screen-orientation](licenses/capacitor-screen-orientation/LICENSE) |
| @capacitor-community/keep-awake | 8.0.1 | MIT | The keep-awake developers | https://github.com/capacitor-community/keep-awake | [licenses/capacitor-community-keep-awake](licenses/capacitor-community-keep-awake/LICENSE) |
| @capacitor-mlkit/barcode-scanning | 8.2.1 | Apache-2.0 | Robin Genz | https://github.com/capawesome-team/capacitor-mlkit | [licenses/capacitor-mlkit-barcode-scanning](licenses/capacitor-mlkit-barcode-scanning/LICENSE) |
| react | 18.3.1 | MIT | Facebook, Inc. and its affiliates | https://github.com/facebook/react | [licenses/react](licenses/react/LICENSE) |
| react-dom | 18.3.1 | MIT | Facebook, Inc. and its affiliates | https://github.com/facebook/react | [licenses/react-dom](licenses/react-dom/LICENSE) |
| scheduler | 0.23.2 | MIT | Facebook, Inc. and its affiliates | https://github.com/facebook/react | [licenses/scheduler](licenses/scheduler/LICENSE) |
| loose-envify | 1.4.0 | MIT | Andres Suarez | https://github.com/zertosh/loose-envify | [licenses/loose-envify](licenses/loose-envify/LICENSE) |
| js-tokens | 4.0.0 | MIT | Simon Lydell | https://github.com/lydell/js-tokens | [licenses/js-tokens](licenses/js-tokens/LICENSE) |
| tslib | 2.8.1 | 0BSD | Microsoft Corporation | https://github.com/Microsoft/tslib | [licenses/tslib](licenses/tslib/LICENSE) |
| postcss | 8.5.28 | MIT | Andrey Sitnik | https://github.com/postcss/postcss | [licenses/postcss](licenses/postcss/LICENSE) |
| postcss-safe-parser | 7.1.0 | MIT | Andrey Sitnik | https://github.com/postcss/postcss-safe-parser | [licenses/postcss-safe-parser](licenses/postcss-safe-parser/LICENSE) |
| nanoid | 3.3.19 | MIT | Andrey Sitnik | https://github.com/ai/nanoid | [licenses/nanoid](licenses/nanoid/LICENSE) |
| picocolors | 1.1.1 | ISC | Oleksii Raspopov, Kostiantyn Denysov, Anton Verinov | https://github.com/alexeyraspopov/picocolors | [licenses/picocolors](licenses/picocolors/LICENSE) |
| source-map-js | 1.2.1 | BSD-3-Clause | Mozilla Foundation and contributors | https://github.com/7rulnik/source-map-js | [licenses/source-map-js](licenses/source-map-js/LICENSE) |

`loose-envify` and `js-tokens` are transitive production dependencies of `react`. `@macro/renderer` (`packages/renderer`) is this project's own code, not a third-party
component.

## Android (Gradle) libraries

Resolved from the release runtime classpath. Libraries of one family share one license text, so they are grouped. Versions are the resolved ones at the time of writing.

| Name | Version | License (SPDX) | Copyright holder | URL | License text |
|---|---|---|---|---|---|
| AndroidX (appcompat, core, activity, fragment, lifecycle, camera, webkit and the other modules listed below) | see list below | Apache-2.0 | The Android Open Source Project | https://developer.android.com/jetpack/androidx | [licenses/androidx](licenses/androidx/LICENSE) |
| libyuv (bundled inside `androidx.camera:camera-core`) | n/a | BSD-3-Clause | The LibYuv Project Authors | https://chromium.googlesource.com/libyuv/libyuv | [licenses/libyuv](licenses/libyuv/LICENSE) |
| Kotlin standard library | 2.0.21 | Apache-2.0 | JetBrains s.r.o. and Kotlin Programming Language contributors | https://github.com/JetBrains/kotlin | [licenses/kotlin-stdlib](licenses/kotlin-stdlib/LICENSE) |
| kotlinx.coroutines (core, core-jvm, android) | 1.8.1 | Apache-2.0 | JetBrains s.r.o. and contributors | https://github.com/Kotlin/kotlinx.coroutines | [licenses/kotlinx-coroutines](licenses/kotlinx-coroutines/LICENSE) |
| JetBrains annotations | 23.0.0 | Apache-2.0 | JetBrains s.r.o. | https://github.com/JetBrains/java-annotations | [licenses/jetbrains-annotations](licenses/jetbrains-annotations/LICENSE) |
| Apache Cordova Android framework (`org.apache.cordova:framework`) | 14.0.1 | Apache-2.0 | The Apache Software Foundation | https://github.com/apache/cordova-android | [licenses/apache-cordova-android](licenses/apache-cordova-android/LICENSE) |
| Firebase components and Google Data Transport (`firebase-annotations`, `firebase-components`, `firebase-encoders`, `firebase-encoders-json`, `transport-api`, `transport-backend-cct`, `transport-runtime`) | see list below | Apache-2.0 | Google LLC | https://github.com/firebase/firebase-android-sdk | [licenses/google-firebase-datatransport](licenses/google-firebase-datatransport/LICENSE) |
| javax.inject | 1 | Apache-2.0 | The javax.inject authors | https://github.com/javax-inject/javax-inject | [licenses/javax-inject](licenses/javax-inject/LICENSE) |
| JSpecify | 1.0.0 | Apache-2.0 | The JSpecify authors | https://github.com/jspecify/jspecify | [licenses/jspecify](licenses/jspecify/LICENSE) |
| AutoValue annotations | 1.6.3 | Apache-2.0 (upstream; see note) | Google LLC | https://github.com/google/auto | [licenses/google-auto-value-annotations](licenses/google-auto-value-annotations/LICENSE) |
| Guava `listenablefuture` stub | 1.0 | Apache-2.0 (upstream; see note) | Google LLC | https://github.com/google/guava | [licenses/guava-listenablefuture](licenses/guava-listenablefuture/LICENSE) |

Notes:

- The published metadata of `auto-value-annotations` 1.6.3 and `listenablefuture` 1.0 does not state a license. Both are published by Google from Apache-2.0 projects, and
  the Apache-2.0 text is attached for that reason. This is the one place where the license comes from the upstream project rather than from the artifact itself.
- No Apache-2.0 artifact above was found to ship a `NOTICE` file (the Cordova framework and camera library archives were inspected), so there are no NOTICE files to
  copy. The Apache-2.0 texts in `licenses/` for the Android libraries are the canonical text from apache.org, because these artifacts carry no per-project license file.

### Google services (proprietary terms, not copied)

These libraries are **not** open source. They are distributed under Google's own terms, which apply instead of an open-source license. The terms are linked here and are
deliberately not copied into `licenses/`.

| Libraries | Terms |
|---|---|
| ML Kit barcode scanning: `com.google.mlkit:barcode-scanning` 17.3.0, `barcode-scanning-common` 17.0.0, `common` 18.11.0, `vision-common` 17.3.0, `vision-interfaces` 16.3.0, `com.google.android.gms:play-services-mlkit-barcode-scanning` 18.3.1, `play-services-code-scanner` 16.1.0 | ML Kit Terms of Service: https://developers.google.com/ml-kit/terms |
| Google Play services: `play-services-base` 18.5.0, `play-services-basement` 18.4.0, `play-services-tasks` 18.2.0, `com.google.android.odml:image` 1.0.0-beta1 | Android Software Development Kit License: https://developer.android.com/studio/terms.html |

### Module lists

- AndroidX: `androidx.activity:activity:1.11.0`, `androidx.annotation:annotation-experimental:1.4.1`, `androidx.annotation:annotation-jvm:1.8.1`, `androidx.annotation:annotation:1.8.1`, `androidx.appcompat:appcompat-resources:1.7.1`, `androidx.appcompat:appcompat:1.7.1`, `androidx.arch.core:core-common:2.2.0`, `androidx.arch.core:core-runtime:2.2.0`, `androidx.camera.featurecombinationquery:featurecombinationquery:1.5.2`, `androidx.camera:camera-camera2:1.5.2`, `androidx.camera:camera-core:1.5.2`, `androidx.camera:camera-lifecycle:1.5.2`, `androidx.camera:camera-video:1.5.2`, `androidx.camera:camera-view:1.5.2`, `androidx.collection:collection-jvm:1.4.2`, `androidx.collection:collection:1.4.2`, `androidx.concurrent:concurrent-futures-ktx:1.1.0`, `androidx.concurrent:concurrent-futures:1.1.0`, `androidx.coordinatorlayout:coordinatorlayout:1.3.0`, `androidx.core:core-ktx:1.17.0`, `androidx.core:core-splashscreen:1.2.0`, `androidx.core:core-viewtree:1.0.0`, `androidx.core:core:1.17.0`, `androidx.cursoradapter:cursoradapter:1.0.0`, `androidx.customview:customview:1.0.0`, `androidx.drawerlayout:drawerlayout:1.0.0`, `androidx.emoji2:emoji2-views-helper:1.3.0`, `androidx.emoji2:emoji2:1.3.0`, `androidx.exifinterface:exifinterface:1.3.2`, `androidx.fragment:fragment:1.8.9`, `androidx.interpolator:interpolator:1.0.0`, `androidx.lifecycle:lifecycle-common:2.6.2`, `androidx.lifecycle:lifecycle-livedata-core:2.6.2`, `androidx.lifecycle:lifecycle-livedata:2.6.2`, `androidx.lifecycle:lifecycle-process:2.6.2`, `androidx.lifecycle:lifecycle-runtime:2.6.2`, `androidx.lifecycle:lifecycle-viewmodel-savedstate:2.6.2`, `androidx.lifecycle:lifecycle-viewmodel:2.6.2`, `androidx.loader:loader:1.0.0`, `androidx.profileinstaller:profileinstaller:1.4.0`, `androidx.resourceinspection:resourceinspection-annotation:1.0.1`, `androidx.savedstate:savedstate:1.2.1`, `androidx.startup:startup-runtime:1.1.1`, `androidx.tracing:tracing-ktx:1.2.0`, `androidx.tracing:tracing:1.2.0`, `androidx.vectordrawable:vectordrawable-animated:1.1.0`, `androidx.vectordrawable:vectordrawable:1.1.0`, `androidx.versionedparcelable:versionedparcelable:1.1.1`, `androidx.viewpager:viewpager:1.0.0`, `androidx.webkit:webkit:1.14.0`
- Firebase and Data Transport: `com.google.android.datatransport:transport-api:2.2.1`, `com.google.android.datatransport:transport-backend-cct:2.3.3`, `com.google.android.datatransport:transport-runtime:2.2.6`, `com.google.firebase:firebase-annotations:16.0.0`, `com.google.firebase:firebase-components:16.1.0`, `com.google.firebase:firebase-encoders-json:17.1.0`, `com.google.firebase:firebase-encoders:16.1.0`

## For contributors

When you add a dependency, check its license, copy the original license file (and any `NOTICE` file) into `licenses/<library-name>/`, and add a row to the matching table
above. Do not add a dependency under a copyleft license (GPL, AGPL and similar) without first checking that it is compatible with this repository's MIT license.
