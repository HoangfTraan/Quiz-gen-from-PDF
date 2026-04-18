-- 1. Tạo bucket mới tên là 'avatars' (Công khai - Public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, '{"image/png", "image/jpeg", "image/gif", "image/webp"}')
ON CONFLICT (id) DO NOTHING;

-- 2. Thiết lập RLS cho bucket 'avatars'

-- Policy: Cho phép bất kỳ ai cũng có thể xem ảnh đại diện (Public)
CREATE POLICY "Cho phép xem avatar công khai"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Policy: Cho phép người dùng đã đăng nhập có thể tải lên ảnh của chính họ
-- Lưu ý: Chúng ta kiểm tra path bắt đầu bằng auth.uid()
CREATE POLICY "Cho phép user tải lên avatar của mình"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Cho phép người dùng cập nhật ảnh của chính họ
CREATE POLICY "Cho phép user cập nhật avatar của mình"
ON storage.objects FOR UPDATE
TO authenticated
USING ( 
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Cho phép người dùng xóa ảnh của mình
CREATE POLICY "Cho phép user xóa avatar của mình"
ON storage.objects FOR DELETE
TO authenticated
USING ( 
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);
