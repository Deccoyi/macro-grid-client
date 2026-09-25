<#
.SYNOPSIS
  Builds the phone app as a release APK into artifacts/.

.DESCRIPTION
  Signed when android\keystore.properties exists (see docs/release.md), otherwise unsigned. A signed APK is then
  checked: its certificate must be the release certificate and its versionName/versionCode must match package.json.
  The version comes from package.json. Needs JAVA_HOME and ANDROID_HOME; when they are not set it falls back to
  Android Studio's bundled JDK and the default SDK folder.
#>
param(
    # SHA-256 of the release signing certificate (public; the key is not). Change it only if the key is ever replaced.
    [string] $ReleaseCertificateSha256 = "cba39e128ebeaa805390295c5602857f9c6bb3d1e5ba4a9b8c603bcae4c36afd"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

# Runs a native command (npm, Gradle) whose harmless notes on stderr (for example a compiler note) must not stop the script in
# Windows PowerShell: only the exit code decides.
function Invoke-Native([scriptblock] $Command, [string] $Failure) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { & $Command 2>&1 | ForEach-Object { "$_" } | Write-Host } finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE) { throw $Failure }
}

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
    if (-not (Test-Path "node_modules")) { Invoke-Native { npm ci } "npm ci failed" }
    Invoke-Native { npm run build } "Web build failed"
    Invoke-Native { npx cap sync android } "cap sync failed"
} finally { Pop-Location }

Push-Location (Join-Path $root "android")
try {
    Invoke-Native { .\gradlew.bat assembleRelease } "Gradle build failed"
} finally { Pop-Location }

$signed = Test-Path (Join-Path $root "android\keystore.properties")
$apk = Get-ChildItem (Join-Path $root "android\app\build\outputs\apk\release") -Filter "*.apk" | Select-Object -First 1
if (-not $apk) { throw "No APK was produced." }

$outDir = Join-Path $root "artifacts"
New-Item -ItemType Directory -Force $outDir | Out-Null
$name = if ($signed) { "MacroGrid-$version.apk" } else { "MacroGrid-$version-unsigned.apk" }
Copy-Item $apk.FullName (Join-Path $outDir $name) -Force
$outFile = Join-Path $outDir $name
Write-Host "Done: $outFile"
if (-not $signed) { Write-Warning "Unsigned APK: a phone will not install it. Create a keystore first, see docs/release.md."; return }

# Checks before the file is uploaded to a release (see docs/release.md): the signer, versionName and versionCode.
# The newest build-tools folder that actually holds the tools (an interrupted install leaves an empty one).
$buildTools = Get-ChildItem (Join-Path $env:ANDROID_HOME "build-tools") |
    Where-Object { (Test-Path (Join-Path $_.FullName "apksigner.bat")) -and (Test-Path (Join-Path $_.FullName "aapt.exe")) } |
    Sort-Object { [version]($_.Name -replace '[^\d.].*$', '') } | Select-Object -Last 1
if (-not $buildTools) { throw "No Android build-tools with apksigner and aapt found under $env:ANDROID_HOME." }
$signerOutput = & (Join-Path $buildTools.FullName "apksigner.bat") verify --print-certs $outFile
if ($LASTEXITCODE) { throw "apksigner verify failed" }
$fingerprint = ($signerOutput | Select-String "SHA-256 digest: ([0-9a-f]{64})").Matches[0].Groups[1].Value
if ($fingerprint -ne $ReleaseCertificateSha256) {
    throw "The APK is signed with certificate $fingerprint, not the release certificate $ReleaseCertificateSha256. Do not upload it."
}
$badging = (& (Join-Path $buildTools.FullName "aapt.exe") dump badging $outFile | Select-String "^package:").Line
$expectedCode = ([int]$version.Split('.')[0]) * 10000 + ([int]$version.Split('.')[1]) * 100 + [int]$version.Split('.')[2]
if ($badging -notmatch "versionName='$([regex]::Escape($version))'" -or $badging -notmatch "versionCode='$expectedCode'") {
    throw "Unexpected version in the APK: $badging (expected $version, code $expectedCode)."
}
Write-Host "Verified: release certificate $fingerprint, version $version, versionCode $expectedCode."
