# ESoft S3 Hybrid Backup Demo 🚀

Dự án mô phỏng hệ thống sao lưu dữ liệu lai (Hybrid Backup) 3-Node sử dụng React (Frontend), FastAPI (Backend), MinIO (S3 Storage) và MongoDB.

---

## 📌 Yêu cầu hệ thống
Trước khi khởi chạy, hãy đảm bảo máy tính của bạn đã cài đặt:
1. **Node.js** (để chạy Frontend)
2. **Python 3.x** (để chạy Backend)
3. **MongoDB** (đang chạy tại cổng mặc định `27017`)

---

## ⚡ Hướng dẫn khởi chạy nhanh (1-Click)

### **Bước 1: Cài đặt & Khởi chạy lần đầu**
Tại thư mục gốc của dự án, chạy file sau để tự động cài đặt thư viện và khởi động toàn bộ dịch vụ:
👉 **`INSTALL_AND_START.bat`**

### **Bước 2: Các lần chạy sau**
Khi các thư viện đã được cài đặt đầy đủ, những lần sau bạn chỉ cần chạy file:
👉 **`run_demo.bat`**

*Hệ thống sẽ tự động mở 3 cửa sổ dòng lệnh độc lập cho: MinIO Server, Backend API và Frontend.*

---

## 🔑 Thông tin đăng nhập mặc định

Sau khi khởi chạy, truy cập vào giao diện Web tại địa chỉ: **[http://localhost:5173](http://localhost:5173)**

Sử dụng tài khoản Demo sau để đăng nhập:
* **Email**: `admin@esoft.com`
* **Mật khẩu**: `esoft_2026`
* **Mã MFA**: `102030`

---

## 🌐 Các cổng dịch vụ hoạt động

* 💻 **Frontend (React)**: [http://localhost:5173](http://localhost:5173)
* ⚙️ **Backend API Docs (FastAPI)**: [http://localhost:3000/docs](http://localhost:3000/docs)
* 🗄️ **MinIO S3 Console**: [http://localhost:9001](http://localhost:9001)
  *(Tài khoản: `esoft_admin` | Mật khẩu: `esoft_secret_key`)*
* 💾 **MongoDB**: `mongodb://localhost:27017`

---

## ⚙️ Cấu hình môi trường (.env)
Nếu cần thay đổi cấu hình kết nối, bạn có thể chỉnh sửa các file sau:
* **Backend**: `server/.env` (Cấu hình cổng kết nối, MongoDB URI, và S3 bucket)
* **Frontend**: `client/.env` (Cấu hình địa chỉ gọi API: `VITE_API_URL`)

---

## 📂 Cấu trúc dự án & Các tệp tin chính

### 🟢 Thư mục gốc (Root)
* `INSTALL_AND_START.bat`: Script tự động setup môi trường ảo Python, cài đặt package, cài npm và chạy dự án.
* `run_demo.bat`: Script khởi chạy nhanh 1-Click (mở 3 tab cmd riêng biệt chạy MinIO, Backend và Frontend).
* `START_NGROK.bat`: Công cụ hỗ trợ tạo tunnel kết nối công khai từ Internet qua Ngrok.

### 🐍 Backend (`/server`) - FastAPI
* `main.py`: Điểm khởi chạy FastAPI, cấu hình middleware CORS và lập lịch tự động (APScheduler).
* `auth_service.py`: Xử lý đăng ký/đăng nhập, mã hóa Bcrypt và tạo token JWT.
* `s3_service.py`: Các API giao tiếp trực tiếp với MinIO S3 (upload, download, Trash, Object Lock, Lifecycle).
* `sync_service.py`: Bộ máy đồng bộ dữ liệu (Sync Engine) xử lý backup 3-Node từ Local -> S3 Transit -> Server 2.
* `routers/`:
  * `auth.py`: API xác thực người dùng.
  * `files.py`: API tải lên, quản lý metadata, xoá tệp tin.
  * `sync.py`: API điều khiển và lấy trạng thái của bộ máy đồng bộ.
  * `trash.py` / `share.py` / `department.py`: API quản lý thùng rác, chia sẻ tệp và thư mục phòng ban.

### ⚛️ Frontend (`/client`) - React + Vite
* `src/components/`:
  * `Dashboard.jsx`: Giao diện trực quan hoá dữ liệu phân tích dung lượng sử dụng.
  * `FileBrowser.jsx`: Trình duyệt tệp tin dạng Explorer kéo thả linh hoạt.
  * `SyncMonitor.jsx`: Dashboard giám sát tiến trình backup 3-Node theo thời gian thực.
* `src/hooks/`:
  * `useAuth.js` / `useFileSystem.js` / `useSync.js`: Quản lý state đăng nhập, cây thư mục và trạng thái sync.
* `src/services/api.js`: Cấu hình Axios gọi API có kèm JWT Token.

### 📦 Storage Simulator (`/minio`) - Data Layer
* `minio.exe`: Trình giả lập dịch vụ lưu trữ đám mây S3 cục bộ.
* `start_minio.bat`: Script khởi động nhanh máy chủ MinIO.
* `data/`: Thư mục vật lý chứa dữ liệu thực tế được lưu trữ trên S3.