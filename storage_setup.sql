-- 1. Tạo bucket mới tên là 'documents'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 52428800, '{"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}')
ON CONFLICT (id) DO NOTHING;

-- 2. Thiết lập RLS (Row Level Security) cho bucket 'documents'

-- Bật RLS cho bảng storage.objects (Chạy bị lỗi 42501 vì Supabase đã tự động khóa/bật tĩnh)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy (Quy tắc): Cho phép người dùng đã đăng nhập tự xem file của chính họ tải lên
CREATE POLICY "Cho phép user tải xuống file của chính họ"
ON storage.objects FOR SELECT
USING ( auth.uid()::text = owner_id AND bucket_id = 'documents' );

-- Policy (Quy tắc): Cho phép người dùng tải lên file vào thư mục mang tên user_id của họ
CREATE POLICY "Cho phép user tải lên thư mục của họ"
ON storage.objects FOR INSERT
WITH CHECK ( auth.uid()::text = owner_id AND bucket_id = 'documents' );

-- Policy (Quy tắc): Cho phép người dùng xóa file của họ
CREATE POLICY "Cho phép user xóa file của họ"
ON storage.objects FOR DELETE
USING ( auth.uid()::text = owner_id AND bucket_id = 'documents' );
