# create_review_zip.ps1
# Creates a clean review zip using git archive, which strictly respects .gitignore.
# Secrets (.env, ssl.key, ssl.crt, server.log, uploads) are NEVER included.
#
# Usage:
#   .\create_review_zip.ps1
#   .\create_review_zip.ps1 -OutDir "C:\Temp"

param(
    [string]$OutDir = (Split-Path $PSScriptRoot -Parent)
)

$repoRoot = $PSScriptRoot
$date     = Get-Date -Format "MMMdd_yyyy"
$zipName  = "Retail_Review_$date.zip"
$zipPath  = Join-Path $OutDir $zipName

# Delete previous review zips in the output directory
Get-ChildItem -Path $OutDir -Filter "Retail_Review_*.zip" -File | Remove-Item -Force
Write-Host "Removed old review zip files from $OutDir"

# Use git archive — only includes committed, tracked, non-gitignored files
$gitArgs = @("archive", "--format=zip", "--prefix=Retail/", "-o", $zipPath, "HEAD")
Write-Host "Running: git $($gitArgs -join ' ')"

Push-Location $repoRoot
try {
    & git @gitArgs
    if ($LASTEXITCODE -ne 0) { throw "git archive failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}

$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "Created: $zipPath  ($sizeMB MB)"
Write-Host "This zip contains only committed source files — no secrets, no node_modules."
