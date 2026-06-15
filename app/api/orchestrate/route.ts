import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createStaticClient, SupabaseClient } from '@supabase/supabase-js';
import { generateJSON, generateText } from '@/utils/ai/provider';
import pdfParse from 'pdf-parse';
import { detectChapters, isDefaultChapter } from '@/utils/chapters/detector';
import { extractPageByPage, getPageForPosition } from '@/utils/document/page-extractor';
import { buildQuestionGenerationPrompt, SYSTEM_PROMPT_QUESTION_GENERATOR, QuestionType, ALL_QUESTION_TYPES } from '@/utils/ai/prompts';

// ==========================================
// SUPABASE LONG-RUNNING CLIENT
// ==========================================
// Supabase JWT mặc định hết hạn sau 3600 giây (1 tiếng).
// autoRefreshToken: true dùng internal timer nhưng KHÔNG đáng tin trên server-side
// (có thể bị skip do GC, serverless idle, hoặc edge runtime).
//
// Giải pháp: Manual refresh mỗi 45 phút — chủ động gọi refreshSession()
// thay vì phụ thuộc vào timer tự động.

interface LongRunClientResult {
    client: SupabaseClient;
    cleanup: () => void; // Gọi khi hoàn tất để clear interval
}

async function createLongRunClient(accessToken: string, refreshToken: string): Promise<LongRunClientResult> {
    const client = createStaticClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                autoRefreshToken: true,
                persistSession: false,
                detectSessionInUrl: false,
            }
        }
    );

    // Bơm session vào memory
    if (accessToken && refreshToken) {
        await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    }

    // Manual refresh mỗi 45 phút (trước khi token 1h hết hạn)
    const REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45 phút
    const refreshInterval = setInterval(async () => {
        try {
            console.log('[LongRunClient] Manual token refresh...');
            const { data, error } = await client.auth.refreshSession();
            if (error) {
                console.error('[LongRunClient] Refresh FAILED:', error.message);
            } else {
                console.log('[LongRunClient] Token refreshed OK. New expiry:',
                    data.session?.expires_at
                        ? new Date(data.session.expires_at * 1000).toISOString()
                        : 'unknown'
                );
            }
        } catch (err) {
            console.error('[LongRunClient] Refresh exception:', err);
        }
    }, REFRESH_INTERVAL_MS);

    return {
        client,
        cleanup: () => clearInterval(refreshInterval)
    };
}

// ==========================================
// PHASE 1: PHÂN TÍCH TÀI LIỆU (Extract → Detect Chapters)
// ==========================================

async function analyzeDocument(documentId: string, supabase: any) {
    // Step 1: Lấy thông tin document
    const { data: doc } = await supabase.from('documents').select('*').eq('id', documentId).single();
    if (!doc) throw new Error('Document not found');

    await supabase.from('documents').update({ status: 'processing' }).eq('id', documentId);

    // Step 2: Extract text (kiểm tra đã extract chưa)
    const { data: existingContents } = await supabase
        .from('document_contents')
        .select('id, cleaned_text, summary')
        .eq('document_id', documentId);
    const hasContent = existingContents && existingContents.length > 0;

    let cleanedText = '';

    if (!hasContent) {
        const { data: fileData } = await supabase.storage.from('documents').download(doc.file_path);
        if (!fileData) throw new Error('Failed to download file');

        const buffer = Buffer.from(await fileData.arrayBuffer());
        const fileNameLower = doc.file_name.toLowerCase();
        let rawText = '';
        let totalPages = 1;

        if (fileNameLower.endsWith('.pdf')) {
            // Trích xuất theo từng trang
            const extraction = await extractPageByPage(buffer);
            rawText = extraction.fullText;
            totalPages = extraction.totalPages;
        } else if (fileNameLower.endsWith('.txt')) {
            rawText = buffer.toString('utf-8');
        } else {
            throw new Error('Hệ thống chỉ hỗ trợ PDF và TXT.');
        }

        cleanedText = rawText
            .normalize('NFC')
            .replace(/Ƣ/g, 'Ư')
            .replace(/ƣ/g, 'ư')
            .replace(/\u0000/g, '')
            .replace(/[\r\n]{3,}/g, '\n\n')
            .trim();

        if (!cleanedText || cleanedText.length < 50) {
            throw new Error('Không thể trích xuất văn bản từ tài liệu này.');
        }

        // Lưu total_pages
        await supabase.from('documents').update({ total_pages: totalPages }).eq('id', documentId);

        // Lưu content
        await supabase.from('document_contents').delete().eq('document_id', documentId);
        await supabase.from('document_contents').insert({
            document_id: documentId,
            raw_text: rawText,
            cleaned_text: cleanedText
        });
    } else {
        cleanedText = existingContents[0].cleaned_text || '';
    }

    // Step 3: Detect Chapters (kiểm tra đã detect chưa)
    const { data: existingChapters } = await supabase
        .from('chapters')
        .select('id')
        .eq('document_id', documentId);

    if (!existingChapters || existingChapters.length === 0) {
        console.log(`[Orchestrate/${documentId}] Detecting chapters...`);

        const chapters = await detectChapters(cleanedText);
        const isDefault = isDefaultChapter(chapters);

        console.log(`[Orchestrate/${documentId}] Found ${chapters.length} chapters (default=${isDefault}). Generating AI summaries concurrently...`);

        // Lưu chapters vào DB kèm tóm tắt AI song song
        const chaptersToInsert = await Promise.all(chapters.map(async (ch) => {
            let summary = '';
            const previewText = ch.content ? ch.content.substring(0, 2500).trim() : '';

            if (previewText) {
                const prompt = `Viết một đoạn tóm tắt ngắn gọn và súc tích (khoảng 2-3 câu bằng Tiếng Việt) phản ánh nội dung chính của chương sau đây. Không thêm bất kỳ lời bình luận hay giải thích nào khác.\n\nTên chương: ${ch.title}\n\nNội dung chương:\n"""\n${previewText}\n"""`;
                try {
                    const { text } = await generateText(
                        prompt,
                        'Bạn là một trợ lý giáo dục chuyên nghiệp. Viết tóm tắt chương ngắn gọn, súc tích bằng Tiếng Việt.'
                    );
                    summary = text.trim();
                } catch (err) {
                    console.error(`[Orchestrate/${documentId}] Failed to generate summary for chapter ${ch.index}:`, err);
                    // Fallback to text excerpt
                    summary = ch.content
                        ? ch.content.substring(0, 180).replace(/[\r\n]+/g, ' ').trim() + '...'
                        : '';
                }
            } else {
                summary = 'Không có nội dung để tóm tắt.';
            }

            return {
                document_id: documentId,
                chapter_index: ch.index,
                title: ch.title,
                content: ch.content,
                summary: summary,
                start_position: ch.startPosition,
                end_position: ch.endPosition,
                detection_method: ch.detectionMethod,
                metadata: {
                    ...(ch.metadata || {}),
                    ...(isDefault ? { is_default: true, notice: 'Tài liệu không có cấu trúc chương rõ ràng' } : {})
                }
            };
        }));

        await supabase.from('chapters').delete().eq('document_id', documentId);
        await supabase.from('chapters').insert(chaptersToInsert);
    }

    // Step 4: Tóm tắt (nếu chưa có)
    const hasSummary = hasContent && !!existingContents[0].summary;
    if (!hasSummary) {
        const previewText = cleanedText.substring(0, 5000);
        const prompt = `Đọc phần đầu của tài liệu sau và trả về ĐÚNG ĐỊNH DẠNG JSON.\n{"summary": "Tóm tắt khoảng 2-3 câu", "keywords": ["Từ khóa 1", "Từ khóa 2"]}\nNội dung:\n"""${previewText}\n"""`;

        try {
            const { data: aiData } = await generateJSON(
                prompt,
                'Bạn là một chuyên gia phân tích dữ liệu. Trả về JSON chuẩn.'
            );
            await supabase.from('document_contents').update({
                summary: aiData.summary,
                keywords: aiData.keywords
            }).eq('document_id', documentId);
        } catch (err) {
            console.error(`[Orchestrate/${documentId}] Summary error:`, err);
            // Không throw — summary không bắt buộc
        }
    }

    // Step 5: Cập nhật status = 'analyzed'
    await supabase.from('documents').update({ status: 'analyzed' }).eq('id', documentId);
    console.log(`[Orchestrate/${documentId}] Phase 1 COMPLETED — status = analyzed`);
}

// ==========================================
// PHASE 2: TẠO CÂU HỎI TỪ CHƯƠNG ĐÃ CHỌN
// ==========================================

async function generateQuestionsFromChapters(
    documentId: string,
    selectedChapterIds: string[],
    questionCount: number,
    bloomLevels: string[],
    questionTypes: QuestionType[],
    supabase: any,
    selectedSections?: Record<string, string[]>
) {
    await supabase.from('documents').update({ status: 'processing' }).eq('id', documentId);

    const { data: doc } = await supabase.from('documents').select('title, user_id').eq('id', documentId).single();
    if (!doc) throw new Error('Document not found');

    // Lấy chapters đã chọn
    const { data: selectedChapters } = await supabase
        .from('chapters')
        .select('id, chapter_index, title, content')
        .in('id', selectedChapterIds)
        .order('chapter_index', { ascending: true });

    if (!selectedChapters || selectedChapters.length === 0) {
        throw new Error('Không tìm thấy chương nào được chọn.');
    }

    // Đếm tổng chapters của document
    const { count: totalChapterCount } = await supabase
        .from('chapters')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', documentId);

    // Tạo quiz nếu chưa có
    const { data: existingQuiz } = await supabase
        .from('quizzes')
        .select('id')
        .eq('document_id', documentId)
        .maybeSingle();

    let quizId = existingQuiz?.id;

    if (!quizId) {
        const { data: contentData } = await supabase
            .from('document_contents')
            .select('keywords')
            .eq('document_id', documentId)
            .single();

        const keywords = contentData?.keywords || [];
        await supabase.from('quizzes').delete().eq('document_id', documentId);

        const { data: quiz, error: quizError } = await supabase.from('quizzes').insert({
            document_id: documentId,
            user_id: doc.user_id,
            title: `Bộ đề trắc nghiệm: ${keywords[0] || doc.title || 'Tài liệu mới'}`,
            status: 'draft'
        }).select().single();

        if (quizError) throw new Error('Không thể tạo bộ đề: ' + quizError.message);
        quizId = quiz?.id;
    }

    // Chunk nội dung từng chương và tạo câu hỏi
    const CHUNK_SIZE = 3000; // 3000 ký tự per chunk
    const OVERLAP = 300;
    let totalInserted = 0;

    // Lấy negative examples cho feedback loop
    const { data: badSamples } = await supabase
        .from('questions')
        .select('question_text')
        .in('moderation_status', ['flagged', 'error'])
        .order('created_at', { ascending: false })
        .limit(20); //trích xuất tối đa 20 câu hỏi bị lỗi để đưa vào Prompt, hệ thống sẽ luôn chọn ra 20 câu hỏi bị lỗi MỚI NHẤT

    const negativeExamples = badSamples && badSamples.length > 0
        ? badSamples.map((q: any) => `- TRÁNH: ${q.question_text}`).join('\n')
        : '';

    // Tính số câu hỏi cần tạo cho mỗi chương
    const questionsPerChapter = Math.max(1, Math.ceil(questionCount / selectedChapters.length));

    for (const chapter of selectedChapters) {
        if (!chapter.content) continue;

        // Check cancel
        const { data: currentDoc } = await supabase.from('documents').select('status').eq('id', documentId).single();
        if (currentDoc?.status === 'failed') return;

        // Chunk nội dung chương
        const chapterChunks: { content: string; index: number }[] = [];
        let startIndex = 0;
        let chunkIdx = 1;
        const text = chapter.content;

        while (startIndex < text.length) {
            let endIndex = startIndex + CHUNK_SIZE;
            if (endIndex < text.length) {
                const newlineIdx = text.lastIndexOf('\n', endIndex);
                const spaceIdx = text.lastIndexOf(' ', endIndex);
                const candidateEnd = newlineIdx > startIndex + CHUNK_SIZE / 2 ? newlineIdx : spaceIdx;
                if (candidateEnd > startIndex + CHUNK_SIZE / 2) {
                    endIndex = candidateEnd;
                }
            }
            if (endIndex <= startIndex) endIndex = startIndex + CHUNK_SIZE;

            chapterChunks.push({
                content: text.substring(startIndex, endIndex).trim(),
                index: chunkIdx
            });

            startIndex = endIndex - OVERLAP;
            chunkIdx++;
        }

        // Lưu chunks vào DB với chapter_id
        const chunksToInsert = chapterChunks.map(c => ({
            document_id: documentId,
            chapter_id: chapter.id,
            chunk_index: c.index,
            title: `${chapter.title} - Phần ${c.index}`,
            content: c.content
        }));

        // Xóa chunks cũ của chương này
        await supabase.from('document_chunks').delete().eq('chapter_id', chapter.id);
        const { data: dbChunks } = await supabase.from('document_chunks').insert(chunksToInsert).select();

        if (!dbChunks) continue;

        // Tính số câu hỏi per chunk trong chương này
        const chapterQuestionsRemaining = Math.min(questionsPerChapter, questionCount - totalInserted);
        // Phân bổ đều cho các chunk, nhưng KHÔNG cap cứng — sẽ loop nhiều lần nếu cần
        const qPerChunk = Math.max(1, Math.ceil(chapterQuestionsRemaining / chapterChunks.length));

        // Giới hạn AI: mỗi lần gọi tối đa 10 câu (AI quality tốt nhất ở 5-10 câu/lần)
        const AI_BATCH_SIZE = 10;
        // Tối đa 10 lần gọi AI cho cùng 1 chunk (giúp tăng cơ hội tạo đủ câu hỏi cho tài liệu ngắn)
        const MAX_PASSES_PER_CHUNK = 10;

        // Tạo câu hỏi cho từng chunk
        for (let ci = 0; ci < dbChunks.length; ci++) {
            if (totalInserted >= questionCount) break;

            // Check cancel
            const { data: cancelCheck } = await supabase.from('documents').select('status').eq('id', documentId).single();
            if (cancelCheck?.status === 'failed') return;

            // Số câu hỏi cần tạo cho chunk này
            const targetForChunk = Math.min(qPerChunk, questionCount - totalInserted);
            let chunkInserted = 0;
            let passCount = 0;

            // Multi-pass: gọi AI nhiều lần cho cùng 1 chunk nếu cần nhiều câu hỏi
            while (chunkInserted < targetForChunk && passCount < MAX_PASSES_PER_CHUNK) {
                passCount++;
                const remaining = Math.min(targetForChunk - chunkInserted, questionCount - totalInserted);
                if (remaining <= 0) break;

                // Mỗi lần gọi AI tối đa AI_BATCH_SIZE câu
                const qForThisPass = Math.min(AI_BATCH_SIZE, remaining);

                try {
                    const prompt = buildQuestionGenerationPrompt({
                        documentTitle: doc.title,
                        chapterTitle: chapter.title,
                        chapterIndex: chapter.chapter_index,
                        totalChapters: totalChapterCount || selectedChapters.length,
                        chunkIndex: ci + 1,
                        totalChunksInChapter: dbChunks.length,
                        chunkContent: chapterChunks[ci].content,
                        questionCount: qForThisPass,
                        questionTypes: questionTypes.length > 0 ? questionTypes : ['mcq'],
                        bloomLevels,
                        negativeExamples: negativeExamples + (passCount > 1 ? `\n\nLƯU Ý: Đây là lần tạo thứ ${passCount} cho cùng nội dung. Hãy tạo câu hỏi KHÁC BIỆT hoàn toàn so với những lần trước, tập trung vào các khía cạnh chưa được hỏi.` : ''),
                        selectedSections: selectedSections ? selectedSections[chapter.id] : undefined
                    });

                    const { data: aiData, source } = await generateJSON(
                        prompt,
                        SYSTEM_PROMPT_QUESTION_GENERATOR
                    );

                    if (!aiData.questions || !Array.isArray(aiData.questions) || aiData.questions.length === 0) {
                        console.warn(`[Orchestrate/${documentId}] Pass ${passCount}: AI returned no questions, stopping chunk`);
                        break; // AI hết ý tưởng → dừng chunk này
                    }

                    // Giới hạn số câu hỏi
                    const globalRemaining = questionCount - totalInserted;
                    const questions = aiData.questions.slice(0, Math.min(globalRemaining, targetForChunk - chunkInserted));

                    const BLOOM_LEVELS = ['Nhớ', 'Hiểu', 'Vận dụng', 'Phân tích', 'Đánh giá', 'Sáng tạo'];
                    const guessBloomLevel = (text: string, explanation: string) => {
                        const lower = (text + ' ' + explanation).toLowerCase();
                        if (lower.includes('sáng tạo') || lower.includes('thiết kế') || lower.includes('xây dựng')) return 'Sáng tạo';
                        if (lower.includes('đánh giá') || lower.includes('nhận xét') || lower.includes('phê bình')) return 'Đánh giá';
                        if (lower.includes('phân tích') || lower.includes('tại sao') || lower.includes('so sánh')) return 'Phân tích';
                        if (lower.includes('vận dụng') || lower.includes('giải quyết') || lower.includes('tính toán')) return 'Vận dụng';
                        if (lower.includes('hiểu') || lower.includes('giải thích') || lower.includes('mô tả')) return 'Hiểu';
                        return 'Nhớ';
                    };

                    // Batch insert câu hỏi
                    const questionsToInsert = questions.map((q: any) => {
                        let diff = q.difficulty;
                        if (!diff || !BLOOM_LEVELS.some(l => diff?.includes(l))) {
                            diff = guessBloomLevel(q.question_text, q.explanation || '');
                        }
                        if (bloomLevels.length > 0 && !bloomLevels.includes(diff)) {
                            diff = bloomLevels[Math.floor(Math.random() * bloomLevels.length)];
                        }

                        const qType = q.question_type || 'mcq';
                        const validTypes: string[] = ALL_QUESTION_TYPES;
                        const finalType = validTypes.includes(qType) ? qType : 'mcq';

                        return {
                            quiz_id: quizId,
                            document_chunk_id: dbChunks[ci].id,
                            question_text: q.question_text,
                            question_type: finalType,
                            explanation: `[MỨC ĐỘ: ${diff.toUpperCase()}] ${q.explanation || ''}`,
                            difficulty: diff,
                            ai_generated: true,
                            quality_score: 100
                        };
                    });

                    const { data: dbQuestions, error: qErr } = await supabase
                        .from('questions')
                        .insert(questionsToInsert)
                        .select();

                    if (qErr) {
                        console.error(`[Orchestrate/${documentId}] Questions insert error:`, qErr);
                        if (totalInserted === 0) throw new Error('Không thể lưu câu hỏi: ' + qErr.message);
                        break;
                    }

                    // Batch insert options
                    if (dbQuestions && dbQuestions.length > 0) {
                        const optionsToInsert: any[] = [];

                        dbQuestions.forEach((dbQ: any, idx: number) => {
                            const originalQ = questions[idx];
                            if (!originalQ) return;

                            const qType = dbQ.question_type;

                            if (qType === 'mcq' || qType === 'true_false' || qType === 'multi_select') {
                                const opts = originalQ.options || [];
                                opts.forEach((optText: string, oIdx: number) => {
                                    let isCorrect = false;
                                    if (qType === 'multi_select') {
                                        isCorrect = originalQ.correct_indexes?.includes(oIdx) ?? false;
                                    } else {
                                        isCorrect = oIdx === originalQ.correct_index;
                                    }

                                    optionsToInsert.push({
                                        question_id: dbQ.id,
                                        option_text: optText,
                                        is_correct: isCorrect,
                                        option_label: ['A', 'B', 'C', 'D', 'E'][oIdx] || ''
                                    });
                                });
                            } else if (qType === 'fill_blank' || qType === 'short_answer') {
                                optionsToInsert.push({
                                    question_id: dbQ.id,
                                    option_text: originalQ.correct_answer || '',
                                    is_correct: true,
                                    option_label: 'answer'
                                });
                            } else if (qType === 'matching') {
                                const pairs = originalQ.matching_pairs || [];
                                pairs.forEach((pair: any, pIdx: number) => {
                                    optionsToInsert.push({
                                        question_id: dbQ.id,
                                        option_text: JSON.stringify(pair),
                                        is_correct: true,
                                        option_label: `pair_${pIdx + 1}`
                                    });
                                });
                            }
                        });

                        if (optionsToInsert.length > 0) {
                            const { error: optErr } = await supabase.from('question_options').insert(optionsToInsert);
                            if (optErr) console.error(`[Orchestrate/${documentId}] Options error:`, optErr);
                        }

                        totalInserted += dbQuestions.length;
                        chunkInserted += dbQuestions.length;
                    }

                    console.log(`[Orchestrate/${documentId}] Chapter "${chapter.title}" chunk ${ci + 1}/${dbChunks.length} pass ${passCount} (${source}): ${questions.length} generated, ${chunkInserted}/${targetForChunk} chunk, ${totalInserted}/${questionCount} total`);
                } catch (chunkErr: any) {
                    console.error(`[Orchestrate/${documentId}] Chunk error:`, chunkErr.message);
                    if (chunkErr.message?.includes('Không thể lưu')) throw chunkErr;
                    break; // Lỗi → dừng chunk này, tiếp tục chunk tiếp theo
                }
            }
        }
    }

    // Finalize
    if (quizId) {
        const { data: finalQuestions } = await supabase.from('questions').select('id').eq('quiz_id', quizId);
        const totalQ = finalQuestions?.length || 0;

        if (totalQ === 0) throw new Error('Không có câu hỏi nào được tạo');

        await supabase.from('quizzes').update({ total_questions: totalQ }).eq('id', quizId);
    }

    await supabase.from('documents').update({ status: 'completed' }).eq('id', documentId);
    console.log(`[Orchestrate/${documentId}] Phase 2 COMPLETED — ${totalInserted} questions generated`);
}

// ==========================================
// POST HANDLER
// ==========================================

export async function POST(request: Request) {
    const body = await request.json();
    const { documentId, phase, questionCount, bloomLevels, selectedChapterIds, questionTypes, selectedSections } = body;

    if (!documentId) return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });

    const supabase = await createClient();

    // Lấy session tokens từ cookie-based server client
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token || '';
    const refreshToken = sessionData.session?.refresh_token || '';

    // Tạo long-running client có manual refresh mỗi 45 phút
    // Đảm bảo token không hết hạn ngay cả khi quá trình chạy > 1 tiếng
    const { client: longRunClient, cleanup } = await createLongRunClient(accessToken, refreshToken);

    try {
        const requestedPhase = phase || 'analyze';

        if (requestedPhase === 'analyze') {
            await analyzeDocument(documentId, longRunClient);
            cleanup(); // Clear refresh interval
            return NextResponse.json({ success: true, phase: 'analyze', message: 'Phân tích tài liệu hoàn tất' });
        }

        if (requestedPhase === 'generate') {
            const targetQuestions = Math.max(5, Math.min(200, parseInt(questionCount) || 20));
            const validBloomLevels: string[] = Array.isArray(bloomLevels) ? bloomLevels : [];
            const validQuestionTypes: QuestionType[] = Array.isArray(questionTypes) ? questionTypes : ['mcq'];

            if (!selectedChapterIds || !Array.isArray(selectedChapterIds) || selectedChapterIds.length === 0) {
                const { data: allChapters } = await longRunClient
                    .from('chapters')
                    .select('id')
                    .eq('document_id', documentId);
                const allIds = allChapters?.map((c: any) => c.id) || [];

                if (allIds.length === 0) {
                    cleanup();
                    return NextResponse.json({ error: 'Chưa phân tích chương. Vui lòng chạy phase analyze trước.' }, { status: 400 });
                }

                await generateQuestionsFromChapters(documentId, allIds, targetQuestions, validBloomLevels, validQuestionTypes, longRunClient, selectedSections);
            } else {
                await generateQuestionsFromChapters(documentId, selectedChapterIds, targetQuestions, validBloomLevels, validQuestionTypes, longRunClient, selectedSections);
            }

            cleanup(); // Clear refresh interval
            return NextResponse.json({ success: true, phase: 'generate', message: 'Tạo câu hỏi hoàn tất' });
        }

        cleanup();
        return NextResponse.json({ error: 'Invalid phase. Use "analyze" or "generate".' }, { status: 400 });
    } catch (err: any) {
        console.error('[Orchestrate] Error:', err);
        await longRunClient.from('documents').update({ status: 'failed' }).eq('id', documentId);
        cleanup(); // Luôn clear interval kể cả lỗi
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
