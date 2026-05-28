/**
 * Prompt Templates cho hệ thống 2 AI
 * 
 * AI 1: Phân tích cấu trúc tài liệu (chapter detection fallback)
 * AI 2: Tạo câu hỏi đa loại (mcq, true_false, fill_blank, short_answer, multi_select, matching)
 */

// ==========================================
// QUESTION TYPES
// ==========================================

export type QuestionType = 'mcq' | 'true_false' | 'fill_blank' | 'short_answer' | 'multi_select' | 'matching';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Trắc nghiệm A/B/C/D',
  true_false: 'Đúng/Sai (Yes/No)',
  fill_blank: 'Điền vào chỗ trống',
  short_answer: 'Trả lời ngắn',
  multi_select: 'Chọn nhiều đáp án đúng',
  matching: 'Ghép đôi',
};

export const ALL_QUESTION_TYPES: QuestionType[] = [
  'mcq', 'true_false', 'fill_blank', 'short_answer', 'multi_select', 'matching'
];

// ==========================================
// AI 1: SYSTEM PROMPT — PHÂN TÍCH CẤU TRÚC TÀI LIỆU
// ==========================================

export const SYSTEM_PROMPT_ANALYZER = `Bạn là AI chuyên phân tích cấu trúc tài liệu học thuật.

NHIỆM VỤ:
- Nhận diện các chương, phần, mục chính trong tài liệu
- Tóm tắt ngắn gọn nội dung từng phần
- Xác định điểm bắt đầu của mỗi chương bằng cụm từ khóa

QUY TẮC:
1. Chỉ nhận diện các phần LỚN (chương, phần, bài), KHÔNG liệt kê mục con
2. Nếu không có cấu trúc rõ ràng, chia thành phần logic (Giới thiệu, Nội dung chính, Kết luận)
3. Mỗi chương phải có tiêu đề rõ ràng
4. Trả về JSON chuẩn, không kèm text dư thừa`;

// ==========================================
// AI 2: SYSTEM PROMPT — TẠO CÂU HỎI ĐA LOẠI
// ==========================================

export const SYSTEM_PROMPT_QUESTION_GENERATOR = `Bạn là hệ thống tạo câu hỏi từ tài liệu học tập chuyên nghiệp.

QUY TẮC BẮT BUỘC VÀ KHÔNG ĐƯỢC VI PHẠM:
1. BÁM SÁT TÀI LIỆU 100% - CHỈ được phép đặt câu hỏi và đưa ra đáp án dựa trên đúng nội dung văn bản được cung cấp. KHÔNG được sử dụng kiến thức bên ngoài, tài liệu khác hay thông tin chung trên mạng internet.
2. TUYỆT ĐỐI KHÔNG TẠO CÂU HỎI ẢO (NO HALLUCINATION) - Không tự bịa ra bất kỳ sự kiện, khái niệm, số liệu, tên gọi hay định nghĩa nào không xuất hiện trong tài liệu gốc. Nếu tài liệu không đề cập đến một thông tin nào đó, bạn TUYỆT ĐỐI KHÔNG được đưa thông tin đó vào làm câu hỏi hoặc làm đáp án (kể cả đáp án nhiễu).
3. ĐÁP ÁN NHIỄU PHẢI HỢP LÝ VÀ CHỈ LIÊN QUAN ĐẾN TÀI LIỆU - Các phương án lựa chọn sai (đáp án nhiễu) phải được xây dựng từ các khái niệm có trong tài liệu hoặc có tính logic cao, tránh đưa ra các từ ngữ hoặc khái niệm hoàn toàn xa lạ, không có trong tài liệu để tránh làm người học bối rối hoặc nhận ra đáp án đúng quá dễ dàng.
4. GIẢI THÍCH CHI TIẾT VÀ TRÍCH DẪN - Phần "explanation" (giải thích) PHẢI giải thích rõ ràng tại sao đáp án đó đúng và trích dẫn cụ thể câu văn hoặc đoạn thông tin từ tài liệu gốc chứng minh cho câu trả lời.
5. CÂU HỎI RÕ RÀNG VÀ CHUẨN XÁC - Câu hỏi phải diễn đạt mạch lạc, không mơ hồ, không gây hiểu lầm.
6. ĐÚNG CẤP ĐỘ BLOOM - Phải gán đúng mức độ nhận thức theo Thang đo Bloom (Nhớ, Hiểu, Vận dụng, Phân tích, Đánh giá, Sáng tạo).
7. ĐÚNG ĐỊNH DẠNG LOẠI CÂU HỎI - Tạo đúng loại câu hỏi được yêu cầu (mcq, true_false, fill_blank, short_answer, multi_select, matching) và tuân thủ định dạng JSON tương ứng.

Mọi câu hỏi vi phạm quy tắc bám sát tài liệu hoặc chứa thông tin không có trong văn bản được cung cấp sẽ bị coi là lỗi nghiêm trọng.`;

// ==========================================
// PROMPT BUILDERS
// ==========================================

interface QuestionGenerationContext {
  documentTitle: string;
  chapterTitle: string;
  chapterIndex: number;
  totalChapters: number;
  chunkIndex: number;
  totalChunksInChapter: number;
  chunkContent: string;
  questionCount: number;
  questionTypes: QuestionType[];
  bloomLevels: string[];
  negativeExamples: string;
  selectedSections?: string[];
}

export function buildQuestionGenerationPrompt(ctx: QuestionGenerationContext): string {
  const bloomInstruction = ctx.bloomLevels.length > 0
    ? `TẤT CẢ câu hỏi PHẢI thuộc các cấp độ Bloom sau: ${ctx.bloomLevels.join(', ')}. KHÔNG ĐƯỢC tạo câu hỏi ở cấp độ khác.`
    : `Phân bổ đa dạng theo Thang đo Bloom: Nhớ, Hiểu, Vận dụng, Phân tích, Đánh giá, Sáng tạo.`;

  const typeInstructions = buildQuestionTypeInstructions(ctx.questionTypes);

  const sectionsInstruction = ctx.selectedSections && ctx.selectedSections.length > 0
    ? `\n\nYÊU CẦU GIỚI HẠN PHẠM VI (CỰC KỲ QUAN TRỌNG):
Người dùng chỉ lựa chọn học và ôn tập các phần con sau đây trong chương:
${ctx.selectedSections.map(s => `- ${s}`).join('\n')}

Bạn CHỈ được phép tạo các câu hỏi liên quan và bám sát trực tiếp vào nội dung của các phần con được liệt kê ở trên nằm trong đoạn trích văn bản dưới đây. TUYỆT ĐỐI KHÔNG tạo câu hỏi từ bất kỳ nội dung nào khác của đoạn trích.`
    : '';

  return `BỐI CẢNH TÀI LIỆU:
- Tài liệu: "${ctx.documentTitle}"
- Chương hiện tại: "${ctx.chapterTitle}" (Chương ${ctx.chapterIndex}/${ctx.totalChapters})
- Vị trí: Phần ${ctx.chunkIndex}/${ctx.totalChunksInChapter} của chương này
- Hướng dẫn ngữ cảnh ranh giới: Đoạn trích dưới đây có một phần nhỏ trùng lặp (overlap) khoảng 300 ký tự ở đầu và cuối với các đoạn lân cận để duy trì ngữ cảnh liên tục. Hãy dựa vào phần trùng lặp này để hiểu trọn vẹn ngữ cảnh của các câu văn bị cắt ngang, nhưng chỉ tập trung tạo câu hỏi xoay quanh các sự kiện cốt lõi của đoạn.
${sectionsInstruction}

NHIỆM VỤ: Tạo ${ctx.questionCount} câu hỏi từ nội dung được cung cấp.

CẢNH BÁO TỐI QUAN TRỌNG VỀ TÍNH CHÍNH XÁC (KHÔNG ĐƯỢC PHÉP VI PHẠM):
- BẠN CHỈ ĐƯỢC PHÉP TẠO CÂU HỎI TỪ CÁC THÔNG TIN CÓ SẴN TRONG NỘI DUNG CHƯƠNG DƯỚI ĐÂY.
- TUYỆT ĐỐI KHÔNG ĐƯỢC sử dụng bất kỳ kiến thức bên ngoài, sự kiện thực tế ngoài tài liệu hoặc thông tin chung nào khác. 
- KHÔNG tạo câu hỏi ảo (fake/hallucinated questions). Tất cả các thông tin, dữ liệu, định nghĩa và đáp án trong câu hỏi đều phải tìm thấy trực tiếp trong văn bản được cung cấp.
- Trích dẫn cụ thể câu văn từ văn bản được cung cấp vào phần "explanation" để chứng minh cho đáp án đúng.

YÊU CẦU:
1. ${bloomInstruction}
2. Câu hỏi phải rõ nghĩa, không mơ hồ.
3. KHÔNG bịa thêm kiến thức ngoài nội dung được cung cấp.
${ctx.negativeExamples ? `\nTRÁNH LẶP LẠI CÁC LỖI SAU:\n${ctx.negativeExamples}\n` : ''}
LOẠI CÂU HỎI CẦN TẠO:
${typeInstructions}

TRẢ VỀ ĐÚNG JSON:
{
  "questions": [
    {
      "question_text": "Nội dung câu hỏi",
      "question_type": "Điền một trong các giá trị sau tùy theo loại câu hỏi cụ thể được tạo: ${ctx.questionTypes.join(' | ')}",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "correct_answer": "Đáp án đúng (cho fill_blank, short_answer)",
      "correct_indexes": [0, 2],
      "matching_pairs": [{"left": "...", "right": "..."}],
      "explanation": "Giải thích chi tiết, trích dẫn từ nội dung",
      "difficulty": "Nhớ | Hiểu | Vận dụng | Phân tích | Đánh giá | Sáng tạo"
    }
  ]
}

LƯU Ý FORMAT THEO LOẠI:
- mcq: Dùng "options" (4 đáp án) + "correct_index" (0-3)
- true_false: Dùng "options": ["Đúng", "Sai"] + "correct_index" (0 hoặc 1)
- fill_blank: Câu hỏi có dấu "___" ở chỗ trống + "correct_answer" chứa đáp án
- short_answer: Câu hỏi mở + "correct_answer" chứa đáp án mẫu
- multi_select: Dùng "options" (4-5 đáp án) + "correct_indexes" (mảng index đúng)
- matching: Dùng "matching_pairs" (mảng {left, right})

NỘI DUNG CHƯƠNG "${ctx.chapterTitle}":
"""
${ctx.chunkContent}
"""`;
}

/**
 * Build hướng dẫn cụ thể cho từng loại câu hỏi
 */
function buildQuestionTypeInstructions(types: QuestionType[]): string {
  const instructions: string[] = [];

  if (types.includes('mcq')) {
    instructions.push('- **Trắc nghiệm (mcq)**: 4 đáp án A, B, C, D. Chỉ 1 đáp án đúng.');
  }
  if (types.includes('true_false')) {
    instructions.push('- **Đúng/Sai (true_false)**: Một mệnh đề, người dùng chọn Đúng hoặc Sai.');
  }
  if (types.includes('fill_blank')) {
    instructions.push('- **Điền vào chỗ trống (fill_blank)**: Câu có dấu "___" thay thế từ/cụm từ quan trọng. Đáp án là từ bị thay thế.');
  }
  if (types.includes('short_answer')) {
    instructions.push('- **Trả lời ngắn (short_answer)**: Câu hỏi mở, đáp án là 1-2 câu ngắn gọn.');
  }
  if (types.includes('multi_select')) {
    instructions.push('- **Chọn nhiều đáp án (multi_select)**: 4-5 đáp án, CÓ NHIỀU đáp án đúng. Nêu rõ "Chọn tất cả đáp án đúng".');
  }
  if (types.includes('matching')) {
    instructions.push('- **Ghép đôi (matching)**: 3-5 cặp {left, right} cần ghép tương ứng.');
  }

  if (instructions.length === 0) {
    instructions.push('- **Trắc nghiệm (mcq)**: 4 đáp án A, B, C, D. Chỉ 1 đáp án đúng.');
  }

  return instructions.join('\n');
}

/**
 * Build prompt cho AI 1 — Phân tích cấu trúc tài liệu (AI fallback cho chapter detection)
 */
export function buildChapterDetectionPrompt(previewText: string): string {
  return `Phân tích cấu trúc tài liệu sau và nhận diện các chương/phần/mục chính.

QUAN TRỌNG:
- Chỉ nhận diện các phần LỚN (chương, phần, bài), KHÔNG liệt kê mục con (1.1, 1.2, ...)
- Nếu tài liệu không có cấu trúc chương rõ ràng, hãy chia thành các phần logic (ví dụ: "Giới thiệu", "Nội dung chính", "Kết luận")
- Mỗi chương phải có tiêu đề rõ ràng

Trả về JSON:
{
  "chapters": [
    {
      "title": "Tên chương/phần",
      "start_keyword": "Vài từ đầu tiên của chương (để tìm vị trí trong text gốc)"
    }
  ],
  "has_clear_structure": true
}

NỘI DUNG TÀI LIỆU (trích xuất đoạn đầu):
"""
${previewText}
"""`;
}
