@echo off
:: Minimal flags: support --force only to reinstall deps
set "FORCE_BUILD=0"
if "%~1"=="--force" set "FORCE_BUILD=1"
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
set "BACKEND_PORT=8001"
set "ENV_FILE=%ROOT%backend\.env"
set "LAUNCH_LOG=%ROOT%backend\launcher.log"
set "PYTHON=%ROOT%backend\venv\Scripts\python.exe"
> "%LAUNCH_LOG%" echo [%date% %time%] Launcher started. Arguments: %*

:: ---- Refuse to disturb an app already using the backend port ----
>> "%LAUNCH_LOG%" echo [%date% %time%] Checking port %BACKEND_PORT%.
powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) { Write-Error 'Cannot inspect listening ports'; exit 2 }; $port = %BACKEND_PORT%; $listeners = Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq $port }; if ($listeners) { $listeners | ForEach-Object { $owner = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; [pscustomobject]@{ LocalAddress=$_.LocalAddress; LocalPort=$_.LocalPort; Process=if($owner){$owner.ProcessName}else{'(unknown)'}; PID=$_.OwningProcess } } | Format-Table -AutoSize; exit 1 }"
set "PORT_CHECK_RESULT=%ERRORLEVEL%"
>> "%LAUNCH_LOG%" echo [%date% %time%] Port check exit code: %PORT_CHECK_RESULT%.
if not "%PORT_CHECK_RESULT%"=="0" (
    echo [ERROR] Backend port %BACKEND_PORT% is occupied, or could not be checked. No processes were stopped; identify the owner before proceeding.
    echo See log: %LAUNCH_LOG%
    >> "%LAUNCH_LOG%" echo [%date% %time%] ERROR: Port check failed.
    pause
    exit /b 1
)
echo [INFO] Port %BACKEND_PORT% is free.

if not exist "%PYTHON%" (
    echo [WARN] Virtual environment not found at %ROOT%backend\venv
    echo        Falling back to system Python. For isolated dependencies, run:
    echo          cd backend ^&^& python -m venv venv ^&^& venv\Scripts\activate ^&^& pip install -r requirements.txt
    set "PYTHON=py"
)

echo ==========================================
echo  Retail App - Production Build ^& Run
echo ==========================================
echo.
>> "%LAUNCH_LOG%" echo [%date% %time%] Starting environment configuration.

:: ---- Step 0: Ensure JWT_SECRET_KEY and host metadata exist in .env ----
if not exist "%ENV_FILE%" (
    echo [0/4] Creating backend\.env with default DB and security values...
    powershell -Command "$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); $key = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''; $content = @('MONGO_URL=mongodb://localhost:27017','DB_NAME=retail_book','DEBUG=false','STATIC_IPS=59.144.172.176','JWT_SECRET_KEY=' + $key) -join [Environment]::NewLine; [System.IO.File]::WriteAllText('%ENV_FILE%', $content, [System.Text.UTF8Encoding]::new($false))"
    echo [0/4] .env created.
) else (
    findstr /i "JWT_SECRET_KEY" "%ENV_FILE%" >nul 2>&1
    if errorlevel 1 (
        echo [0/4] Adding JWT_SECRET_KEY to existing .env...
        powershell -Command "$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); $key = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''; Add-Content -Path '%ENV_FILE%' -Value \"JWT_SECRET_KEY=$key\""
    ) else (
        echo [0/4] JWT_SECRET_KEY already set in .env. OK.
    )
    findstr /i "MONGO_URL" "%ENV_FILE%" >nul 2>&1
    if errorlevel 1 (
        echo [0/4] Adding MongoDB URL to .env...
        echo MONGO_URL=mongodb://localhost:27017>> "%ENV_FILE%"
    )
    findstr /i "DB_NAME" "%ENV_FILE%" >nul 2>&1
    if errorlevel 1 (
        echo [0/4] Adding database name to .env...
        echo DB_NAME=retail_book>> "%ENV_FILE%"
    )
    findstr /i "STATIC_IPS" "%ENV_FILE%" >nul 2>&1
    if errorlevel 1 (
        echo [0/4] Adding static IP to .env...
        echo STATIC_IPS=59.144.172.176>> "%ENV_FILE%"
    )
)

set "STATIC_IP_CONFIG="
for /f "delims=" %%g in ('powershell -NoProfile -Command "$p='%ENV_FILE%'; if (Test-Path $p) { $m = [regex]::Match((Get-Content $p -Raw), '(?m)^STATIC_IPS=([^\r\n]*)'); if ($m.Success) { $m.Groups[1].Value.Trim() } }"') do set "STATIC_IP_CONFIG=%%g"
if defined STATIC_IP_CONFIG set "STATIC_IP=%STATIC_IP_CONFIG%"
if not defined STATIC_IP set "STATIC_IP=59.144.172.176"
>> "%LAUNCH_LOG%" echo [%date% %time%] Static host configuration resolved.

powershell -NoProfile -Command "$path='%ENV_FILE%'; $ips = @('localhost','127.0.0.1') + ((Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -and $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.' } | Select-Object -ExpandProperty IPAddress) | Select-Object -Unique); $publicIp = $env:STATIC_IP; if (-not $publicIp) { $publicIp = (Get-Content $path -Raw | Select-String -Pattern '^STATIC_IPS=' -SimpleMatch -CaseSensitive -AllMatches -ErrorAction SilentlyContinue | ForEach-Object { $_.Line.Split('=',2)[1].Trim() } | Select-Object -First 1); }; $hostList = ($ips | Where-Object { $_ -and $_.Trim() } | Select-Object -Unique) -join ','; $patternA = '(?m)^APP_HOSTS=.*'; $patternB = '(?m)^STATIC_IPS=.*'; $patternC = '(?m)^CORS_ORIGINS=.*'; $content = if (Test-Path $path) { Get-Content $path -Raw } else { '' }; $cors = 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000'; foreach ($ip in $ips) { if ($ip -and $ip -notmatch '^(localhost|127\.0\.0\.1)$') { $cors += ',https://' + $ip + ':3000,https://' + $ip + ':8001' } }; if ($publicIp) { $cors += ',https://' + $publicIp + ':3000,https://' + $publicIp + ':8001' }; if ($content -match $patternA) { $content = [regex]::Replace($content, $patternA, 'APP_HOSTS=' + $hostList) } elseif ($content.Trim().Length -gt 0) { $content += [Environment]::NewLine + 'APP_HOSTS=' + $hostList } else { $content = 'APP_HOSTS=' + $hostList }; if ($content -match $patternB) { $content = [regex]::Replace($content, $patternB, 'STATIC_IPS=' + $publicIp) } else { $content += [Environment]::NewLine + 'STATIC_IPS=' + $publicIp }; if ($content -match $patternC) { $content = [regex]::Replace($content, $patternC, 'CORS_ORIGINS=' + $cors) } else { $content += [Environment]::NewLine + 'CORS_ORIGINS=' + $cors }; Set-Content -Path $path -Value $content -Encoding UTF8;"
if errorlevel 1 (
    echo [ERROR] Could not update backend network configuration.
    echo See log: %LAUNCH_LOG%
    >> "%LAUNCH_LOG%" echo [%date% %time%] ERROR: Network configuration update failed.
    pause
    exit /b 1
)
>> "%LAUNCH_LOG%" echo [%date% %time%] Backend network configuration updated.
echo.

:: ---- Detect the LAN IP without FOR /F command parsing ----
>> "%LAUNCH_LOG%" echo [%date% %time%] Detecting the LAN IP.
set "IP_FILE=%TEMP%\retail-app-ip-%RANDOM%.txt"
powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop | Where-Object { $_.NextHop -and $_.NextHop -ne '0.0.0.0' -and $_.InterfaceAlias -notmatch 'VirtualBox|VMware|vEthernet|WSL|Docker|Hyper-V' } | Sort-Object RouteMetric | Select-Object -First 1; $ip = $null; if ($route) { $ip = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction Stop | Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.' } | Select-Object -First 1 -ExpandProperty IPAddress }; if (-not $ip) { $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop | Where-Object { $_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)' -and $_.IPAddress -notmatch '^192\.168\.56\.' } | Select-Object -First 1 -ExpandProperty IPAddress }; if (-not $ip) { throw 'No usable LAN IPv4 address was found' }; Write-Output $ip" > "%IP_FILE%" 2>> "%LAUNCH_LOG%"
set "IP_RESULT=%ERRORLEVEL%"
if not "%IP_RESULT%"=="0" (
    echo [ERROR] Could not detect the LAN IP address. See %LAUNCH_LOG%
    >> "%LAUNCH_LOG%" echo [%date% %time%] ERROR: LAN IP detection failed with exit code %IP_RESULT%.
    if exist "%IP_FILE%" del /f /q "%IP_FILE%" >nul 2>&1
    pause
    exit /b 1
)
set "IP="
set /p "IP="<"%IP_FILE%"
del /f /q "%IP_FILE%" >nul 2>&1
if not defined IP (
    echo [ERROR] LAN IP detection returned an empty address. See %LAUNCH_LOG%
    >> "%LAUNCH_LOG%" echo [%date% %time%] ERROR: LAN IP detection returned no address.
    pause
    exit /b 1
)
set "STATIC_URL=%STATIC_IP%"
>> "%LAUNCH_LOG%" echo [%date% %time%] LAN IP detection succeeded.
(
    echo Retail access URLs
    echo.
    echo LAN / same Wi-Fi: https://!IP!:%BACKEND_PORT%/
    if not "!STATIC_URL!"=="" (
        echo Public URL - router must forward TCP %BACKEND_PORT%: https://!STATIC_URL!:%BACKEND_PORT%/
    ) else (
        echo Public URL: not configured
    )
) > "%ROOT%backend\network_urls.txt"

>> "%LAUNCH_LOG%" echo [%date% %time%] Network URLs written.
echo [INFO] Saved access URLs to %ROOT%backend\network_urls.txt

goto :ip_done

:ip_done

:: ---- Step 1: Windows Firewall rule ----
echo [1/4] Configuring Windows Firewall for port %BACKEND_PORT%...
>> "%LAUNCH_LOG%" echo [%date% %time%] Checking Windows Firewall rule.
netsh advfirewall firewall show rule name="Retail App Port %BACKEND_PORT%" >nul 2>&1
set "FIREWALL_CHECK_RESULT=%ERRORLEVEL%"
>> "%LAUNCH_LOG%" echo [%date% %time%] Firewall rule query exit code: %FIREWALL_CHECK_RESULT%.
if not "%FIREWALL_CHECK_RESULT%"=="0" (
    netsh advfirewall firewall add rule name="Retail App Port %BACKEND_PORT%" dir=in action=allow protocol=TCP localport=%BACKEND_PORT% >nul 2>&1
    set "FIREWALL_ADD_RESULT=!ERRORLEVEL!"
    >> "%LAUNCH_LOG%" echo [%date% %time%] Firewall rule add exit code: %FIREWALL_ADD_RESULT%.
    if not "!FIREWALL_ADD_RESULT!"=="0" (
        echo [WARN] Could not add firewall rule - run as Administrator for internet access.
    ) else (
        echo [1/4] Firewall rule added - port %BACKEND_PORT% now open.
    )
) else (
    echo [1/4] Firewall rule already exists. OK.
)
echo.

:: ---- Step 2: Build React Frontend ----
echo [2/4] Building React frontend for production...
>> "%LAUNCH_LOG%" echo [%date% %time%] Entering frontend build stage.
cd /d "%ROOT%frontend"
if errorlevel 1 (
    echo [ERROR] Could not enter the frontend directory: %ROOT%frontend
    >> "%LAUNCH_LOG%" echo [%date% %time%] ERROR: Frontend directory not found.
    pause
    exit /b 1
)
set GENERATE_SOURCEMAP=false
:: Suppress Node.js deprecation warnings (fs.F_OK, url.parse, etc.)
set NODE_OPTIONS=--no-deprecation

:: Remove stale generated files so the app is rebuilt from a clean state.
if exist "build" rmdir /s /q "build"
if exist ".cache" rmdir /s /q ".cache"
if exist "coverage" rmdir /s /q "coverage"
if exist "%ROOT%frontend\build" rmdir /s /q "%ROOT%frontend\build"
if exist "%ROOT%frontend\.cache" rmdir /s /q "%ROOT%frontend\.cache"
if exist "%ROOT%frontend\coverage" rmdir /s /q "%ROOT%frontend\coverage"
:: NOTE: Do NOT delete backend/static/uploads - uploaded logos and files must persist

:: Install dependencies if node_modules missing or --force specified
if exist "node_modules" (
    if "%FORCE_BUILD%"=="1" (
        echo [2/4] Reinstall requested: --force
        echo [2/4] Installing dependencies...
        call yarn install
        if errorlevel 1 (
            echo [ERROR] Frontend dependency installation failed.
            >> "%LAUNCH_LOG%" echo [%date% %time%] ERROR: yarn install failed.
            pause
            exit /b 1
        )
    ) else (
        echo [2/4] node_modules found; skipping yarn install. Use --force to reinstall.
    )
) else (
    echo [2/4] Installing dependencies...
    call yarn install
    if errorlevel 1 (
        echo [ERROR] Frontend dependency installation failed.
        >> "%LAUNCH_LOG%" echo [%date% %time%] ERROR: yarn install failed.
        pause
        exit /b 1
    )
)

:: Check if build exists and is recent (within last hour)
set "REBUILD_NEEDED=1"
if "%FORCE_BUILD%"=="1" (
    echo [2/4] Force rebuild requested: --force
    set "REBUILD_NEEDED=1"
) else if exist "build" (
    for /f "delims=" %%a in ('powershell -Command "(Get-Item 'build' -ErrorAction SilentlyContinue).LastWriteTime"') do set "BUILD_TIME=%%a"
    for /f "delims=" %%a in ('powershell -Command "(Get-ChildItem 'src' -Recurse -ErrorAction SilentlyContinue ^| Sort-Object LastWriteTime -Descending ^| Select-Object -First 1).LastWriteTime"') do set "SRC_TIME=%%a"
    if defined BUILD_TIME if defined SRC_TIME (
        powershell -Command "if ([datetime]'!BUILD_TIME!' -gt [datetime]'!SRC_TIME!') { exit 0 } else { exit 1 }" >nul 2>&1
        if !errorlevel! equ 0 (
            echo [2/4] Build is up-to-date; skipping rebuild. Use --force to rebuild.
            set "REBUILD_NEEDED=0"
        )
    )
)

if "%REBUILD_NEEDED%"=="1" (
    :: Clear old builds to ensure a fresh state
    if exist "build" rmdir /s /q "build"
    if exist ".cache" rmdir /s /q ".cache"
    if exist "coverage" rmdir /s /q "coverage"
    echo [2/4] Running yarn build...
    call yarn build
    if errorlevel 1 (
        echo [ERROR] React build failed! Check npm errors above.
        pause
        exit /b 1
    )
)
echo [2/4] Build complete!
>> "%LAUNCH_LOG%" echo [%date% %time%] Frontend build stage complete.
echo [2/4] Build is served directly from frontend\build; no copy needed.
echo.

:: ---- Step 4: Check and start MongoDB ----
echo [4/5] Checking MongoDB service status...
>> "%LAUNCH_LOG%" echo [%date% %time%] Checking MongoDB service.
sc query MongoDB >nul 2>&1
if errorlevel 1 (
    echo [WARN] MongoDB service not found. Attempting to start MongoDB directly...
    start "" mongod --dbpath "C:\data\db" --logpath "C:\data\db\mongod.log" >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Could not start MongoDB. Please ensure MongoDB is installed and running.
        echo        You can start it manually: net start MongoDB
        pause
        exit /b 1
    )
    echo [4/5] MongoDB started directly.
) else (
    for /f "tokens=4" %%a in ('sc query MongoDB ^| findstr /i "STATE"') do set "MONGO_STATE=%%a"
    if "!MONGO_STATE!"=="RUNNING" (
        echo [4/5] MongoDB service is already running. OK.
    ) else (
        echo [4/5] MongoDB service state: !MONGO_STATE!
        echo [4/5] Starting MongoDB service...
        net start MongoDB >nul 2>&1
        if errorlevel 1 (
            echo [WARN] Failed to start MongoDB service. Attempting to continue anyway...
            echo        If backend fails to connect, start MongoDB manually: net start MongoDB
        ) else (
            echo [4/5] MongoDB service started.
        )
    )
)
echo Waiting for MongoDB to be ready...
timeout /t 3 /nobreak >nul
echo.

:: ---- Step 5: Regenerate SSL cert + Start backend ----
:: Remove stale generated backend artifacts so the environment starts clean.
if exist "%ROOT%backend\ssl.crt" del /f /q "%ROOT%backend\ssl.crt"
if exist "%ROOT%backend\ssl.key" del /f /q "%ROOT%backend\ssl.key"
for /r "%ROOT%backend" %%d in (__pycache__ .pytest_cache) do if exist "%%d" rmdir /s /q "%%d"
for /r "%ROOT%backend" %%f in (*.pyc *.pyo) do del /f /q "%%f"

:: Check if SSL cert exists and matches current IP
set "REGEN_CERT=1"
if exist "%ROOT%backend\ssl.crt" (
    for /f "delims=" %%a in ('powershell -Command "(certutil -dump '%ROOT%backend\ssl.crt' 2^>^&1 ^| Select-String 'CN=' ^| Select-Object -First 1) -replace '.*CN=([^,]+).*','$1'"') do set "CERT_IP=%%a"
    if "!CERT_IP!"=="!IP!" (
        echo [5/5] SSL certificate already matches current IP !IP!, skipping regeneration
        set "REGEN_CERT=0"
    )
)
if "%REGEN_CERT%"=="1" (
    echo [5/5] Regenerating SSL certificate for current IP !IP!...
    "%PYTHON%" "%ROOT%backend\gen_cert.py"
    if errorlevel 1 (
        echo [ERROR] SSL certificate generation failed.
        >> "%LAUNCH_LOG%" echo [%date% %time%] ERROR: SSL certificate generation failed.
        pause
        exit /b 1
    )
)
echo [5/5] Starting FastAPI production server on 0.0.0.0:%BACKEND_PORT%...
>> "%LAUNCH_LOG%" echo [%date% %time%] Starting backend server.
>> "%LAUNCH_LOG%" echo [%date% %time%] Printing access URLs.
echo.
echo ==========================================
echo  ACCESS URLs:
echo  LAN / same Wi-Fi:    https://!IP!:%BACKEND_PORT%/
if not "!STATIC_URL!"=="" (
    echo  Public URL - router must forward TCP %BACKEND_PORT%: https://!STATIC_URL!:%BACKEND_PORT%/
) else (
    echo  Public URL:        not configured
)
echo  NOTE: Accept the browser security warning for the self-signed certificate.
echo  Open the LAN URL on your phone/tablet while connected to the same Wi-Fi.
echo ==========================================
echo.
echo  API endpoints: /api/...
echo  Logs:          %ROOT%backend\server.log
echo  Health check:  https://!IP!:%BACKEND_PORT%/health
echo  Open the LAN URL above after the backend reports startup complete.
echo  Press Ctrl+C to stop the backend.
echo.

>> "%LAUNCH_LOG%" echo [%date% %time%] Access URLs printed; preparing backend command.
>> "%LAUNCH_LOG%" echo [%date% %time%] Changing to backend working directory.
cd /d "%ROOT%backend"
if errorlevel 1 (
    echo [ERROR] Could not enter the backend directory: %ROOT%backend
    >> "%LAUNCH_LOG%" echo [%date% %time%] ERROR: Backend directory not found.
    pause
    exit /b 1
)
>> "%LAUNCH_LOG%" echo [%date% %time%] Backend working directory ready.
set "DEBUG=false"
echo [INFO] Starting backend in this window. Uvicorn will print when startup is complete.
echo [INFO] This window stays open while the app is running. Open the LAN URL after the startup message appears.
echo [INFO] The default browser will open automatically after the backend health check succeeds.
>> "%LAUNCH_LOG%" echo [%date% %time%] Starting Uvicorn in the foreground with console output enabled.
start "" /b powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%backend\open_app_when_ready.ps1" -Url "https://!IP!:%BACKEND_PORT%/" -LogPath "%LAUNCH_LOG%"
set "BROWSER_WATCHER_RESULT=!ERRORLEVEL!"
if not "!BROWSER_WATCHER_RESULT!"=="0" (
    echo [WARN] Could not start the browser readiness check. Open the LAN URL manually.
    >> "%LAUNCH_LOG%" echo [%date% %time%] WARNING: Browser readiness checker failed to start.
) else (
    >> "%LAUNCH_LOG%" echo [%date% %time%] Browser readiness checker started.
)
"%PYTHON%" -m uvicorn server:app --host 0.0.0.0 --port %BACKEND_PORT% --ssl-keyfile ssl.key --ssl-certfile ssl.crt --log-level info
set "SERVER_EXIT_CODE=%ERRORLEVEL%"
echo [ERROR] Backend server exited with code %SERVER_EXIT_CODE%.
echo See log: %LAUNCH_LOG%
>> "%LAUNCH_LOG%" echo [%date% %time%] ERROR: Backend server exited with code %SERVER_EXIT_CODE%.

endlocal
pause