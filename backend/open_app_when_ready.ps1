param(
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [Parameter(Mandatory = $true)]
    [string]$LogPath,
    [switch]$NoOpen
)

$ErrorActionPreference = "Stop"

function Write-LauncherLog {
    param([string]$Message)
    Add-Content -LiteralPath $LogPath -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
}

$healthUri = [System.UriBuilder]::new($Url)
$healthUri.Path = "health"
$healthUri.Query = ""
$lastError = "Health endpoint did not return HTTP 200."
$deadline = (Get-Date).AddMinutes(2)
$curl = Get-Command curl.exe -ErrorAction SilentlyContinue
if (-not $curl) {
    Write-LauncherLog "ERROR: curl.exe is unavailable; cannot safely check the self-signed HTTPS endpoint."
    exit 1
}

while ((Get-Date) -lt $deadline) {
    $curlOutput = & $curl.Source --insecure --silent --output NUL --write-out "%{http_code}" --max-time 5 $healthUri.Uri.AbsoluteUri
    $curlExitCode = $LASTEXITCODE
    $httpStatus = ($curlOutput -join "").Trim()
    if ($curlExitCode -eq 0 -and $httpStatus -eq "200") {
        Write-LauncherLog "Backend health check succeeded."
        if (-not $NoOpen) {
            try {
                Start-Process -FilePath $Url
                Write-LauncherLog "Opened app URL in the default browser."
            }
            catch {
                Write-LauncherLog "ERROR: Could not open the app in the default browser: $($_.Exception.Message)"
                exit 1
            }
        }
        exit 0
    }

    if ($curlExitCode -ne 0) {
        $lastError = "curl.exe exited with code $curlExitCode. $httpStatus"
    }
    else {
        $lastError = "Health endpoint returned HTTP $httpStatus."
    }
    Start-Sleep -Seconds 2
}

Write-LauncherLog "ERROR: Backend was not ready within two minutes. Last health-check result: $lastError"
exit 1
