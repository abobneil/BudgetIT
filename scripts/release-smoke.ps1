Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Running packaged smoke checks..."

$packageJson = Get-Content -Raw "package.json" | ConvertFrom-Json
$version = [string]$packageJson.version
if ([string]::IsNullOrWhiteSpace($version)) {
  throw "package.json version is missing or invalid."
}

$requiredArtifacts = @(
  "dist/release/BudgetIT-Setup-$version-x64.exe",
  "dist/release/BudgetIT-Setup-$version-arm64.exe"
)

foreach ($artifactPath in $requiredArtifacts) {
  if (-not (Test-Path $artifactPath)) {
    throw "Expected installer artifact missing: $artifactPath"
  }
}

$requiredDocs = @(
  "docs/release-hardening.md",
  "docs/operations-runbook.md"
)

foreach ($docPath in $requiredDocs) {
  if (-not (Test-Path $docPath)) {
    throw "Required release doc missing: $docPath"
  }
}

$releaseDoc = Get-Content -Raw "docs/release-hardening.md"
$runbookDoc = Get-Content -Raw "docs/operations-runbook.md"

$releaseRequiredSections = @(
  "## Packaging QA",
  "## Startup Defaults and Overrides",
  "## Rollback Notes"
)

foreach ($section in $releaseRequiredSections) {
  if (-not $releaseDoc.Contains($section)) {
    throw "Missing section in docs/release-hardening.md: $section"
  }
}

$runbookRequiredSections = @(
  "## Backup",
  "## Recovery Key",
  "## Restore",
  "## Rollback Dry-Run"
)

foreach ($section in $runbookRequiredSections) {
  if (-not $runbookDoc.Contains($section)) {
    throw "Missing section in docs/operations-runbook.md: $section"
  }
}

Write-Host "Packaged smoke checks passed."
