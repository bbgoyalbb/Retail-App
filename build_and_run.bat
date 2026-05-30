@echo off
:: ---- Self-elevate to Administrator if not already ----
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
set "BACKEND_PORT=8001"
set "ENV_FILE=%ROOT%backend\.env"
set "PYTHON=%ROOT%backend\venv\Scripts\python.exe"

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

:: ---- Step 0: Ensure JWT_SECRET_KEY exists in .env ----
if not exist "%ENV_FILE%" (
    echo [0/4] Creating backend\.env with a new JWT_SECRET_KEY...
    powershell -Command "$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); $key = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''; Set-Content -Path '%ENV_FILE%' -Value \"JWT_SECRET_KEY=$key\""
    echo [0/4] .env created.
) else (
    findstr /i "JWT_SECRET_KEY" "%ENV_FILE%" >nul 2>&1
    if errorlevel 1 (
        echo [0/4] Adding JWT_SECRET_KEY to existing .env...
        powershell -Command "$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); $key = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''; Add-Content -Path '%ENV_FILE%' -Value \"JWT_SECRET_KEY=$key\""
    ) else (
        echo [0/4] JWT_SECRET_KEY already set in .env. OK.
    )
)
echo.

:: ---- Detect local IP: find the interface with a default gateway (real internet connection) ----
:: Skip virtual adapters (Hyper-V, VMware, VirtualBox, WSL, Docker)
set "IP="
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "(Get-NetRoute -DestinationPrefix '0.0.0.0/0' ^| Where-Object { $_.NextHop -and $_.NextHop -ne '0.0.0.0' -and $_.InterfaceAlias -notmatch '(VirtualBox|VMware|vEthernet|WSL|Docker|Hyper-V)' } ^| Select-Object -First 1 -ExpandProperty InterfaceIndex) ^| ForEach-Object { (Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $_ ^| Where-Object { $_.IPAddress -notmatch '^127\.' } ^| Select-Object -First 1 -ExpandProperty IPAddress) }"`) do (
    set "IP=%%i"
)
:: Fallback: any 192.168.x.x or 10.x.x.x address
if "!IP!"=="" (
    for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -match '^(192\.168\.|10\.)' -and $_.IPAddress -notmatch '^(192\.168\.56\.)' } ^| Select-Object -First 1 -ExpandProperty IPAddress"`) do (
        set "IP=%%i"
    )
)
:: Last resort: manual parse, skip 172.x, 169.254.x, 192.168.56.x
if "!IP!"=="" (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
        set "TMP=%%a"
        set "TMP=!TMP: =!"
        call :check_ip_valid
        if not "!IP!"=="" goto :found_ip
    )
)
:found_ip
if "!IP!"=="" set "IP=127.0.0.1"
goto :ip_done

:check_ip_valid
:: Check if TMP is a valid IP we want (skip 172.x, 169.254.x, 192.168.56.x)
set "VALID=1"
echo %TMP% | findstr /b "172." >nul && set "VALID=0"
if "%VALID%"=="0" goto :ip_check_end
echo %TMP% | findstr /b "169.254." >nul && set "VALID=0"
if "%VALID%"=="0" goto :ip_check_end
echo %TMP% | findstr /b "192.168.56." >nul && set "VALID=0"
if "%VALID%"=="0" goto :ip_check_end
if "%VALID%"=="1" set "IP=%TMP%"
:ip_check_end
goto :eof

:ip_done

:: ---- Step 1: Windows Firewall rule ----
echo [1/4] Configuring Windows Firewall for port %BACKEND_PORT%...
netsh advfirewall firewall show rule name="Retail App Port %BACKEND_PORT%" >nul 2>&1
if errorlevel 1 (
    netsh advfirewall firewall add rule name="Retail App Port %BACKEND_PORT%" dir=in action=allow protocol=TCP localport=%BACKEND_PORT% >nul 2>&1
    if errorlevel 1 (
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
cd /d "%ROOT%frontend"
set GENERATE_SOURCEMAP=false
:: Suppress Node.js deprecation warnings (fs.F_OK, url.parse, etc.)
set NODE_OPTIONS=--no-deprecation
:: Clear old builds to ensure a fresh state
if exist "build" rmdir /s /q "build"
call yarn install
call yarn build
if errorlevel 1 (
    echo [ERROR] React build failed! Check npm errors above.
    pause
    exit /b 1
)
echo [2/4] Build complete!
echo [2/4] Build is served directly from frontend\build (no copy needed)
echo.

:: ---- Step 3: Kill any existing backend process on port ----
echo [3/5] Checking for existing process on port %BACKEND_PORT%...
powershell -Command "$p = (Get-NetTCPConnection -LocalPort %BACKEND_PORT% -ErrorAction SilentlyContinue).OwningProcess; if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1 }"

:: ---- Step 4: Check and start MongoDB ----
echo [4/5] Checking MongoDB service status...
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
echo [5/5] Regenerating SSL certificate for current IP...
"%PYTHON%" "%ROOT%backend\gen_cert.py"
echo [5/5] Starting FastAPI production server on 0.0.0.0:%BACKEND_PORT%...
echo.
echo ==========================================
echo  ACCESS URLs:
echo  This PC:      https://!IP!:%BACKEND_PORT%/
echo  Network PC:   https://!IP!:%BACKEND_PORT%/
echo  Internet:     https://YOUR_STATIC_PUBLIC_IP:%BACKEND_PORT%/
echo  NOTE: Accept the security warning in browser (self-signed cert)
echo ==========================================
echo.
echo  API endpoints: /api/...
echo  Logs:          %ROOT%backend\server.log
echo  Health check:  https://!IP!:%BACKEND_PORT%/health
echo  Press Ctrl+C to stop.
echo.

cd /d "%ROOT%backend"
start "" "https://!IP!:%BACKEND_PORT%/"
"%PYTHON%" -m uvicorn server:app --host 0.0.0.0 --port %BACKEND_PORT% --ssl-keyfile ssl.key --ssl-certfile ssl.crt --log-level info

endlocal
pause