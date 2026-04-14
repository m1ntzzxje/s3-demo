@echo off
setlocal
title ESoft S3 Demo Manager

echo ======================================================
echo    ESoft S3 Hybrid Backup Demo - Master Launcher
echo ======================================================
echo.

:: 1. Start MinIO in a new window
echo [1/3] Launching MinIO Storage Server...
start "ESoft S3 - MinIO Storage" cmd /c "cd /d %~dp0minio && start_minio.bat"

:: 2. Start Python Backend in a new window
echo [2/3] Launching Python FastAPI Backend...
start "ESoft S3 - Python API" cmd /c "cd /d %~dp0server && .venv\Scripts\python -m uvicorn main:app --port 3000"

:: 3. Start React Frontend in a new window
echo [3/3] Launching React Dashboard UI...
start "ESoft S3 - React Frontend" cmd /c "cd /d %~dp0client && npm run dev"

echo.
echo ======================================================
echo    SERVICES ARE STARTING UP
echo ======================================================
echo  - Dashboard: http://localhost:5173
echo  - S3 API:    http://localhost:3000
echo  - MinIO GUI: http://localhost:9001
echo ======================================================
echo.
echo Keep this window open or close it (the services will run in their own windows).
echo To stop everything, close the three individual windows.
echo.
pause
