@echo off
setlocal enabledelayedexpansion
title ESoft S3 - One Click Setup ^& Start
echo ======================================================
echo    ESoft S3 Hybrid Backup - AUTO INSTALLER ^& RUNNER
echo ======================================================
echo.

:: 1. Kiem tra Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay Python! Vui long cai Python truoc.
    pause
    exit /b 1
)
echo [OK] Da tim thay Python.

:: 2. Kiem tra Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay NodeJS! Vui long cai NodeJS truoc.
    pause
    exit /b 1
)
echo [OK] Da tim thay NodeJS.

echo.
echo ------------------------------------------------------
echo [1/3] DANG SETUP BACKEND (PYTHON)...
echo ------------------------------------------------------
cd /d "%~dp0server"

if not exist ".venv\Scripts\python.exe" (
    echo [+] Dang tao moi truong ao .venv...
    python -m venv .venv
    if errorlevel 1 (
        echo [LOI] Khong the tao .venv. Kiem tra quyen truy cap thu muc.
        pause
        exit /b 1
    )
    echo [OK] Da tao .venv thanh cong.
) else (
    echo [OK] .venv da ton tai, bo qua buoc tao.
)

echo [+] Dang cap nhat pip va cai dat thu vien Python...
".venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
    echo [LOI] Cai dat thu vien Python that bai!
    pause
    exit /b 1
)
echo [OK] Cai dat thu vien Python hoan tat.

echo.
echo ------------------------------------------------------
echo [2/3] DANG SETUP FRONTEND (REACT)...
echo ------------------------------------------------------
cd /d "%~dp0client"

if not exist "node_modules" (
    echo [+] Dang tai thu vien NPM co the mat 1-2 phut...
    call npm install
    if errorlevel 1 (
        echo [LOI] npm install that bai!
        pause
        exit /b 1
    )
) else (
    echo [OK] Thu vien NPM da san sang.
)

echo.
echo ------------------------------------------------------
echo [3/3] DANG KHOI DONG HE THONG...
echo ------------------------------------------------------
cd /d "%~dp0"

echo [+] Khoi dong MinIO Storage...
start "ESoft - MinIO Storage" cmd /k "cd /d "%~dp0minio" && start_minio.bat"

echo [+] Khoi dong Python API (port 3000)...
start "ESoft - Python API" cmd /k "cd /d "%~dp0server" && .venv\Scripts\python.exe -m uvicorn main:app --port 3000 --reload"

echo [+] Khoi dong React Frontend (port 5173)...
start "ESoft - React Frontend" cmd /k "cd /d "%~dp0client" && npm run dev"

echo.
echo ======================================================
echo    SETUP HOAN TAT!
echo ======================================================
echo  - Dashboard :  http://localhost:5173
echo  - API Docs  :  http://localhost:3000/docs
echo.
echo CHU Y: Hay dam bao MongoDB Server da duoc bat truoc!
echo ======================================================
echo Cho 5 giay roi mo trinh duyet...
timeout /t 5 /nobreak >nul
start http://localhost:5173
echo.
echo Nhan phim bat ky de dong cua so nay (cac dich vu van chay o cua so rieng).
pause >nul
