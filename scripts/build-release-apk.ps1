<#
.SYNOPSIS
  Builds the phone app as a release APK into artifacts/.

.DESCRIPTION
  Signed when android\keystore.properties exists (see docs/release.md), otherwise unsigned. The version
  comes from package.json. Needs JAVA_HOME and ANDROID_HOME; when they are not set it falls back to
  Android Studio's bundled JDK and the default SDK folder.
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if (-not $env:JAVA_HOME) {
    $jbr = "C:\Program Files\Android\Android Studio\jbr"
    if (Test-Path $jbr) { $env:JAVA_HOME = $jbr } else { throw "JAVA_HOME is not set." }
}
if (-not $env:ANDROID_HOME) {
    $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
    if (Test-Path $sdk) { $env:ANDROID_HOME = $sdk } else { throw "ANDROID_HOME is not set." }
}

$version = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).version
Write-Host "Macro Grid client $version"

Push-Location $root
try {
    if (-not (Test-Path "node_modules")) { npm ci; if ($LASTEXITCODE) { throw "npm ci failed" } }
    npm run build
    if ($LASTEXITCODE) { throw "Web build failed" }
    npx cap sync android
    if ($LASTEXITCODE) { throw "cap sync failed" }
} finally { Pop-Location }

Push-Location (Join-Path $root "android")
try {
    .\gradlew.bat assembleRelease
    if ($LASTEXITCODE) { throw "Gradle build failed" }
} finally { Pop-Location }

$signed = Test-Path (Join-Path $root "android\keystore.properties")
$apk = Get-ChildItem (Join-Path $root "android\app\build\outputs\apk\release") -Filter "*.apk" | Select-Object -First 1
if (-not $apk) { throw "No APK was produced." }

$outDir = Join-Path $root "artifacts"
New-Item -ItemType Directory -Force $outDir | Out-Null
$name = if ($signed) { "MacroGrid-$version.apk" } else { "MacroGrid-$version-unsigned.apk" }
Copy-Item $apk.FullName (Join-Path $outDir $name) -Force
Write-Host "Done: $(Join-Path $outDir $name)"
if (-not $signed) { Write-Warning "Unsigned APK: a phone will not install it. Create a keystore first, see docs/release.md." }
