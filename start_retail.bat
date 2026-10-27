@echo off
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
set "BACKEND_PORT=8001"
set "FRONTEND_PORT=3000"

:: ---- Refuse to disturb apps already using either port ----
powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) { Write-Error 'Cannot inspect listening ports'; exit 2 }; $ports = @(%BACKEND_PORT%,%FRONTEND_PORT%); $listeners = Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $ports -contains $_.LocalPort }; if ($listeners) { $listeners | ForEach-Object { $owner = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; [pscustomobject]@{ LocalAddress=$_.LocalAddress; LocalPort=$_.LocalPort; Process=if($owner){$owner.ProcessName}else{'(unknown)'}; PID=$_.OwningProcess } } | Format-Table -AutoSize; exit 1 }"
if errorlevel 1 (
    echo [ERROR] A required port is occupied, or could not be checked. No processes were stopped; identify the owner before proceeding.
    pause
    exit /b 1
)

:: ---- Self-elevate only if firewall rules are missing ----
:: Check if both firewall rules already exist before demanding admin
netsh advfirewall firewall show rule name="Retail App Port %BACKEND_PORT%" >nul 2>&1
set "BACKEND_RULE_MISSING=%errorlevel%"
netsh advfirewall firewall show rule name="Retail App Port %FRONTEND_PORT%" >nul 2>&1
set "FRONTEND_RULE_MISSING=%errorlevel%"

if %BACKEND_RULE_MISSING% neq 0 goto :need_elevation
if %FRONTEND_RULE_MISSING% neq 0 goto :need_elevation
goto :rules_ok

:need_elevation
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:rules_ok
set "PYTHON=%ROOT%backend\venv\Scripts\python.exe"

:: Check if backend venv exists, fallback to system python
if not exist "%PYTHON%" (
    echo [WARN] Virtual environment not found at %PYTHON%
    set "PYTHON=py"
)

:: ---- Ensure JWT_SECRET_KEY and host metadata in .env ----
set "ENV_FILE=%ROOT%backend\.env"
if not exist "%ENV_FILE%" (
    powershell -Command "$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); $key = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''; $content = @('MONGO_URL=mongodb://localhost:27017','DB_NAME=retail_book','DEBUG=false','STATIC_IPS=59.144.172.176','JWT_SECRET_KEY=' + $key) -join [Environment]::NewLine; [System.IO.File]::WriteAllText('%ENV_FILE%', $content, [System.Text.UTF8Encoding]::new($false))"
    echo [INFO] Created backend\.env with new default values.
) else (
    findstr /i "JWT_SECRET_KEY" "%ENV_FILE%" >nul 2>&1
    if errorlevel 1 (
        powershell -Command "$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); $key = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''; Add-Content -Path '%ENV_FILE%' -Value \"JWT_SECRET_KEY=$key\""
        echo [INFO] Added JWT_SECRET_KEY to .env.
    )
    findstr /i "MONGO_URL" "%ENV_FILE%" >nul 2>&1
    if errorlevel 1 (
        echo [INFO] Added MONGO_URL to .env.
        echo MONGO_URL=mongodb://localhost:27017>> "%ENV_FILE%"
    )
    findstr /i "DB_NAME" "%ENV_FILE%" >nul 2>&1
    if errorlevel 1 (
        echo [INFO] Added DB_NAME to .env.
        echo DB_NAME=retail_book>> "%ENV_FILE%"
    )
    findstr /i "STATIC_IPS" "%ENV_FILE%" >nul 2>&1
    if errorlevel 1 (
        echo [INFO] Added STATIC_IPS to .env.
        echo STATIC_IPS=59.144.172.176>> "%ENV_FILE%"
    )
)

set "STATIC_IP_CONFIG="
for /f "delims=" %%g in ('powershell -NoProfile -Command "$p='%ENV_FILE%'; if (Test-Path $p) { $m = [regex]::Match((Get-Content $p -Raw), '(?m)^STATIC_IPS=([^\r\n]*)'); if ($m.Success) { $m.Groups[1].Value.Trim() } }"') do set "STATIC_IP_CONFIG=%%g"
if defined STATIC_IP_CONFIG set "STATIC_IP=%STATIC_IP_CONFIG%"
if not defined STATIC_IP set "STATIC_IP=59.144.172.176"

powershell -NoProfile -Command "$path='%ENV_FILE%'; $ips = @('localhost','127.0.0.1') + ((Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -and $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.' } | Select-Object -ExpandProperty IPAddress) | Select-Object -Unique); $publicIp = $env:STATIC_IP; if (-not $publicIp) { $publicIp = (Get-Content $path -Raw | Select-String -Pattern '^STATIC_IPS=' -SimpleMatch -CaseSensitive -AllMatches -ErrorAction SilentlyContinue | ForEach-Object { $_.Line.Split('=',2)[1].Trim() } | Select-Object -First 1); }; $hostList = ($ips | Where-Object { $_ -and $_.Trim() } | Select-Object -Unique) -join ','; $patternA = '(?m)^APP_HOSTS=.*'; $patternB = '(?m)^STATIC_IPS=.*'; $patternC = '(?m)^CORS_ORIGINS=.*'; $content = if (Test-Path $path) { Get-Content $path -Raw } else { '' }; $cors = 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000'; foreach ($ip in $ips) { if ($ip -and $ip -notmatch '^(localhost|127\.0\.0\.1)$') { $cors += ',https://' + $ip + ':3000,https://' + $ip + ':8001' } }; if ($publicIp) { $cors += ',https://' + $publicIp + ':3000,https://' + $publicIp + ':8001' }; if ($content -match $patternA) { $content = [regex]::Replace($content, $patternA, 'APP_HOSTS=' + $hostList) } elseif ($content.Trim().Length -gt 0) { $content += [Environment]::NewLine + 'APP_HOSTS=' + $hostList } else { $content = 'APP_HOSTS=' + $hostList }; if ($content -match $patternB) { $content = [regex]::Replace($content, $patternB, 'STATIC_IPS=' + $publicIp) } else { $content += [Environment]::NewLine + 'STATIC_IPS=' + $publicIp }; if ($content -match $patternC) { $content = [regex]::Replace($content, $patternC, 'CORS_ORIGINS=' + $cors) } else { $content += [Environment]::NewLine + 'CORS_ORIGINS=' + $cors }; Set-Content -Path $path -Value $content -Encoding UTF8;"

:: ---- Ensure Firewall rules ----
netsh advfirewall firewall show rule name="Retail App Port %BACKEND_PORT%" >nul 2>&1
if errorlevel 1 (
    netsh advfirewall firewall add rule name="Retail App Port %BACKEND_PORT%" dir=in action=allow protocol=TCP localport=%BACKEND_PORT% >nul 2>&1
    if not errorlevel 1 echo [INFO] Firewall rule added for port %BACKEND_PORT%.
)
netsh advfirewall firewall show rule name="Retail App Port %FRONTEND_PORT%" >nul 2>&1
if errorlevel 1 (
    netsh advfirewall firewall add rule name="Retail App Port %FRONTEND_PORT%" dir=in action=allow protocol=TCP localport=%FRONTEND_PORT% >nul 2>&1
    if not errorlevel 1 echo [INFO] Firewall rule added for port %FRONTEND_PORT%.
)

:: ---- Detect local IP ----
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set "IP=%%a"
    set "IP=!IP: =!"
    goto :found_ip
)
:found_ip
if "!IP!"=="" set "IP=127.0.0.1"

set "STATIC_URL="
for /f "delims=" %%g in ('powershell -NoProfile -Command "$p='%ENV_FILE%'; if (Test-Path $p) { $content = Get-Content $p -Raw; if ($content -match '(?m)^STATIC_IPS=(.+)$') { $Matches[1].Trim() } }"') do set "STATIC_URL=%%g"
(
    echo Retail access URLs
    echo.
    echo LAN / same Wi-Fi: https://!IP!:%FRONTEND_PORT%/
    echo LAN API: https://!IP!:%BACKEND_PORT%/
    if not "!STATIC_URL!"=="" (
        echo Public / static IP: https://!STATIC_URL!:%FRONTEND_PORT%/
        echo Public API: https://!STATIC_URL!:%BACKEND_PORT%/
    ) else (
        echo Public / static IP: not configured yet
        echo Public API: not configured yet
    )
) > "%ROOT%backend\network_urls.txt"

echo [INFO] Saved access URLs to %ROOT%backend\network_urls.txt

:start_backend
echo [INFO] Regenerating SSL certificate for current IP...
"%PYTHON%" "%ROOT%backend\gen_cert.py"
echo [INFO] Starting FastAPI backend on https://!IP!:%BACKEND_PORT% ...
(
    echo @echo off
    echo cd /d "%ROOT%backend"
    echo set DEBUG=false
    echo "%PYTHON%" -m uvicorn server:app --host 0.0.0.0 --port %BACKEND_PORT% --reload --ssl-keyfile ssl.key --ssl-certfile ssl.crt
) > "%TEMP%\retail_backend.bat"
start "FastAPI Server" cmd /k "%TEMP%\retail_backend.bat"

echo [INFO] Waiting for backend to start...
timeout /t 5 /nobreak >nul
echo [INFO] Backend ready!

:start_frontend
echo [INFO] Ensuring frontend dependencies are up to date...
cd /d "%ROOT%frontend"
call yarn install --frozen-lockfile
echo [INFO] Starting React frontend...
"%PYTHON%" "%ROOT%backend\write_launcher.py" "%TEMP%\retail_frontend.bat" "%ROOT%frontend"
start "React Frontend" cmd /k "%TEMP%\retail_frontend.bat"

echo [INFO] Waiting for frontend to start...
timeout /t 8 /nobreak >nul
echo [INFO] Opening browser...
start "" "https://!IP!:%BACKEND_PORT%/api/"
timeout /t 2 /nobreak >nul
start "" "https://!IP!:%FRONTEND_PORT%/"
echo.
echo ==========================================
echo  Retail App Started!
echo  Local LAN URL:   https://!IP!:%FRONTEND_PORT%/
echo  Local API URL:   https://!IP!:%BACKEND_PORT%/
if not "!STATIC_URL!"=="" (
    echo  Public URL:      https://!STATIC_URL!:%FRONTEND_PORT%/
    echo  Public API:      https://!STATIC_URL!:%BACKEND_PORT%/
) else (
    echo  Public URL:      not configured yet
    echo  Public API:      not configured yet
)
echo  NOTE: Accept BOTH certificate warnings in browser
echo  Open these URLs on phone/tablet using the same Wi-Fi, or the configured public IP if exposed
echo ==========================================
echo.
echo  Press any key to close this window...
pause >nul
endlocal