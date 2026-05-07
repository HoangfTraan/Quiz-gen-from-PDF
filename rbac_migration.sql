-- ============================================================
-- RBAC Migration
-- ============================================================

-- 1. Tạo bảng roles (danh mục vai trò)
CREATE TABLE IF NOT EXISTS public.roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Seed 4 vai trò mặc định
INSERT INTO public.roles (name, description) VALUES
  ('admin',   'Quản trị viên hệ thống — toàn quyền'),
  ('teacher', 'Giáo viên: tạo, xem, kiểm duyệt và sửa bộ đề của mình'),
  ('learner', 'Người học: tạo đề, làm bài và xem điểm của mình'),
  ('user',    'Người dùng mặc định: tạo và xem bộ đề của mình')
ON CONFLICT (name) DO NOTHING;

-- 3. Tạo bảng user_roles (bảng phân quyền trung gian)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role_id)
);

-- 4. Bật Row Level Security cho user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Policy: chỉ admin mới đọc/ghi được user_roles
CREATE POLICY "user_roles_admin_all"
  ON public.user_roles
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

-- 6. Index tăng tốc tra cứu
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

-- 7. Cho phép Admin cập nhật thông tin trong bảng users (Bypass RLS silent failure)
-- Cần thiết vì admin phải update cột `role` và `full_name` của user khác
CREATE POLICY "users_admin_update"
  ON public.users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users AS admin_users
      WHERE admin_users.id = auth.uid() AND admin_users.role = 'admin'
    )
  );

-- 8. Cho phép người dùng tự xem quyền của chính mình (Rất quan trọng để UI nhận diện được role khi họ đăng nhập)
CREATE POLICY "user_roles_read_own"
  ON public.user_roles
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

