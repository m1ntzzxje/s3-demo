# Professional README for ESoft S3 Hybrid Backup Demo

## 📁 System Architecture
- **Client (React + Vite)**: Modern UI with Glassmorphism, Dashboard, and File Explorer.
- **Server (FastAPI)**: JWT-based Auth, Multi-tenant S3 Gateway.
- **Storage**: MinIO (Local S3 Simulation) with Versioning & Lifecycle policies.

## 🚀 Getting Started (One-Click)
Just run the launcher at the root:
```bash
./run_demo.bat
```
*It will start MinIO, Backend (Port 3000), and Frontend (Port 5173).*

## 🛡️ Key Features
1. **Multi-tenancy**: Every user has an isolated `user_id/` prefix on S3.
2. **Hybrid Backup**: Sync local transactions to Physical S3 Layer.
3. **Anti-Ransomware**: S3 Versioning & Trash system allows 100% recovery.
4. **Collaboration**: Dedicated "Department" shared folder and peer-to-peer "Share" feature.

## 🛠️ Tech Stack
- **Frontend**: React, Recharts (Stats), Lucide Icons, Vanilla CSS.
- **Backend**: Python (FastAPI), Boto3 (S3 Standard), MongoDB (Auth & Sharing metadata).
- **Security**: Bcrypt password hashing, JWT Authorization, prefix-based isolation.

## 📂 Structure & File Details

### 🟢 Root Directory
- `run_demo.bat`: File khởi động 1-click. Tự động bật đồng bộ MinIO, Backend và Frontend trong 3 cửa sổ riêng biệt.

### 🐍 Backend (`/server`)
- `main.py`: Trái tim của Backend. Định nghĩa toàn bộ API Endpoints (Upload, Download, Share, Trash, Auth).
- `s3_service.py`: Chứa logic nghiệp vụ tương tác với S3 (Cấu hình Versioning, Lifecycle, Object Lock, tính toán Checksum SHA256).
- `auth_service.py`: Quản lý người dùng, mã hóa mật khẩu và tạo token JWT bảo mật.
- `s3_config.py`: Khởi tạo kết nối Boto3 Client tới máy chủ S3 (MinIO).

### ⚛️ Frontend (`/client`)
- `App.jsx`: Chứa logic chính của ứng dụng: Quản lý trạng thái (State), tích hợp API, xử lý thông báo và giao diện Dashboard.
- `Auth.jsx`: Màn hình Đăng nhập/Đăng ký tích hợp bảo mật 2 lớp (MFA). (MFA chả có gì tại e chưa triển khai)
- `index.css`: Toàn bộ linh hồn của thiết kế. Định nghĩa phong cách Glassmorphism, hiệu ứng chuyển động và Layout Dashboard.
- `Auth.css`: Phong cách riêng cho màn hình đăng nhập chuyên nghiệp.

### 📦 Storage (`/minio`)

## 🔐 Security & Setup (Crucial)
For privacy and safety, sensitive credentials are NOT committed to the repository.
1. Copy `server/.env.example` to `server/.env`.
2. Copy `client/.env.example` to `client/.env`.
3. Update the `.env` files with your actual credentials and a secure `JWT_SECRET`.
4. Ensure MongoDB is running before starting the services.
