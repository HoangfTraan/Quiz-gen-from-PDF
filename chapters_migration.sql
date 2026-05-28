-- =========================================
-- Migration: Thêm hệ thống nhận diện chương
-- =========================================

-- 1. Bảng chapters — Lưu từng chương của tài liệu
CREATE TABLE IF NOT EXISTS public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  chapter_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  start_position INTEGER,
  end_position INTEGER,
  start_page INTEGER,
  end_page INTEGER,
  detection_method TEXT DEFAULT 'regex',  -- 'regex' | 'ai' | 'default'
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Thêm chapter_id vào document_chunks (nullable cho backward compatibility)
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL;

-- 3. Thêm total_pages vào documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS total_pages INTEGER;

-- 4. Indexes cho truy vấn nhanh
CREATE INDEX IF NOT EXISTS idx_chapters_document_id ON public.chapters(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_chapter_id ON public.document_chunks(chapter_id);
