Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Running packaged smoke checks..."

$artifactFiles = @(Get-ChildItem -Path "dist/release" -File -Filter "*.exe" -ErrorAction SilentlyContinue)
if (-not $artifactFiles -or $artifactFiles.Count -eq 0) {
  throw "No Windows installer artifact found in dist/release."
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
