@echo off
setlocal
title Gym Management System - launcher
cd /d "%~dp0"

echo === Gym Management System ===

where python >nul 2>nul || (echo [error] Python was not found on PATH. Install Python 3.11+ and retry. & pause & exit /b 1)
where npm >nul 2>nul || (echo [error] Node.js / npm was not found on PATH. Install Node 18+ and retry. & pause & exit /b 1)

if not exist "backend\.venv\Scripts\python.exe" (
    echo [setup] Creating backend virtual environment...
    python -m venv "backend\.venv" || (echo [error] Could not create the virtual environment. & pause & exit /b 1)
    echo [setup] Installing backend dependencies...
    "backend\.venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt" || (echo [error] pip install failed. & pause & exit /b 1)
)

if not exist "frontend\node_modules" (
    echo [setup] Installing frontend dependencies...
    pushd frontend
    call npm install || (echo [error] npm install failed. & popd & pause & exit /b 1)
    popd
)

echo [start] Backend  -> http://localhost:8000  (API docs: http://localhost:8000/docs)
start "Gym Backend" /D "%~dp0backend" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

echo [start] Frontend -> http://localhost:5173
start "Gym Frontend" /D "%~dp0frontend" cmd /k "npm run dev"

echo Waiting for the servers to come up...
timeout /t 6 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Both servers are running in their own windows. Close those windows to stop them.
timeout /t 5 >nul
endlocal