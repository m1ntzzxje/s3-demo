@echo off
echo ==============================================
echo Khởi động MinIO - S3 Compatible Storage Server
echo ==============================================

if not exist minio.exe (
    echo [INFO] Dang tai xuong minio.exe tu may chu chinh thuc...
    powershell -Command "Invoke-WebRequest -Uri 'https://dl.min.io/server/minio/release/windows-amd64/minio.exe' -OutFile 'minio.exe'"
    echo [INFO] Tai xuong thanh cong!
)

set MINIO_ROOT_USER=esoft_admin
set MINIO_ROOT_PASSWORD=esoft_secret_key

if not exist "%~dp0data" (
    mkdir "%~dp0data"
)

echo [INFO] Khoi dong Dich vu. Vui long chuyen port 9000 (API) va 9001 (Web Console).
echo URL Web: http://localhost:9001
echo Tai khoan: esoft_admin
echo Mat khau: esoft_secret_key

minio.exe server "%~dp0data" --console-address ":9001"
