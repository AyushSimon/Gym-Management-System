@echo off
setlocal
title Gym Management System - launcher
cd /d "%~dp0"
if errorlevel 1 (
    echo [error] Could not open the project folder: %~dp0
    pause
    exit /b 1
)

echo === Gym Management System ===
echo [check] Checking required tools...

where python >nul 2>nul
if errorlevel 1 (
    echo [error] Python 3.11+ was not found on PATH. Install Python and retry.
    pause
    exit /b 1
)
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)"
if errorlevel 1 (
    echo [error] Python 3.11 or newer is required.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [error] Node.js 18+ was not found on PATH. Install Node.js and retry.
    pause
    exit /b 1
)
for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR (
    echo [error] Could not determine the installed Node.js version.
    pause
    exit /b 1
)
if %NODE_MAJOR% LSS 18 (
    echo [error] Node.js 18 or newer is required.
    pause
    exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
    echo [error] npm was not found on PATH. Repair or reinstall Node.js and retry.
    pause
    exit /b 1
)

if not exist "backend\requirements.txt" (
    echo [error] Backend requirements were not found. Run this file from the project folder.
    pause
    exit /b 1
)
if not exist "frontend\package.json" (
    echo [error] Frontend package.json was not found. Run this file from the project folder.
    pause
    exit /b 1
)

if not exist "backend\.venv\Scripts\python.exe" (
    echo [setup] Creating the backend virtual environment...
    python -m venv "backend\.venv"
    if errorlevel 1 (
        echo [error] Could not create the backend virtual environment.
        pause
        exit /b 1
    )
)

echo [setup] Checking and installing backend dependencies...
"backend\.venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
if errorlevel 1 (
    echo [error] Backend dependency installation failed. Check your internet connection and try again.
    pause
    exit /b 1
)

echo [setup] Checking and installing frontend dependencies...
pushd "frontend"
call npm install --no-audit --no-fund
if errorlevel 1 (
    popd
    echo [error] Frontend dependency installation failed. Check your internet connection and try again.
    pause
    exit /b 1
)
popd

echo [check] Finding free local ports...
for /f "delims=" %%P in ('python -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()"') do set "BACKEND_PORT=%%P"
for /f "delims=" %%P in ('python -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()"') do set "FRONTEND_PORT=%%P"
if not defined BACKEND_PORT (
    echo [error] Could not find an available port for the backend.
    pause
    exit /b 1
)
if not defined FRONTEND_PORT (
    echo [error] Could not find an available port for the frontend.
    pause
    exit /b 1
)
if "%BACKEND_PORT%"=="%FRONTEND_PORT%" (
    for /f "delims=" %%P in ('python -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()"') do set "FRONTEND_PORT=%%P"
)

echo [start] Backend  -^> http://127.0.0.1:%BACKEND_PORT%  (API docs: http://127.0.0.1:%BACKEND_PORT%/docs)
start "Gym Backend" /D "%~dp0backend" cmd /k "set GYM_CORS_ORIGINS=http://127.0.0.1:%FRONTEND_PORT%&& .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port %BACKEND_PORT%"

echo [wait] Waiting for the backend health check...
powershell -NoProfile -Command "$ready = $false; for ($i = 0; $i -lt 40; $i++) { try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:%BACKEND_PORT%/api/health' -TimeoutSec 2; if ($health.status -eq 'ok') { $ready = $true; break } } catch { }; Start-Sleep -Milliseconds 750 }; if (-not $ready) { exit 1 }"
if errorlevel 1 (
    echo [error] The backend did not become healthy. Check the Gym Backend window for details.
    pause
    exit /b 1
)
echo [ready] Backend health check passed.

echo [start] Frontend -^> http://127.0.0.1:%FRONTEND_PORT%
start "Gym Frontend" /D "%~dp0frontend" cmd /k "set VITE_API_BASE_URL=http://127.0.0.1:%BACKEND_PORT%&& npm run dev -- --host 127.0.0.1 --port %FRONTEND_PORT% --strictPort"

echo [wait] Waiting for the frontend...
powershell -NoProfile -Command "$ready = $false; for ($i = 0; $i -lt 40; $i++) { try { $page = Invoke-WebRequest -Uri 'http://127.0.0.1:%FRONTEND_PORT%' -TimeoutSec 2 -UseBasicParsing; if ($page.StatusCode -eq 200) { $ready = $true; break } } catch { }; Start-Sleep -Milliseconds 750 }; if (-not $ready) { exit 1 }"
if errorlevel 1 (
    echo [error] The frontend did not become ready. Check the Gym Frontend window for details.
    pause
    exit /b 1
)
echo [ready] Frontend is responding.
echo [ready] API base URL: http://127.0.0.1:%BACKEND_PORT%/api
echo [open] Opening the app in your browser...
start "" "http://127.0.0.1:%FRONTEND_PORT%"

echo.
echo The app is running. Close the Gym Backend and Gym Frontend windows to stop it.
endlocal
