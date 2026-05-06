@echo off
title ESoft S3 - Ngrok Multi-Tunnel
echo ======================================================
echo    ESoft S3 - Khoi dong Ngrok (Backend ^& Frontend)
echo ======================================================
echo.

:: Kiem tra file ngrok.exe
if not exist "ngrok.exe" (
    echo [LOI] Khong tim thay ngrok.exe trong thu muc goc!
    pause
    exit /b 1
)

echo [Buoc 1] Mo tunnel cho BACKEND (Port 3000)...
start "Ngrok Backend (3000)" cmd /c "ngrok http 3000"

echo [Buoc 2] Mo tunnel cho FRONTEND (Port 5173)...
start "Ngrok Frontend (5173)" cmd /c "ngrok http 5173"

echo.
echo ------------------------------------------------------
echo HUONG DAN LAY DUONG DAN (URL):
echo ------------------------------------------------------
echo 1. Ban se thay 2 cua so Ngrok moi hien len.
echo 2. Tim dong "Forwarding" co dang: https://xxxx.ngrok-free.app
echo.
echo 3. Voi cua so BACKEND (Port 3000):
echo    - Copy link do va dan vao client/.env (cho VITE_API_URL)
echo    - QUAN TRONG: Mo link nay tren trinh duyet 1 lan va bam "Visit Site"
echo.
echo 4. Voi cua so FRONTEND (Port 5173):
echo    - Day chinh la link de ban truy cập vao giao dien tu xa!
echo ------------------------------------------------------
echo.
echo Nhan phim bat ky de ket thuc thong bao nay.
pause >nul
