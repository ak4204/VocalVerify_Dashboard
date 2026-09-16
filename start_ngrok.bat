@echo off
echo ===================================================
echo   Starting ngrok Tunnel for VocalVerify Engine (:8080)
echo ===================================================
echo.
echo Checking ngrok...
where ngrok >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] ngrok is not found in your system PATH.
    echo Please install ngrok or add ngrok.exe to your PATH, or run:
    echo   winget install ngrok
    echo or download from https://ngrok.com/download
    echo.
    pause
    exit /b 1
)

echo Starting tunnel on port 8080...
echo 1. Copy the Forwarding URL (e.g. https://xxxx.ngrok-free.app)
echo 2. Open VocalVerify Call Guard APK on your phone
echo 3. Paste the URL into the endpoint field and tap "Save ngrok endpoint"
echo 4. Tap "Enable Call Guard"
echo.
ngrok http 8080
pause
