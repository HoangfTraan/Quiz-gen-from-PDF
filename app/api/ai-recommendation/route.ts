import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateText } from '@/utils/ai/provider';

export async function POST(request: Request) {
    try {
        const { attemptId } = await request.json();
        if (!attemptId) return NextResponse.json({ error: 'Missing attemptId' }, { status: 400 });

        const supabase = await createClient();

        // 1. Kiểm tra Cache trong bảng ai_jobs
        const { data: existingJobs } = await supabase.from('ai_jobs').select('output_payload').eq('job_type', `diagnosis_${attemptId}`).limit(1);
        const existingJob = existingJobs?.[0];
        if (existingJob && existingJob.output_payload?.diagnosis) {
            console.log(`[AI-Rec] Cache HIT for ${attemptId}`);
            return NextResponse.json({ success: true, recommendation: existingJob.output_payload.diagnosis });
        }
        console.log(`[AI-Rec] Cache MISS for ${attemptId}, calling AI...`);

        // Lấy câu sai
        const { data: wrongAnswers, error: wrongErr } = await supabase
            .from('attempt_answers')
            .select(`
                is_correct,
                question_options (*),
                questions (
                    question_text,
                    explanation,
                    document_chunks (content)
                )
            `)
            .eq('attempt_id', attemptId)
            .eq('is_correct', false);

        if (wrongErr) throw new Error(wrongErr.message);

        if (!wrongAnswers || wrongAnswers.length === 0) {
            const perfectMsg = 'Tuyệt vời! Bạn đã trả lời đúng toàn bộ câu hỏi. Kiến thức của bạn về phần này đã rất vững vàng, không phát hiện lỗ hổng nào.';
            return NextResponse.json({ success: true, recommendation: perfectMsg });
        }

        let compileText = '';
        wrongAnswers.forEach((ans: any, idx: number) => {
           compileText += `\nLỗi sai thứ ${idx + 1}:\n`;
           compileText += `- Câu hỏi: ${ans.questions?.question_text}\n`;
           compileText += `- Người dùng chọn sai đáp án: ${ans.question_options?.option_text} (Nhãn: ${ans.question_options?.option_label})\n`;
           compileText += `- Lời giải thích đúng của câu hỏi: ${ans.questions?.explanation}\n`;
           compileText += `- Nội dung / Lý thuyết gốc: ${ans.questions?.document_chunks?.content?.substring(0, 500)}...\n`;
        });

        const prompt = `Bạn là một Giáo sư phân tích học thuật xuất sắc. Hãy đọc danh sách các câu hỏi người dùng đã chọn sai trong bài kiểm tra.
Dựa vào nội dung câu hỏi, lý thuyết gốc và đáp án sai mà họ chọn, hãy "bắt mạch" và chẩn đoán gốc rễ lỗ hổng kiến thức của người dùng.
Họ đang hiểu sai khái niệm nào? Họ cần ôn tập kỹ lại phần nào?
Cuối cùng, đề xuất 2-3 gạch đầu dòng chiến lược học tập hoặc lộ trình ôn tập khắc phục.
Hãy trình bày cực kỳ súc tích, ngôn từ lôi cuốn, chuyên nghiệp bằng tiếng Việt.
Sử dụng Markdown để in đậm những từ khóa quan trọng. Cố gắng giữ nội dung trong khoảng 3-4 đoạn văn ngắn.

DỮ LIỆU CÂU LÀM SAI:
${compileText}`;

        const { source, text: recommendationHtml } = await generateText(
            prompt,
            'Bạn là Giáo sư phân tích học thuật. Trả lời bằng Markdown tiếng Việt.'
        );
        console.log(`[AI-Rec] Response from: ${source}`);

        // 2. Lưu cache: xóa bản cũ (nếu có) rồi insert mới
        const { data: attempt } = await supabase.from('quiz_attempts').select('quiz_id, user_id').eq('id', attemptId).single();
        if (attempt?.quiz_id) {
            await supabase.from('ai_jobs').delete().eq('job_type', `diagnosis_${attemptId}`);
            const { error: insertErr } = await supabase.from('ai_jobs').insert({
                quiz_id: attempt.quiz_id,
                job_type: `diagnosis_${attemptId}`,
                status: 'completed',
                output_payload: { diagnosis: recommendationHtml },
                finished_at: new Date().toISOString()
            });
            console.log(`[AI-Rec] Cache save for ${attemptId}:`, insertErr ? `FAILED: ${insertErr.message}` : 'OK');

            // 3. Đẩy gợi ý ra ngoài Dashboard cho người dùng xem
            if (attempt.user_id) {
                // Rút trích câu đầu tiên của chuỗi Markdown để làm tiêu đề ngắn
                const firstLine = recommendationHtml.split('\n').find(line => line.trim().length > 10) || "Gợi ý ôn tập từ hệ thống AI";
                const cleanTitle = firstLine.replace(/[*#>`]/g, '').trim();
                
                await supabase.from('study_recommendations').insert({
                    user_id: attempt.user_id,
                    recommendation_text: cleanTitle.length > 100 ? cleanTitle.substring(0, 97) + '...' : cleanTitle,
                    reason: "Hãy xem chi tiết phân tích lỗ hổng kiến thức trong Lịch sử làm bài thi của bạn."
                });
            }
        }

        return NextResponse.json({ success: true, recommendation: recommendationHtml });

    } catch (error: any) {
        console.error("AI Recommendation Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
