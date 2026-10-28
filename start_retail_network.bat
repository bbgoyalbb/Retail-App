@echo off
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
set "BACKEND_PORT=8001"
set "FRONTEND_PORT=3000"

:: ---- Skip port check to avoid network profile changes ----
echo [INFO] Port check skipped to preserve network stability

:: ---- Do not self-elevate or modify the machine firewall. Some Wi‑Fi profiles reject
::      the firewall changes that are made by this launcher, which can break general internet access.
set "ENV_FILE=%ROOT%backend\.env"
set "PYTHON=%ROOT%backend\venv\Scripts\python.exe"

if not exist "%PYTHON%" set "PYTHON=py"

:: ---- Ensure JWT_SECRET_KEY and host metadata in .env ----
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

:: Skip auto-configuration of .env to avoid network profile changes
echo [INFO] Using existing .env configuration. Manual updates required if network changes.

:: ---- Leave the machine firewall alone. If a user wants inbound access, let them
::      add the app ports manually rather than mutating the network profile.

echo [INFO] Windows Firewall remains unchanged; port access must be configured by the user if needed.

:: ---- Detect local IP ----
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set "IP=%%a"
    set "IP=!IP: =!"
    goto :found_ip
)
:found_ip
if "!IP!"=="" set "IP=127.0.0.1"

echo [INFO] Detected local IP: !IP!

:start_backend
echo Regenerating SSL certificate for current IP...
"%PYTHON%" "%ROOT%backend\gen_cert.py"
echo Starting backend on 0.0.0.0:%BACKEND_PORT%...
(
    echo @echo off
    echo cd /d "%ROOT%backend"
    echo set DEBUG=false
    echo "%PYTHON%" -m uvicorn server:app --host 0.0.0.0 --port %BACKEND_PORT% --reload --ssl-keyfile ssl.key --ssl-certfile ssl.crt
) > "%TEMP%\retail_backend.bat"
start "FastAPI Server" cmd /k "%TEMP%\retail_backend.bat"

echo Waiting for backend to start...
timeout /t 5 /nobreak >nul
echo Backend ready!

:start_frontend
echo Ensuring frontend dependencies are up to date...
cd /d "%ROOT%frontend"
call yarn install --frozen-lockfile
echo Starting frontend on 0.0.0.0:%FRONTEND_PORT%...
"%PYTHON%" "%ROOT%backend\write_launcher.py" "%TEMP%\retail_frontend.bat" "%ROOT%frontend"
start "React Frontend" cmd /k "%TEMP%\retail_frontend.bat"

echo Waiting for frontend to start...
timeout /t 8 /nobreak >nul
echo Opening browser - accept BOTH certificate warnings...
start "" "https://!IP!:%BACKEND_PORT%/api/"
timeout /t 2 /nobreak >nul
start "" "https://!IP!:%FRONTEND_PORT%/"
echo.
echo ==========================================
echo  LAN access:         https://!IP!:%FRONTEND_PORT%/
echo  LAN API:            https://!IP!:%BACKEND_PORT%/
echo  NOTE: Accept BOTH certificate warnings in browser (one-time per device)
echo  Open the LAN URL on phone/tablet while on the same Wi-Fi.
echo ==========================================
echo.
pause >nul
endlocal
