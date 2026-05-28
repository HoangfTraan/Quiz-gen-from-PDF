import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/chapters?documentId=xxx
 * Lấy danh sách chương của tài liệu
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: chapters, error } = await supabase
      .from('chapters')
      .select('id, chapter_index, title, content, summary, start_page, end_page, detection_method, metadata')
      .eq('document_id', documentId)
      .order('chapter_index', { ascending: true });

    if (error) throw error;

    // Lấy thêm thông tin document
    const { data: doc } = await supabase
      .from('documents')
      .select('title, status, total_pages')
      .eq('id', documentId)
      .single();

    return NextResponse.json({
      success: true,
      document: doc,
      chapters: chapters || [],
      totalChapters: chapters?.length || 0,
    });
  } catch (error: any) {
    console.error('[API/chapters] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
