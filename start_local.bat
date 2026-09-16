@echo off
echo ===================================================
echo   Starting VocalVerify Engine + Dashboard Locally
echo ===================================================

echo [1/2] Starting FastAPI Backend on port 8080...
start "VocalVerify FastAPI Backend (:8080)" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --host 0.0.0.0 --port 8080"

echo [2/2] Starting Next.js Dashboard on port 3000...
start "VocalVerify Next.js Dashboard (:3000)" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ===================================================
echo   Engine & Dashboard launched!
echo   Dashboard URL: http://localhost:3000
echo   FastAPI URL:   http://localhost:8080
echo.
echo   To connect your mobile app via ngrok tunnel:
echo   Run: ngrok http 8080
echo   Then copy the https://xxxx.ngrok-free.app URL into the mobile app!
echo ===================================================
pause
