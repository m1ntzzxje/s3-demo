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

### 🌐 Public Access with Ngrok
If you want to share the demo or access it from another device:
1. Run `run_demo.bat` first.
2. Run `START_NGROK.bat` (located in the root).
3. Copy the generated `https://...ngrok-free.app` URL.
4. Update `client/.env` -> `VITE_API_URL=https://your-url.ngrok-free.app/api`.
5. Your Frontend will now talk to the public backend!


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
- `INSTALL_AND_START.bat`: Cài đặt môi trường ảo và khởi động toàn bộ ứng dụng S3.
- `run_demo.bat`: File khởi động 1-click. Tự động bật đồng bộ MinIO, Backend và Frontend trong 3 cửa sổ riêng biệt.
- `README.md`: Tài liệu hướng dẫn sử dụng và cấu trúc dự án.

### 🐍 Backend (`/server`)
- `main.py`: Trái tim của Backend. Định nghĩa toàn bộ API Endpoints (Upload, Download, Share, Trash, Auth).
- `s3_service.py`: Chứa logic nghiệp vụ tương tác với S3 (Cấu hình Versioning, Lifecycle, Object Lock).
- `sync_service.py`: Chịu trách nhiệm đồng bộ hóa (sync) và theo dõi trạng thái các tệp giữa local và remote.
- `auth_service.py`: Quản lý người dùng, mã hóa mật khẩu và tạo token JWT bảo mật.
- `s3_config.py`: Khởi tạo kết nối Boto3 Client tới máy chủ S3 (MinIO).
- `requirements.txt`: Danh sách các thư viện Python cần thiết cho backend.
- `.env.example`: Mẫu cấu hình biến môi trường cho backend.

### ⚛️ Frontend (`/client`)

**Core Files:**
- `index.html`: Khung HTML chính của ứng dụng.
- `package.json`: Chứa thông tin về các thư viện npm và script.
- `vite.config.js`: Cấu hình hệ thống build Vite.
- `eslint.config.js`: Cấu hình linter cho mã nguồn.
- `.env.example`: Mẫu cấu hình biến môi trường cho frontend.

**`/src` Directory:**
- `App.jsx`: Component gốc, đóng vai trò là Router chính và định tuyến giao diện.
- `Auth.jsx`: Component xử lý giao diện đăng nhập và đăng ký.
- `main.jsx`: Entry point khởi tạo React DOM.
- `index.css`: File CSS toàn cục định nghĩa Theme Mode (Dark/Light) và phong cách chung.
- `Auth.css`: Định nghĩa CSS đặc thù cho giao diện đăng nhập.

**`/src/hooks` (Logic layer):**
- `useAppLogic.js`: Hook gộp, điều phối chung các state chính.
- `useAuth.js`: Quản lý trạng thái xác thực người dùng.
- `useFileOperations.js`: Xử lý logic thao tác file (Upload, Download, Share, Xóa...).
- `useFileSystem.js`: Quản lý state của hệ thống tệp và cấu trúc thư mục.
- `useNotifications.js`: Cung cấp hàm hiển thị thông báo.
- `useSettings.js`: Logic cấu hình cài đặt người dùng.
- `useSync.js`: Quản lý trạng thái và thao tác liên quan tới Backup/Sync.

**`/src/components` (UI pieces):**
- `/layout`:
  - `Header.jsx`: Thanh điều hướng ngang phía trên.
  - `SidebarLeft.jsx`: Thanh menu bên trái.
  - `SidebarRight.jsx`: Cửa sổ thông báo / lịch sử bên phải.
- `/files`:
  - `Breadcrumbs.jsx`: Thanh đường dẫn điều hướng thư mục.
  - `FileBrowser.jsx`: Khung chính hiển thị danh sách các tệp và thư mục.
  - `FileItem.jsx`: Component hiển thị chi tiết một tệp tin.
  - `FolderItem.jsx`: Component hiển thị chi tiết một thư mục.
  - `OtherViews.jsx`: Các góc nhìn/tab đặc biệt cho tệp.
- `/dashboard`:
  - `Dashboard.jsx`: Giao diện và biểu đồ thống kê Analytics.
- `/modals`:
  - `ConfirmDialog.jsx`: Hộp thoại xác nhận các thao tác quan trọng.
  - `PreviewModal.jsx`: Modal xem trước nội dung tệp tin.
  - `ShareModal.jsx`: Modal cấu hình quyền chia sẻ tệp.
- `/system`:
  - `Settings.jsx`: Giao diện cấu hình ứng dụng.
  - `SyncMonitor.jsx`: Dashboard quản lý quá trình đồng bộ hóa (Hybrid Sync).

**`/src/services` & `/src/utils`:**
- `api.js`: File cấu hình Axios, xử lý HTTP request tự động chèn token JWT.
- `formatters.js`: Các hàm tiện ích (formatSize, formatDate, renderIcon, v.v...).

### 📦 Storage (`/minio`)
- Thư mục lưu trữ dữ liệu mô phỏng S3 thực tế tại local.

## 🔐 Security & Setup (Crucial)
For privacy and safety, sensitive credentials are NOT committed to the repository.
1. Copy `server/.env.example` to `server/.env`.
2. Copy `client/.env.example` to `client/.env`.
3. Update the `.env` files with your actual credentials and a secure `JWT_SECRET`.
4. Ensure MongoDB is running before starting the services.
