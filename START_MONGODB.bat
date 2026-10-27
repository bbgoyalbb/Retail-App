@echo off
echo Starting MongoDB with D:\MongoDB\data...
if not exist "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" (
    echo [ERROR] MongoDB executable not found.
    pause
    exit /b 1
)
if not exist "D:\MongoDB\data" mkdir "D:\MongoDB\data"
powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; if (-not (Get-Command Get-CimInstance -ErrorAction SilentlyContinue)) { Write-Error 'Cannot inspect MongoDB processes'; exit 2 }; $processes = Get-CimInstance Win32_Process -Filter \"Name = 'mongod.exe'\"; if ($processes) { $processes | Select-Object ProcessId,ExecutablePath,CommandLine | Format-List; exit 1 }"
if errorlevel 1 (
    echo [ERROR] MongoDB is already running or its status could not be checked. Leaving it untouched.
    pause
    exit /b 1
)
start /B "" "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --dbpath "D:\MongoDB\data" --bind_ip 127.0.0.1
timeout /t 3 >nul
echo MongoDB started. You can now run your backend.
pause
