import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from "@google/generative-ai";
// @ts-ignore
import pdf from 'pdf-parse';

// --- POLYFILL (GIỮ NGUYÊN ĐỂ TRÁNH LỖI PDF) ---
// @ts-ignore
if (typeof Promise.withResolvers === "undefined") {
  // @ts-ignore
  Promise.withResolvers = function () {
    let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject };
  };
}
// ----------------------------------------------

export async function POST(req: Request) {
  let pdfText = "";

  try {
    // 1. NHẬN FILE VÀ ĐỌC NỘI DUNG (Dùng chung cho cả 2 AI)
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: "Chưa chọn file" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Parse PDF
    const pdfData = await pdf(buffer);
    pdfText = pdfData.text;

    if (!pdfText) throw new Error("File PDF không có nội dung text.");

    // Cắt ngắn bớt nếu file quá dài (Tránh lỗi token)
    const truncatedText = pdfText.slice(0, 20000);

    // --- CHIẾN THUẬT: THỬ OPENAI TRƯỚC ---
    try {
      console.log("🤖 Đang thử dùng OpenAI...");
      
      if (!process.env.OPENAI_API_KEY) throw new Error("Thiếu OpenAI Key");

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: "Bạn là máy tạo quiz. Trả về JSON chuẩn." },
          { 
            role: "user", 
            content: `Tạo 5 câu hỏi trắc nghiệm từ văn bản sau. 
            Format JSON: { "quizzes": [{ "question": "...", "options": [], "answer": "...", "bloom_level": "...", "explanation": "..." }] }
            
            Văn bản: ${truncatedText}` 
          }
        ],
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");
      return NextResponse.json({ source: "OpenAI", ...result });

    } catch (openAiError: any) {
      // --- NẾU OPENAI LỖI -> CHUYỂN SANG GEMINI ---
      console.warn("⚠️ OpenAI thất bại (có thể do hết tiền/quota). Đang chuyển sang Gemini...");
      console.error("Lỗi OpenAI:", openAiError.message);

      if (!process.env.GEMINI_API_KEY) {
        throw new Error("OpenAI lỗi và không tìm thấy GEMINI_API_KEY để dự phòng.");
      }

      console.log("💎 Đang dùng Gemini (Dự phòng)...");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `
        Tạo 5 câu hỏi trắc nghiệm từ văn bản dưới đây.
        Yêu cầu Output JSON: { "quizzes": [{ "question": "...", "options": ["A.", "B.", "C.", "D."], "answer": "...", "bloom_level": "...", "explanation": "..." }] }
        
        Văn bản: "${truncatedText}"
      `;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Parse JSON từ Gemini
      const geminiData = JSON.parse(responseText);
      return NextResponse.json({ source: "Gemini (Fallback)", ...geminiData });
    }

  } catch (error: any) {
    console.error("❌ LỖI NGHIÊM TRỌNG:", error);
    return NextResponse.json({ error: error.message || "Lỗi hệ thống" }, { status: 500 });
  }
}