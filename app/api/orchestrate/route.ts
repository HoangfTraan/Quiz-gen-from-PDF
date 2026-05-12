import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createStaticClient } from '@supabase/supabase-js';
import { generateJSON } from '@/utils/ai/provider';
import pdfParse from 'pdf-parse';

async function processDocument(documentId: string, accessToken: string, refreshToken: string, questionCount: number = 20, bloomLevels: string[] = []) {
    // Khởi tạo Supabase client có khả năng tự động refresh token trong memory
    const supabase = createStaticClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: { 
                autoRefreshToken: true, 
                persistSession: false 
            }
        }
    );
    
    // Bơm phiên làm việc vào memory để client tự gia hạn nếu chạy quá 1 tiếng
    if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    }
    try {
        // Step 1: Extract
        const { data: doc } = await supabase.from('documents').select('*').eq('id', documentId).single();
        if (!doc) return;

        const { data: existingContents } = await supabase.from('document_contents').select('id, summary').eq('document_id', documentId);
        const hasContent = existingContents && existingContents.length > 0;
        const hasSummary = hasContent && !!existingContents[0].summary;

        if (!hasContent) {
            await supabase.from('documents').update({ status: 'processing' }).eq('id', documentId);
            const { data: fileData } = await supabase.storage.from('documents').download(doc.file_path);
            if (fileData) {
                const buffer = Buffer.from(await fileData.arrayBuffer());
                let rawText = '';
                const fileNameLower = doc.file_name.toLowerCase();

                if (fileNameLower.endsWith('.pdf')) {
                    const pdfData = await pdfParse(buffer);
                    rawText = pdfData.text;
                } else if (fileNameLower.endsWith('.txt')) {
                    rawText = buffer.toString('utf-8');
                } else {
                    throw new Error("Hiện tại hệ thống AI chỉ hỗ trợ trích xuất chữ viết tay từ tài liệu PDF hoặc file TXT thuần túy.");
                }

                const cleanedText = rawText.replace(/\u0000/g, '').replace(/[\r\n]{3,}/g, '\n\n').trim();
                
                if (!cleanedText || cleanedText.length < 50) {
                    throw new Error("Không thể trích xuất văn bản từ tài liệu này. Xin đảm bảo file không rỗng và chứa chữ viết (không phải file ảnh scan).");
                }

                await supabase.from('document_contents').delete().eq('document_id', documentId);
                await supabase.from('document_contents').insert({ document_id: documentId, raw_text: rawText, cleaned_text: cleanedText });
            }
        }

        // Step 2: Chunk
        const { data: existingChunks } = await supabase.from('document_chunks').select('id').eq('document_id', documentId);
        const hasChunks = existingChunks && existingChunks.length > 0;

        if (!hasChunks) {
            const { data: content } = await supabase.from('document_contents').select('cleaned_text').eq('document_id', documentId).single();
            if (content && content.cleaned_text) {
                const text = content.cleaned_text;
                const chunkSize = 1500; const overlap = 200;
                let chunks = []; let startIndex = 0; let index = 1;
                while (startIndex < text.length) {
                    let endIndex = startIndex + chunkSize;
                    if (endIndex < text.length) {
                        const spaceIndex = text.lastIndexOf(' ', endIndex);
                        const newlineIndex = text.lastIndexOf('\n', endIndex);
                        let candidateEndIndex = newlineIndex > startIndex + chunkSize / 2 ? newlineIndex : spaceIndex;
                        
                        // Prevent infinite/micro loops: Ensure the cut advances at least half the chunk size.
                        // If no good space/newline is found, hard cut at `endIndex`.
                        if (candidateEndIndex > startIndex + chunkSize / 2) {
                            endIndex = candidateEndIndex;
                        }
                    }
                    // Safety check to absolutely prevent infinite loops via fallback regression
                    if (endIndex <= startIndex) endIndex = startIndex + chunkSize;

                    chunks.push({ document_id: documentId, chunk_index: index, title: `Phần ${index}`, content: text.substring(startIndex, endIndex).trim() });
                    startIndex = endIndex - overlap;
                    index++;
                }
                await supabase.from('document_chunks').delete().eq('document_id', documentId).throwOnError();
                await supabase.from('document_chunks').insert(chunks).throwOnError();
            }
        }

        // Step 3: Summarize
        const { data: existingQuiz } = await supabase.from('quizzes').select('id').eq('document_id', documentId).maybeSingle().throwOnError();
        let qId = existingQuiz?.id;
        console.log(`[Orchestrate ${documentId}] Step 3: hasSummary=${hasSummary}, existingQuizId=${qId}`);

        if (!hasSummary) {
            const { data: chunks } = await supabase.from('document_chunks').select('content').eq('document_id', documentId).limit(3);
            if (chunks && chunks.length > 0) {
                const previewText = chunks.map(c => c.content).join('\n\n');
                const prompt = `Đọc phần đầu của tài liệu sau và trả về ĐÚNG ĐỊNH DẠNG JSON.\n{"summary": "Tóm tắt khoảng 2-3 câu", "keywords": ["Từ khóa 1", "Từ khóa 2"]}\nNội dung:\n"""${previewText}\n"""`;

                const { data: aiData, source } = await generateJSON(
                    prompt,
                    'Bạn là một chuyên gia phân tích dữ liệu. Trả về JSON chuẩn.'
                );
                console.log(`[Orchestrate ${documentId}] Summary by ${source}:`, aiData.summary?.substring(0, 50));

                await supabase.from('document_contents').update({ summary: aiData.summary, keywords: aiData.keywords }).eq('document_id', documentId);
            }
        }

        // Ensure quiz record exists (separated from summarize to handle edge cases)
        if (!qId) {
            // Get keywords for title
            const { data: contentData } = await supabase.from('document_contents').select('keywords').eq('document_id', documentId).single();
            const keywords = contentData?.keywords || [];
            
            await supabase.from('quizzes').delete().eq('document_id', documentId);
            const { data: quiz, error: quizError } = await supabase.from('quizzes').insert({
                document_id: documentId, user_id: doc.user_id, title: `Bộ đề trắc nghiệm: ${keywords[0] || 'Tài liệu mới'}`, status: 'draft'
            }).select().single();
            
            if (quizError) {
                console.error(`[Orchestrate ${documentId}] QUIZ CREATE FAILED:`, quizError);
                throw new Error("Không thể tạo bộ đề: " + quizError.message);
            }
            qId = quiz?.id;
            console.log(`[Orchestrate ${documentId}] Quiz created: ${qId}`);
        }

        // Step 4: Generate
        const { data: chunks } = await supabase.from('document_chunks').select('id, content').eq('document_id', documentId).order('chunk_index', { ascending: true });
        
        // Limit chunks to avoid extremely long runs (24min+ can exhaust tokens)
        const MAX_CHUNKS = 50;
        const availableChunks = chunks ? chunks.slice(0, MAX_CHUNKS) : [];
        
        // Calculate how many chunks to process and questions per chunk based on user's desired total
        const questionsPerChunk = Math.max(1, Math.min(5, Math.ceil(questionCount / Math.max(availableChunks.length, 1))));
        const chunksNeeded = Math.ceil(questionCount / questionsPerChunk);
        const chunksToProcess = availableChunks.slice(0, chunksNeeded);
        
        console.log(`[Orchestrate ${documentId}] Step 4: ${chunks?.length || 0} total chunks, processing ${chunksToProcess.length} (${questionsPerChunk} q/chunk, target ${questionCount}), qId=${qId}`);
        
        // Fetch negative samples for the feedback loop to improve quality
        const { data: badSamples } = await supabase
            .from('questions')
            .select('question_text')
            .in('moderation_status', ['flagged', 'error'])
            .limit(5);
        
        const negativeExamples = badSamples && badSamples.length > 0
            ? "\n\nLƯU Ý QUAN TRỌNG (Tránh lặp lại các lỗi sau từ lịch sử):\n" + badSamples.map(q => `- TRÁNH: ${q.question_text}`).join('\n')
            : "";

        let totalInserted = 0;
        if (chunksToProcess.length > 0 && qId) {
            // Lấy toàn bộ các câu hỏi đã được tạo trước đó của bộ đề này để tạo Set tra cứu nhanh trong RAM (tránh loop DB)
            const { data: existingQuizQs } = await supabase
                .from('questions')
                .select('document_chunk_id')
                .eq('quiz_id', qId);
            const chunksWithQuestions = new Set(existingQuizQs?.map(q => q.document_chunk_id).filter(Boolean));

            for (let i = 0; i < chunksToProcess.length; i++) {
                // Check cancel
                const { data: currentDoc } = await supabase.from('documents').select('status').eq('id', documentId).single();
                if (currentDoc?.status === 'failed') return;
                
                // Tra cứu trực tiếp trong RAM bằng Set, giảm hàng chục lượt truy cập DB thắt cổ chai
                const hasGen = chunksWithQuestions.has(chunksToProcess[i].id);
                
                if (!hasGen) {
                    // Stop early if we've reached the target
                    if (totalInserted >= questionCount) {
                         console.log(`[Orchestrate ${documentId}] Target reached (${totalInserted}/${questionCount}), stopping`);
                         break;
                    }
                    try {
                        const remaining = questionCount - totalInserted;
                        const qPerThisChunk = Math.min(questionsPerChunk, remaining);
                        const bloomInstruction = bloomLevels.length > 0
                          ? `1. TẤT CẢ câu hỏi PHẢI thuộc các cấp độ Bloom sau: ${bloomLevels.join(', ')}. KHÔNG ĐƯỢC tạo câu hỏi ở cấp độ khác.`
                          : `1. Các câu hỏi cần được phân bổ đa dạng dựa theo Thang đo Bloom (Bloom's Taxonomy) bao gồm nhiều cấp độ: Nhớ (Remember), Hiểu (Understand), Vận dụng (Apply), Phân tích (Analyze), Đánh giá (Evaluate), Sáng tạo (Create).`;
                        const prompt = `Nhiệm vụ: Đọc kỹ đoạn nội dung sau và tạo ra ${qPerThisChunk} câu hỏi trắc nghiệm bám sát kiến thức trong bài.
Yêu cầu:
${bloomInstruction}
2. Câu hỏi phải rõ nghĩa, không mơ hồ.
${negativeExamples}
TRẢ VỀ ĐÚNG ĐỊNH ĐẠNG JSON sau: 
{
  "questions": [ 
    {
      "question_text": "Câu hỏi...", 
      "options": ["A", "B", "C", "D"], 
      "correct_index": 0, 
      "explanation": "Giải thích chi tiết",
      "difficulty": "Chọn 1 trong: [Nhớ, Hiểu, Vận dụng, Phân tích, Đánh giá, Sáng tạo]"
    } 
  ] 
}

Nội dung đoạn trích:
"""
${chunksToProcess[i].content}
"""`;
                        const { data: aiData, source } = await generateJSON(
                            prompt,
                            'Bạn là một chuyên gia giáo dục và thầy giáo ra đề đánh giá năng lực chuyên nghiệp. Phải gán đúng mức độ Bloom Taxonomy cho mỗi câu hỏi.'
                        );

                        const BLOOM_LEVELS = ["Nhớ", "Hiểu", "Vận dụng", "Phân tích", "Đánh giá", "Sáng tạo"];
                        const guessBloomLevel = (text: string, explanation: string) => {
                            const lower = (text + " " + explanation).toLowerCase();
                            if (lower.includes("sáng tạo") || lower.includes("thiết kế") || lower.includes("xây dựng")) return "Sáng tạo";
                            if (lower.includes("đánh giá") || lower.includes("nhận xét") || lower.includes("phê bình")) return "Đánh giá";
                            if (lower.includes("phân tích") || lower.includes("tại sao") || lower.includes("so sánh")) return "Phân tích";
                            if (lower.includes("vận dụng") || lower.includes("giải quyết") || lower.includes("tính toán")) return "Vận dụng";
                            if (lower.includes("hiểu") || lower.includes("giải thích") || lower.includes("mô tả")) return "Hiểu";
                            return "Nhớ";
                        };

                        // 1. Chuẩn bị danh sách câu hỏi để chèn hàng loạt (Batch Insert)
                        const questionsToInsert = aiData.questions.map((q: any) => {
                            let diff = q.difficulty;
                            if (!diff || !BLOOM_LEVELS.some(l => diff.includes(l))) {
                               diff = guessBloomLevel(q.question_text, q.explanation || "");
                            }
                            // Nếu có bloom filter, ép difficulty vào cấp độ được chọn
                            if (bloomLevels.length > 0 && !bloomLevels.includes(diff)) {
                               diff = bloomLevels[Math.floor(Math.random() * bloomLevels.length)];
                            }
                            const difficultyTag = `[MỨC ĐỘ: ${diff.toUpperCase()}] `;

                            return {
                               quiz_id: qId,
                               document_chunk_id: chunksToProcess[i].id,
                               question_text: q.question_text,
                               question_type: 'mcq',
                               explanation: difficultyTag + (q.explanation || ''),
                               difficulty: diff,
                               ai_generated: true,
                               quality_score: 100
                            };
                        });

                        // Chèn tất cả câu hỏi của mảnh hiện tại trong 1 truy vấn duy nhất
                        const { data: dbQuestions, error: qInsertErr } = await supabase
                            .from('questions')
                            .insert(questionsToInsert)
                            .select();

                        if (qInsertErr) {
                           console.error(`[Orchestrate ${documentId}] QUESTIONS INSERT FAILED:`, qInsertErr);
                           if (totalInserted === 0) {
                              throw new Error("Không thể lưu câu hỏi: " + qInsertErr.message);
                           }
                           continue;
                        }

                        // 2. Chèn toàn bộ phương án tương ứng trong 1 truy vấn duy nhất
                        if (dbQuestions && dbQuestions.length > 0) {
                           const optionsToInsert: any[] = [];
                           dbQuestions.forEach((dbQ: any, idx: number) => {
                              const originalQ = aiData.questions[idx];
                              if (originalQ) {
                                 const chunkOptions = originalQ.options.map((optText: string, oIdx: number) => ({
                                    question_id: dbQ.id,
                                    option_text: optText,
                                    is_correct: oIdx === originalQ.correct_index,
                                    option_label: ['A', 'B', 'C', 'D'][oIdx] || ''
                                 }));
                                 optionsToInsert.push(...chunkOptions);
                              }
                           });

                           if (optionsToInsert.length > 0) {
                              const { error: optErr } = await supabase.from('question_options').insert(optionsToInsert);
                              if (optErr) console.error(`[Orchestrate ${documentId}] Options insert error:`, optErr);
                           }
                           totalInserted += dbQuestions.length;
                        }

                        console.log(`[Orchestrate ${documentId}] Chunk ${i+1}/${chunksToProcess.length} (${source}): ${aiData.questions?.length || 0} generated, ${totalInserted} total saved`);
                    } catch (chunkErr: any) {
                        console.error(`[Orchestrate ${documentId}] Chunk ${i+1} error:`, chunkErr.message);
                        // If it's a DB insert error, re-throw to fail fast
                        if (chunkErr.message?.includes('Không thể lưu')) throw chunkErr;
                        // Otherwise (AI error), skip this chunk and continue
                    }
                } else {
                    totalInserted++;
                    console.log(`[Orchestrate ${documentId}] Chunk ${i+1}/${chunksToProcess.length}: already generated, skip`);
                }
            }
        }
        
        console.log(`[Orchestrate ${documentId}] Generation done: ${totalInserted} questions saved`);

        // Step 5: Validate & Complete — only if quiz was actually created
        if (!qId) {
            throw new Error("Pipeline hoàn tất nhưng không có quiz ID");
        }
        
        // Verify questions exist
        const { data: finalQuestions } = await supabase.from('questions').select('id').eq('quiz_id', qId);
        console.log(`[Orchestrate ${documentId}] Step 5: ${finalQuestions?.length || 0} total questions for quiz ${qId}`);
        
        if (!finalQuestions || finalQuestions.length === 0) {
            throw new Error("Không có câu hỏi nào được tạo");
        }
        
        await supabase.from('quizzes').update({ total_questions: finalQuestions.length }).eq('id', qId);
        await supabase.from('documents').update({ status: 'completed' }).eq('id', documentId);
        console.log(`[Orchestrate ${documentId}] COMPLETED`);

    } catch (err: any) {
        console.error("Orchestration error:", err);
        await supabase.from('documents').update({ status: 'failed' }).eq('id', documentId);
    }
}

export async function POST(request: Request) {
    const { documentId, questionCount, bloomLevels } = await request.json();
    if (!documentId) return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
    
    const targetQuestions = Math.max(5, Math.min(200, parseInt(questionCount) || 20));

    const supabase = await createClient();
    const { data: doc } = await supabase.from('documents').select('status').eq('id', documentId).single();
    if (doc?.status === 'completed') {
        // Only skip if quiz actually exists
        const { data: quiz } = await supabase.from('quizzes').select('id').eq('document_id', documentId).single();
        if (quiz) return NextResponse.json({ success: true, message: 'Already completed' });
        // Quiz missing — reset status and reprocess
        await supabase.from('documents').update({ status: 'processing' }).eq('id', documentId);
    }

    // Trích xuất JWT Token và Refresh Token của người dùng
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token || '';
    const refreshToken = sessionData.session?.refresh_token || '';

    const validBloomLevels: string[] = Array.isArray(bloomLevels) ? bloomLevels : [];

    await processDocument(documentId, token, refreshToken, targetQuestions, validBloomLevels);

    return NextResponse.json({ success: true, message: 'Orchestration fully completed' });
}
