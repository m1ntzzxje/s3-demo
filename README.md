# Professional README for ESoft S3 Hybrid Backup Demo

## 📁 System Architecture
- *Client (React + Vite)*: Modern UI with Glassmorphism, Dashboard, and File Explorer.
- *Server (FastAPI)*: JWT-based Auth, Multi-tenant S3 Gateway.
- *Storage*: MinIO (Local S3 Simulation) with Versioning & Lifecycle policies.

## 🚀 Getting Started (One-Click)
Just run the launcher at the root:
./run_demo.bat
It will start MinIO, Backend (Port 3000), and Frontend (Port 5173).

### 🌐 Public Access with Ngrok
If you want to share the demo or access it from another device:
1. Run run_demo.bat first.
2. Run START_NGROK.bat (located in the root).
3. Copy the generated https://...ngrok-free.app URL.
4. Update client/.env -> VITE_API_URL=https://your-url.ngrok-free.app/api.
5. Your Frontend will now talk to the public backend!


## 🛡️ Key Features
1. *Multi-tenancy*: Every user has an isolated user_id/ prefix on S3.
2. *Hybrid Backup*: Sync local transactions to Physical S3 Layer.
3. *Anti-Ransomware*: S3 Versioning & Trash system allows 100% recovery.
4. *Collaboration*: Dedicated "Department" shared folder and peer-to-peer "Share" feature.

## 🛠️ Tech Stack
- *Frontend*: React, Recharts (Stats), Lucide Icons, Vanilla CSS.
- *Backend*: Python (FastAPI), Boto3 (S3 Standard), MongoDB (Auth & Sharing metadata).
- *Security*: Bcrypt password hashing, JWT Authorization, prefix-based isolation.

## 📂 Structure & File Details

### 🟢 Root Directory (Quản lý dự án)
- INSTALL_AND_START.bat: Kịch bản cài đặt tự động (Virtual Env, npm install) và khởi chạy toàn bộ hệ thống.
- run_demo.bat: Trình khởi chạy 1-click, tự động mở MinIO, Backend và Frontend trong các cửa sổ riêng biệt.
- START_NGROK.bat: Công cụ hỗ trợ tạo tunnel công khai để truy cập ứng dụng từ internet qua Ngrok.
- ngrok.exe: Tệp thực thi của Ngrok được tích hợp sẵn để phục vụ việc chia sẻ demo.
- README.md: Tài liệu kỹ thuật chi tiết về kiến trúc, tính năng và hướng dẫn vận hành.

### 🐍 Backend (/server) - FastAPI Engine
- main.py: Điểm khởi đầu của ứng dụng, nơi đăng ký các routers và cấu hình Middleware (CORS).
- dependencies.py: Chứa các Dependency Injection của FastAPI như xác thực Token (JWT) và quyền truy cập.
- s3_service.py: Tầng giao tiếp cấp thấp với S3 (Boto3), xử lý Logic Versioning, Object Lock và Lifecycle.
- sync_service.py: Bộ máy đồng bộ hóa phức tạp, quản lý việc khớp dữ liệu giữa local và cloud layer.
- auth_service.py: Xử lý bảo mật: mã hóa mật khẩu (Bcrypt), tạo và xác thực mã định danh JWT.
- s3_config.py: Quản lý cấu hình kết nối tới MinIO/AWS S3 thông qua Boto3 client.
- **/routers (Modular API):**
  - auth.py: API xử lý đăng nhập, đăng ký và quản lý phiên làm việc.
  - files.py: Tập hợp API thao tác tệp tin (Upload đa luồng, Download, Metadata).
  - share.py: Logic chia sẻ tệp giữa các người dùng và quản lý quyền truy cập.
  - trash.py: Hệ thống thùng rác thông minh, cho phép khôi phục dữ liệu nhờ S3 Versioning.
  - department.py: Quản lý không gian lưu trữ chung cho các phòng ban/nhóm.
  - sync.py: API cung cấp trạng thái đồng bộ và điều khiển quá trình Backup.

### ⚛️ Frontend (/client) - React Modern UI
- **/src/hooks (Business Logic Layer):**
  - useFileSystem.js: Quản lý cấu trúc cây thư mục và trạng thái hệ thống tệp.
  - useFileOperations.js: Triển khai các tác vụ như Upload, Move, Rename, Delete.
  - useSync.js: Theo dõi tiến độ đồng bộ và trạng thái của Hybrid Sync.
  - useAuth.js: Quản lý trạng thái đăng nhập và thông tin người dùng hiện tại.
- **/src/components (UI Components):**
  - FileBrowser.jsx: Thành phần trung tâm hiển thị Explorer-style view cho các tệp tin.
  - Dashboard.jsx: Giao diện trực quan hóa dữ liệu lưu trữ bằng biểu đồ Analytics.
  - SyncMonitor.jsx: Dashboard chuyên biệt để giám sát tiến trình Backup theo thời gian thực.
  - modals/: Tập hợp các hộp thoại tương tác (Share, Preview, Confirm).
- **/src/services & utils:**
  - api.js: Cấu hình Axios với Interceptors để tự động đính kèm JWT vào mọi request.
  - formatters.js: Các hàm helper để định dạng kích thước tệp, thời gian và biểu tượng icon.

### 📦 Storage (/minio) - Data Layer
- minio.exe: Binary máy chủ S3 local phục vụ cho việc mô phỏng hạ tầng Cloud.
- start_minio.bat: Script khởi động nhanh dịch vụ MinIO với cấu hình lưu trữ mặc định.
- /data: Thư mục vật lý lưu trữ các Objects và Metadata của hệ thống S3.


## 🔐 Security & Setup (Crucial)
For privacy and safety, sensitive credentials are NOT committed to the repository.
1. Copy server/.env.example to server/.env.
2. Copy client/.env.example to client/.env.
3. Update the .env files with your actual credentials and a secure JWT_SECRET.
4. Ensure MongoDB is running before starting the services.