-- 1. Thêm cột difficulty vào bảng questions
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS difficulty TEXT;

-- 2. Thêm Index để việc lọc theo mức độ Bloom đạt hiệu năng cao nhất
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);

-- 3. (Tùy chọn) Một Script SQL nhỏ để cập nhật dữ liệu ngay lập tức cho các câu hỏi đã có Tag
-- Script này tìm chuỗi [MỨC ĐỘ: ...] ở đầu cột explanation và lưu vào cột difficulty
UPDATE public.questions
SET difficulty = INITCAP(TRIM(substring(explanation from '\[MỨC ĐỘ:\s*(.*?)\]')))
WHERE explanation ~* '\[MỨC ĐỘ:';