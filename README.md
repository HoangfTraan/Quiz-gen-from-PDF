# QuizGen AI - Hệ thống tạo đề thi tự động & Quản lý học tập thông minh

## 1. Giới thiệu dự án
**QuizGen AI** là một ứng dụng web hiện đại được thiết kế nhằm hỗ trợ giáo viên, học sinh và nhà quản lý giáo dục trong việc tự động hóa quá trình tạo đề thi từ tài liệu học tập (PDF). Ứng dụng tích hợp trí tuệ nhân tạo (AI) để phân tích văn bản, sinh bộ câu hỏi trắc nghiệm đa dạng và cung cấp các báo cáo học tập chi tiết, giúp tối ưu hóa quy trình ôn luyện và đánh giá năng lực.

## 2. Phân quyền và Các vai trò trong hệ thống
Hệ thống được thiết kế với 3 vai trò chuyên biệt, phục vụ các mục đích sử dụng khác nhau:
*   **Học sinh (Student):** Có thể tải lên tài liệu cá nhân, tự tạo đề thi trắc nghiệm theo ý muốn, làm bài trực tuyến, xem lịch sử làm bài, nhận gợi ý học tập từ AI và báo cáo các câu hỏi có nội dung chưa chính xác.
*   **Giáo viên (Teacher):** Sở hữu mọi quyền hạn của Học sinh, đồng thời có thêm quyền truy cập bảng điều khiển kết quả của học sinh (Teacher Results). Giáo viên có thể theo dõi tiến độ, thống kê điểm số và đánh giá năng lực của các lớp/nhóm học sinh mình quản lý.
*   **Quản trị viên (Admin):** Quản lý toàn bộ hệ thống thông qua Admin Panel chuyên biệt. Bao gồm: quản lý người dùng, phê duyệt yêu cầu cấp quyền giáo viên (Role Requests), quản lý toàn bộ tài liệu & ngân hàng câu hỏi, xử lý các câu hỏi bị báo cáo (Flagged Questions) và giám sát các tiến trình xử lý của AI (AI Jobs).

## 3. Các tính năng nổi bật
*   **Quản lý tài liệu:** Tải lên file PDF, trích xuất và xử lý văn bản tự động.
*   **Sinh câu hỏi AI thông minh:** Tự động tạo câu hỏi trắc nghiệm (MCQ) dựa trên **Thang đo nhận thức Bloom (Bloom Taxonomy)** với 6 cấp độ: Nhớ, Hiểu, Vận dụng, Phân tích, Đánh giá, Sáng tạo.
*   **Trải nghiệm làm bài & Chữa bài chi tiết:** Giao diện thi trực quan. Sau khi nộp bài, hệ thống cung cấp giải thích chi tiết cho từng đáp án, cùng với **Gợi ý học tập cá nhân hóa từ AI** dựa trên phân tích điểm mạnh/yếu của người làm.
*   **Hệ thống Phản hồi & Kiểm duyệt:** Tính năng Báo cáo câu hỏi lỗi giúp liên tục cải thiện chất lượng ngân hàng đề thi với sự can thiệp của Giáo viên và Admin.
*   **Dashboard & Thống kê:** Bảng điều khiển trực quan sử dụng biểu đồ (Recharts) để hiển thị thống kê kết quả, số lần thử và sự tiến bộ qua thời gian.

## 4. Công nghệ và Thư viện sử dụng
*   **Frontend Framework:** [Next.js 15](https://nextjs.org/) (App Router), React 19.
*   **Ngôn ngữ:** TypeScript.
*   **Giao diện & UI:** Tailwind CSS, Recharts (vẽ biểu đồ), Lucide React (icon).
*   **Xử lý PDF:** `pdf-parse`, `pdfjs-dist`.
*   **Backend & Cơ sở dữ liệu:** [Supabase](https://supabase.com/) (PostgreSQL, Supabase Auth, Supabase Storage).
*   **Trí tuệ nhân tạo (AI Engine):**
    *   `@google/generative-ai` (Google Gemini) cho các tác vụ phân tích và sinh câu hỏi phức tạp.
    *   `openai` SDK hỗ trợ tương thích với nhiều Cloud AI khác (OpenAI, Mistral, Kyma, v.v.).
    *   Hỗ trợ cấu hình tích hợp Local AI (LM Studio, Ollama).

## 5. Hướng dẫn cài đặt và chạy ứng dụng

### Cài đặt môi trường
1.  **Clone dự án:**
    ```bash
    git clone https://github.com/HoangfTraan/Quiz-gen-from-PDF.git
    cd quiz-gen-app
    ```
2.  **Cài đặt các gói phụ thuộc:**
    ```bash
    npm install
    ```
3.  **Cấu hình biến môi trường:**
    Tạo file `.env.local` tại thư mục gốc và điền các thông số sau:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    GEMINI_API_KEY=your_gemini_key
    
    # Cấu hình AI tuỳ chọn khác (OpenAI/Mistral...)
    AI_API_KEY=your_api_key
    AI_BASE_URL=https://api.mistral.ai/v1
    AI_MODEL=mistral-small-latest

    # Cấu hình Local AI (Tùy chọn)
    USE_LOCAL_AI=false
    LOCAL_AI_URL=http://localhost:1234/v1
    LOCAL_AI_MODEL=google/gemma-4-e4b
    ```
4.  **Thiết lập Cơ sở dữ liệu (Supabase):**
    *   Đăng ký/Đăng nhập và tạo dự án mới trên [Supabase](https://supabase.com/).
    *   Sử dụng các file `.sql` cấu hình (nếu có) hoặc thông qua giao diện để tạo các bảng tương ứng cho Users, Documents, Quizzes, Questions, Attempts, RoleRequests,...

### Chạy ứng dụng
*   Khởi động môi trường phát triển: `npm run dev`
*   Ứng dụng sẽ chạy tại địa chỉ: `http://localhost:3000`
