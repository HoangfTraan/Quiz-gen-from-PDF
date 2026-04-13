import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import pdfParse from 'pdf-parse';
import { generateJSON } from '@/utils/ai/provider';

export async function POST(request: Request) {
  try {
    const { documentId, action, chunkId, quizId } = await request.json();
    if (!documentId || !action) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

    const supabase = await createClient();

    // Lấy thông tin Document
    const { data: doc, error: docError } = await supabase.from('documents').select('*').eq('id', documentId).single();
    if (docError || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    switch (action) {

      // ==========================================
      // AI TASK 1: TRÍCH XUẤT VÀ LÀM SẠCH TEXT
      // ==========================================
      case 'extract': {
        await supabase.from('documents').update({ status: 'processing' }).eq('id', documentId);

        const { data: fileData, error: downloadError } = await supabase.storage.from('documents').download(doc.file_path);
        if (downloadError || !fileData) throw new Error('Failed to download file from Storage');

        const buffer = Buffer.from(await fileData.arrayBuffer());
        let rawText = '';
        if (doc.file_name.toLowerCase().endsWith('.pdf')) {
          const pdfData = await pdfParse(buffer);
          rawText = pdfData.text;
        } else {
          rawText = buffer.toString('utf-8');
        }

        if (!rawText.trim()) throw new Error('No text extracted');

        // Clean Text (Loại bỏ khoảng trắng thừa, ký tự Null, fix dấu)
        let cleanedText = rawText.replace(/\u0000/g, '').replace(/[\r\n]{3,}/g, '\n\n').trim();

        // Xóa bản ghi cũ nếu có để chạy lại từ đầu
        await supabase.from('document_contents').delete().eq('document_id', documentId);
        await supabase.from('document_contents').insert({
          document_id: documentId,
          raw_text: rawText,
          cleaned_text: cleanedText
        });

        return NextResponse.json({ success: true, message: 'Extracted successfully' });
      }

      // ==========================================
      // AI TASK 2: PHÂN ĐOẠN NỘI DUNG (CHUNKING)
      // ==========================================
      case 'chunk': {
        const { data: content } = await supabase.from('document_contents').select('cleaned_text').eq('document_id', documentId).single();
        if (!content || !content.cleaned_text) throw new Error('Cleaned text not found');

        const text = content.cleaned_text;
        const chunkSize = 1500; // Khoảng 1500 ký tự mỗi chunk
        const overlap = 200;    // Đoạn gối đầu

        let chunks = [];
        let startIndex = 0;
        let index = 1;

        while (startIndex < text.length) {
          let endIndex = startIndex + chunkSize;

          if (endIndex < text.length) {
            const spaceIndex = text.lastIndexOf(' ', endIndex);
            const newlineIndex = text.lastIndexOf('\n', endIndex);
            // Ưu tiên ngắt tại dấu xuống dòng, sau đó là dấu cách
            endIndex = newlineIndex > startIndex + chunkSize / 2 ? newlineIndex : (spaceIndex > startIndex ? spaceIndex : endIndex);
          }

          chunks.push({
            document_id: documentId,
            chunk_index: index,
            title: `Phần ${index}`,
            content: text.substring(startIndex, endIndex).trim()
          });

          startIndex = endIndex - overlap;
          index++;
        }

        await supabase.from('document_chunks').delete().eq('document_id', documentId);
        await supabase.from('document_chunks').insert(chunks);

        return NextResponse.json({ success: true, total_chunks: chunks.length });
      }

      // ==========================================
      // AI TASK 3: TÓM TẮT & TRÍCH XUẤT TỪ KHÓA
      // ==========================================
      case 'summarize': {
        const { data: chunks } = await supabase.from('document_chunks').select('content').eq('document_id', documentId).limit(3);
        if (!chunks || chunks.length === 0) throw new Error('No chunks found');

        const previewText = chunks.map(c => c.content).join('\n\n');

        //CUNG CẤP SCHEMA (KHUÔN) CHO FUNCTION CALLING
        const prompt = `Hãy đọc phần đầu của tài liệu sau và trả về ĐÚNG ĐỊNH DẠNG JSON hợp lệ. Không được kèm text dư thừa.
Yêu cầu JSON:
{
  "summary": "Tóm tắt khoảng 2-3 câu gọn gàng về tài liệu",
  "keywords": ["Từ khóa 1", "Từ khóa 2", "Từ khóa 3", "Từ khóa 4", "Từ khóa 5"]
}

Nội dung tài liệu (Trích xuất đoạn đầu):
"""
${previewText}
"""`;

        // Gọi hàm generateJSON (hệ thống sẽ tự động bật JSON Mode cho API)
        const { data: aiData, source } = await generateJSON(
          prompt,
          'Bạn là một chuyên gia phân tích dữ liệu. Trả về JSON chuẩn.'
        );
        console.log(`[Process/summarize] Response from: ${source}`);

        await supabase.from('document_contents').update({
          summary: aiData.summary,
          keywords: aiData.keywords
        }).eq('document_id', documentId);

        // Tạo sẵn một Quiz draft
        await supabase.from('quizzes').delete().eq('document_id', documentId);
        const { data: quiz } = await supabase.from('quizzes').insert({
          document_id: documentId,
          user_id: doc.user_id,
          title: `Bộ đề trắc nghiệm: ${aiData.keywords?.[0] || 'Tài liệu mới'}`,
          status: 'draft'
        }).select().single();

        return NextResponse.json({ success: true, summary: aiData.summary, keywords: aiData.keywords, quizId: quiz?.id });
      }

      // ==========================================
      // AI TASK 4: SINH CÂU HỎI TỪ CHUNK ĐỘC LẬP
      // ==========================================
      case 'generate': {
        if (!chunkId || !quizId) throw new Error("Missing chunkId or quizId");

        const { data: chunk } = await supabase.from('document_chunks').select('content').eq('id', chunkId).single();
        if (!chunk) throw new Error("Chunk not found");

        const BLOOM_LEVELS = ["Nhớ", "Hiểu", "Vận dụng", "Phân tích", "Đánh giá", "Sáng tạo"];

        //SCHEMA FUNCTION CALLING CỦA AI RA ĐỀ (Bắt buộc trả về mảng câu hỏi đúng cấu trúc)
        const prompt = `Đọc đoạn nội dung siêu nhỏ sau, tạo 2 đến 3 câu hỏi trắc nghiệm cực kỳ bám sát, có tính suy luận để người học ôn tập phần này.
TRẢ VỀ ĐÚNG JSON:
{
  "questions": [
    {
      "question_text": "Nội dung câu hỏi",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "Giải thích ngắn gọn tại sao đúng",
      "difficulty": "CHỌN 1 TRONG: [Nhớ, Hiểu, Vận dụng, Phân tích, Đánh giá, Sáng tạo]"
    }
  ]
}

QUY TẮC BẮT BUỘC:
- Cột "difficulty" KHÔNG ĐƯỢC để trống.
- Chỉ chọn chính xác 1 trong 6 cấp độ Bloom trên.

Nội dung (Phần nhỏ):
"""
${chunk.content}
"""`;

        const { data: aiData, source } = await generateJSON(
          prompt,
          'Bạn là thầy giáo ra đề thi chuyên nghiệp. Bạn phải phân loại đúng mức độ Bloom Taxonomy cho mỗi câu hỏi.'
        );
        console.log(`[Process/generate] Response from: ${source}`);
        console.log(`[Process/generate] AI JSON:`, JSON.stringify(aiData, null, 2));

        // Helper to guess bloom level if AI misses it
        const guessBloomLevel = (text: string, explanation: string) => {
          const lower = (text + " " + explanation).toLowerCase();
          if (lower.includes("sáng tạo") || lower.includes("thiết kế") || lower.includes("xây dựng")) return "Sáng tạo";
          if (lower.includes("đánh giá") || lower.includes("nhận xét") || lower.includes("phê bình")) return "Đánh giá";
          if (lower.includes("phân tích") || lower.includes("tại sao") || lower.includes("so sánh")) return "Phân tích";
          if (lower.includes("vận dụng") || lower.includes("giải quyết") || lower.includes("tính toán")) return "Vận dụng";
          if (lower.includes("hiểu") || lower.includes("giải thích") || lower.includes("mô tả")) return "Hiểu";
          return "Nhớ"; // Mặc định là Nhớ
        };

        for (const q of aiData.questions) {
          let diff = q.difficulty;
          if (!diff || !BLOOM_LEVELS.some(l => diff.includes(l))) {
             diff = guessBloomLevel(q.question_text, q.explanation || "");
          }

          const difficultyTag = `[MỨC ĐỘ: ${diff.toUpperCase()}] `;
          const { data: dbQuestion } = await supabase.from('questions').insert({
            quiz_id: quizId,
            document_chunk_id: chunkId,
            question_text: q.question_text,
            question_type: 'mcq',
            explanation: difficultyTag + (q.explanation || ''),
            difficulty: diff, // LƯU VÀO CỘT MỚI
            ai_generated: true,
            quality_score: 100
          }).select().single();

          if (dbQuestion) {
            const optionsTable = q.options.map((optText: string, i: number) => ({
              question_id: dbQuestion.id,
              option_text: optText,
              is_correct: i === q.correct_index,
              option_label: ['A', 'B', 'C', 'D'][i] || ''
            }));
            await supabase.from('question_options').insert(optionsTable);
          }
        }
        return NextResponse.json({ success: true, count: aiData.questions.length });
      }

      // ==========================================
      // AI TASK 5: VALIDATE (KIỂM DUYỆT)
      // ==========================================
      case 'validate': {
        if (!quizId) throw new Error("Missing quizId");

        // Fetch tất cả câu hỏi của bài quiz này
        const { data: questions } = await supabase.from('questions').select('id, question_text').eq('quiz_id', quizId);
        if (!questions) throw new Error("Không có câu hỏi nào để validate");

        // Cập nhật trạng thái completed
        await supabase.from('documents').update({ status: 'completed' }).eq('id', documentId);

        return NextResponse.json({ success: true, message: "Validating completed (AI scoring implemented soon)" });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error: any) {
    console.error(`API Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
