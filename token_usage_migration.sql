-- Thêm các cột token usage vào bảng ai_jobs
ALTER TABLE public.ai_jobs
ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS completion_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cached_tokens INTEGER DEFAULT 0;
