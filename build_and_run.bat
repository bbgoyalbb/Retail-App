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

:: ---- Skip port check to avoid network profile changes ----
>> "%LAUNCH_LOG%" echo [%date% %time%] Port check skipped to preserve network stability.
echo [INFO] Port check skipped - if backend fails to start, check if port %BACKEND_PORT% is already in use.

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

:: Skip auto-configuration of .env to avoid network profile changes
>> "%LAUNCH_LOG%" echo [%date% %time%] Skipping auto-configuration to preserve network stability.
echo [INFO] Using existing .env configuration. Manual updates required if network changes.
echo.

:: ---- Detect local IP using simple ipconfig (avoids network profile changes) ----
set "IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set "TMP=%%a"
    set "TMP=!TMP: =!"
    call :check_ip_valid
    if not "!IP!"=="" goto :found_ip
)
:found_ip
if "!IP!"=="" set "IP=127.0.0.1"
goto :ip_done

:ip_done

:: ---- Step 1: Leave Windows Firewall alone ----
:: The launcher must not mutate the machine firewall profile because some Wi‑Fi
:: setups interpret that as a network policy change and interrupt normal internet access.
:: If the user wants the port opened, they can add it manually.
echo [1/4] Skipping firewall changes for port %BACKEND_PORT% to avoid disrupting normal Wi‑Fi access.
>> "%LAUNCH_LOG%" echo [%date% %time%] Firewall changes skipped intentionally to preserve network access.
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
    echo [2/4] Build exists, forcing rebuild to ensure latest changes
    set "REBUILD_NEEDED=1"
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

:: Always regenerate SSL cert to ensure it matches current network
echo [5/5] Regenerating SSL certificate for current IP !IP!...
"%PYTHON%" "%ROOT%backend\gen_cert.py"
if errorlevel 1 (
    echo [ERROR] SSL certificate generation failed.
    >> "%LAUNCH_LOG%" echo [%date% %time%] ERROR: SSL certificate generation failed.
    pause
    exit /b 1
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