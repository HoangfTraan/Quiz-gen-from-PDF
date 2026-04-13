# QuizGen AI - Hệ thống tạo đề thi tự động từ tài liệu PDF

## 1. Giới thiệu dự án
**QuizGen AI** là một ứng dụng web hiện đại được thiết kế để hỗ trợ giáo viên và học sinh trong việc chuyển đổi các tài liệu học tập (PDF) thành bộ câu hỏi trắc nghiệm một cách tự động. Ứng dụng tích hợp trí tuệ nhân tạo (AI) mạnh mẽ để phân tích nội dung, tóm tắt kiến thức và sinh câu hỏi dựa trên các cấp độ tư duy khoa học.

## 2. Nội dung và Phạm vi hệ thống

### Phạm vi dự án:
Dự án tập trung vào việc tối ưu hóa quy trình ôn tập và đánh giá năng lực cá nhân. Thay vì phải soạn đề thủ công tốn nhiều thời gian, hệ thống cho phép người dùng có ngay bộ đề chất lượng chỉ trong vài giây từ chính tài liệu họ đang học.

### Các tính năng chính:
*   **Quản lý tài liệu:** Tải lên tài liệu PDF, hệ thống tự động trích xuất nội dung văn bản.
*   **Phân tích AI:** Tự động tạo tóm tắt nội dung và trích xuất các từ khóa chính cho mỗi tài liệu.
*   **Sinh câu hỏi thông minh:** Tạo câu hỏi trắc nghiệm (MCQ) đa dạng dựa trên **Thang đo Bloom (Bloom Taxonomy)** bao gồm 6 cấp độ: Nhớ, Hiểu, Vận dụng, Phân tích, Đánh giá, Sáng tạo.
*   **Kiểm duyệt & Chỉnh sửa:** Người dùng có thể kiểm soát chất lượng câu hỏi, chỉnh sửa nội dung hoặc mức độ Bloom trước khi đưa vào ngân hàng đề.
*   **Luyện tập & Kết quả:** Giao diện thi trắc nghiệm trực quan, cung cấp giải thích chi tiết cho từng đáp án và đưa ra **Gợi ý học tập từ AI** dựa trên kết quả làm bài.
*   **Lọc & Tìm kiếm:** Hỗ trợ lọc câu hỏi theo mức độ Bloom trực tiếp từ cơ sở dữ liệu để tập trung ôn luyện các phần kiến thức khó.

## 3. Các công cụ và Công nghệ sử dụng
*   **Framework:** [Next.js](https://nextjs.org/) (App Router) - Tối ưu hóa hiệu năng và SEO.
*   **Ngôn ngữ:** TypeScript - Đảm bảo mã nguồn tường minh và giảm thiểu lỗi.
*   **Cơ sở dữ liệu:** Được vận hành trên nền tảng [Supabase](https://supabase.com/).
*   **Xác thực và Lưu trữ:** Supabase Auth & Supabase Storage.
*   **AI Engine (Trình xử lý AI):** 
    *   **Google Gemini AI:** Xử lý phân tích văn bản và sinh câu hỏi chính.
    *   **Kyma (OpenAI-compatible):** Hệ thống dự phòng (fallback) và phân phối tải. (Round Robin).
*   **Thư viện biểu tượng:** Lucide React.
*   **Quản lý mã nguồn:** Git & GitHub.

## 4. Hướng dẫn chi tiết cho người dùng

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
    OPENAI_API_KEY=your_kyma_key
    KYMA_AI_MODEL=gemini-3-flash # Tên model của Kyma

    # Cấu hình Local AI (Tùy chọn - nếu dùng LM Studio/Ollama)
    USE_LOCAL_AI=false # Chuyển thành true để bỏ qua Cloud AI
    LOCAL_AI_URL=http://localhost:1234/v1
    LOCAL_AI_MODEL=google/gemma-4-e4b # Tên model của Local AI
    ```
4.  **Thiết lập Cơ sở dữ liệu (PostgreSQL):**
    *   Đăng ký tài khoản và tạo dự án mới trên [Supabase](https://supabase.com/).
    *   Vào mục **SQL Editor**, chạy nội dung trong file `supabase_schema.sql` để khởi tạo cấu trúc bảng.
    *   Chạy tiếp file `migration.sql` để cập nhật các tính năng mới nhất (như lọc Bloom Taxonomy).

### Chạy ứng dụng
*   Phát triển tại máy cục bộ: `npm run dev`
*   Truy cập tại: `http://localhost:3000`

### Quy trình sử dụng
1.  **Tải tài liệu:** Vào mục "Tài liệu của tôi" và upload file PDF. Đợi AI xử lý trích xuất văn bản.
2.  **Tạo đề thi:** Nhấn vào tài liệu, chọn "Tạo đề thi". Bạn có thể chọn số lượng câu hỏi mong muốn.
3.  **Duyệt câu hỏi:** Hệ thống sẽ chuyển đến trang Duyệt, tại đây bạn kiểm tra nội dung và nhãn Bloom. Nhấn "Lưu đề thi".
4.  **Luyện tập:** Vào danh sách bộ đề, chọn "Làm bài thi".
5.  **Xem kết quả:** Sau khi nộp bài, xem lại giải thích chi tiết và nhận lời khuyên từ AI để biết mình cần cải thiện phần kiến thức nào.
