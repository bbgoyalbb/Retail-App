@echo off
echo Starting MongoDB with D:\MongoDB\data...
taskkill /F /IM mongod.exe 2>nul
timeout /t 2 >nul
start /B "" "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --dbpath "D:\MongoDB\data" --bind_ip 127.0.0.1
timeout /t 3 >nul
echo MongoDB started. You can now run your backend.
pause
