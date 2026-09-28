<#
.SYNOPSIS
  Prints the release notes of a client release: the section of docs/CHANGELOG.md for the version in the tag, plus a "works with Macro Grid" line and a fixed footer.

.DESCRIPTION
  The phone app's update screen shows the body of each GitHub release, so the body has to be the short public notes and not a placeholder.
  The tag "client-v0.2.0" is looked up as "## 0.2.0". When the changelog has no such section, a short pointer to the changelog is
  printed instead, so a draft is never empty. The footer (docs/release-notes-footer.md) is appended when the file exists.
#>
param(
    [Parameter(Mandatory = $true)] [string] $Tag,
    [string] $Changelog,
    [string] $Footer
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $Changelog) { $Changelog = Join-Path $root "docs\CHANGELOG.md" }

if ($Tag -notmatch '^client-v(\d+\.\d+\.\d+)') { throw "The tag '$Tag' is not a client release tag (client-vX.Y.Z)." }
$version = $Matches[1]

$lines = Get-Content $Changelog
$start = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^##\s+\[?$([regex]::Escape($version))\]?(\s|$)") { $start = $i + 1; break }
}

if ($start -lt 0) {
    $body = "See docs/CHANGELOG.md for what changed in $version."
} else {
    $section = @()
    for ($i = $start; $i -lt $lines.Count -and $lines[$i] -notmatch '^##\s'; $i++) { $section += $lines[$i] }
    $body = ($section -join "`n").Trim()
}

# Which Macro Grid the app needs comes from package.json ("macroGrid"), the same field the app checks at connect time.
$macroGrid = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).macroGrid
$body
if ($macroGrid) {
    ""
    "Works with Macro Grid $macroGrid or newer on your computer."
}
if ($Footer -and (Test-Path $Footer)) {
    ""
    "---"
    ""
    (Get-Content $Footer -Raw).Trim()
}
