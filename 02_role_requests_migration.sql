-- ============================================================
-- Yêu cầu Cấp Quyền (Role Requests Migration)
-- ============================================================

-- 1. Tạo bảng role_requests (lưu trữ các yêu cầu chuyển đổi quyền)
CREATE TABLE IF NOT EXISTS public.role_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requested_role TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- Trạng thái: 'pending' (đang chờ), 'approved' (đã duyệt), 'rejected' (từ chối)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bật Row Level Security (Bảo mật cấp dòng)
ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Admin có toàn quyền (Đọc/Thêm/Sửa/Xóa)
CREATE POLICY "role_requests_admin_all"
  ON public.role_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Policy: Người dùng có thể tự xem các yêu cầu của chính họ
CREATE POLICY "role_requests_read_own"
  ON public.role_requests
  FOR SELECT
  USING (user_id = auth.uid());

-- 5. Policy: Người dùng có thể tự gửi yêu cầu cho chính họ
CREATE POLICY "role_requests_insert_own"
  ON public.role_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 6. Index: Tăng tốc độ tra cứu danh sách yêu cầu của một người dùng
CREATE INDEX IF NOT EXISTS idx_role_requests_user_id ON public.role_requests(user_id);
