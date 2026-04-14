@echo off
setlocal
title ESoft S3 - One Click Setup & Start
echo ======================================================
echo    ESoft S3 Hybrid Backup - AUTO INSTALLER & RUNNER
echo ======================================================
echo.

:: 1. Kiểm tra Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Python! Vui long cai Python truoc.
    pause
    exit /b
)
echo [OK] Da tim thay Python.

:: 2. Kiểm tra Node.js
npm -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay NodeJS/NPM! Vui long cai NodeJS truoc.
    pause
    exit /b
)
echo [OK] Da tim thay NodeJS.

echo.
echo ------------------------------------------------------
echo [1/3] DANG SETUP BACKEND (PYTHON)...
echo ------------------------------------------------------
cd /d %~dp0server
if not exist ".venv" (
    echo [+] Dang tao moi truong ao .venv...
    python -m venv .venv
)
echo [+] Dang cai dat thu vien Python...
.venv\Scripts\python -m pip install --upgrade pip >nul
.venv\Scripts\python -m pip install -r requirements.txt

echo.
echo ------------------------------------------------------
echo [2/3] DANG SETUP FRONTEND (REACT)...
echo ------------------------------------------------------
cd /d %~dp0client
if not exist "node_modules" (
    echo [+] Dang tai thu vien NPM (co the mat 1-2 phut)...
    call npm install
) else (
    echo [+] Thu vien NPM da san sang.
)

echo.
echo ------------------------------------------------------
echo [3/3] DANG KHOI DONG HE THONG...
echo ------------------------------------------------------
cd /d %~dp0
start "ESoft S3 - MinIO Storage" cmd /c "cd /d %~dp0minio && start_minio.bat"
start "ESoft S3 - Python API" cmd /c "cd /d %~dp0server && .venv\Scripts\python -m uvicorn main:app --port 3000"
start "ESoft S3 - React Frontend" cmd /c "cd /d %~dp0client && npm run dev"

echo.
echo ======================================================
echo    SETUP HOAN TAT! DANG MO TRANG WEB...
echo ======================================================
echo  - Dashboard: http://localhost:5173
echo  - API Docs:  http://localhost:3000/docs
echo.
echo Luu y: Hay dam bao Ban da bat MongoDB Server truoc khi dung.
echo ======================================================
timeout /t 5
start http://localhost:5173
pause
