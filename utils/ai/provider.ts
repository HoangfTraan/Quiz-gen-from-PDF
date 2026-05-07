/**
 * Dual AI Provider — Round-Robin + Auto-Fallback
 * 
 * Phân phối lưu lượng 50/50 giữa Cloud AI (OpenAI-compatible) và Gemini.
 * Nếu provider được chọn lỗi → tự động fallback sang provider còn lại.
 * 
 * Biến môi trường cần thiết:
 *   AI_API_KEY    – API key cho provider OpenAI-compatible (Mistral, Kyma, OpenAI, v.v.)
 *   AI_BASE_URL   – Base URL của provider (mặc định: https://api.mistral.ai/v1)
 *   AI_MODEL      – Tên model sử dụng (mặc định: mistral-small-latest)
 *   GEMINI_API_KEY – API key cho Google Gemini
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ==========================================
// PROVIDER TYPES
// ==========================================
type ProviderName = 'CloudAI' | 'Gemini' | 'LocalAI';
type OutputMode = 'json' | 'text';

interface AIResult {
  /** Provider thực tế đã trả kết quả */
  source: ProviderName;
  /** Có phải fallback không */
  fallback: boolean;
  /** Nội dung trả về (string hoặc parsed object tùy mode) */
  content: string;
}

// ==========================================
// ROUND-ROBIN COUNTER (module-level, reset khi server restart)
// ==========================================
let callCounter = 0;

// ==========================================
// LAZY INIT — tránh crash khi thiếu key
// ==========================================
function getCloudAIClient(): OpenAI | null {
  const key = process.env.AI_API_KEY;
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: process.env.AI_BASE_URL || 'https://api.mistral.ai/v1',
  });
}

function getGeminiClient(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

// ==========================================
// LOCAL AI CLIENT INITIALIZATION
// ==========================================
function getLocalAiClient(): OpenAI | null {
  const url = process.env.LOCAL_AI_URL;
  if (!url) return null;
  return new OpenAI({
    apiKey: 'local-no-key-required',
    baseURL: url,
  });
}

// ==========================================
// INDIVIDUAL PROVIDER CALLS
// ==========================================

async function callCloudAI(
  prompt: string,
  systemPrompt: string,
  mode: OutputMode
): Promise<string> {
  const client = getCloudAIClient();
  if (!client) throw new Error('[AI] Missing AI_API_KEY');

  const modelName = process.env.AI_MODEL || 'mistral-small-latest';

  const completion = await client.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    //FUNCTION CALLING / JSON MODE CHO OPENAI
    // Bắt buộc model phải trả về định dạng JSON thay vì text tự do.
    ...(mode === 'json' ? { response_format: { type: 'json_object' } } : {}),
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error('[AI/CloudAI] Empty response');
  return text;
}

async function callGemini(
  prompt: string,
  _systemPrompt: string, // Gemini dùng prompt duy nhất, ghép system vào đầu
  mode: OutputMode
): Promise<string> {
  const client = getGeminiClient();
  if (!client) throw new Error('[AI] Missing GEMINI_API_KEY');

  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    // FUNCTION CALLING / JSON MODE CHO GEMINI
    // Bắt buộc Gemini phải trả dữ liệu dưới dạng JSON (application/json)
    ...(mode === 'json'
      ? { generationConfig: { responseMimeType: 'application/json' } }
      : {}),
  });

  // Ghép system prompt vào đầu prompt chính cho Gemini
  const fullPrompt = _systemPrompt
    ? `${_systemPrompt}\n\n${prompt}`
    : prompt;

  const result = await model.generateContent(fullPrompt);
  const text = result.response.text();
  if (!text) throw new Error('[AI/Gemini] Empty response');
  return text;
}

async function callLocalAI(
  prompt: string,
  systemPrompt: string,
  mode: OutputMode
): Promise<string> {
  const client = getLocalAiClient();
  const modelName = process.env.LOCAL_AI_MODEL || 'llama3';
  if (!client) throw new Error('[AI] Missing LOCAL_AI_URL');

  const completion = await client.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    // Tạm thời bỏ response_format vì một số phiên bản LM Studio báo lỗi 400 với 'json_object'
    // Chúng ta sẽ dựa hoàn toàn vào System Prompt ("Trả về JSON chuẩn") để lấy kết quả
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error(`[AI/LocalAI] Empty response from model ${modelName}`);
  return text;
}

// ==========================================
// PROVIDER MAP
// ==========================================
const providers: Record<
  ProviderName,
  (prompt: string, systemPrompt: string, mode: OutputMode) => Promise<string>
> = {
  CloudAI: callCloudAI,
  Gemini: callGemini,
  LocalAI: callLocalAI,
};

const providerOrder: ProviderName[] = ['CloudAI', 'Gemini'];

// ==========================================
// CORE: ROUND-ROBIN + FALLBACK
// ==========================================

async function callWithFallback(
  prompt: string,
  systemPrompt: string,
  mode: OutputMode
): Promise<AIResult> {

  if (process.env.USE_LOCAL_AI === 'true') {
    console.log(`[AI] Bypassing cloud, using Local AI (${process.env.LOCAL_AI_URL})`);
    try {
      const content = await callLocalAI(prompt, systemPrompt, mode);
      return { source: 'LocalAI', fallback: false, content };
    } catch (err: any) {
      console.error(`[AI/Local] Error:`, err);
      throw new Error(`Kết nối Local AI thất bại. Xin kiểm tra lại xem server đã chạy tại ${process.env.LOCAL_AI_URL} chưa. Chi tiết lỗi: ${err.message}`);
    }
  }
  // Round-robin: chọn primary dựa trên counter
  const primaryIdx = callCounter % providerOrder.length;
  callCounter++;

  const primary = providerOrder[primaryIdx];
  const fallbackName = providerOrder[1 - primaryIdx];

  // Thử primary
  try {
    console.log(`[AI] Request #${callCounter} -> Primary: ${primary}`);
    const content = await providers[primary](prompt, systemPrompt, mode);
    console.log(`[AI] ${primary} responded successfully`);
    return { source: primary, fallback: false, content };
  } catch (primaryErr: any) {
    console.warn(
      `[AI] ${primary} failed: ${primaryErr.message}. Switching to ${fallbackName}...`
    );
  }

  // Fallback
  try {
    const content = await providers[fallbackName](prompt, systemPrompt, mode);
    console.log(`[AI] ${fallbackName} (fallback) responded successfully`);
    return { source: fallbackName, fallback: true, content };
  } catch (fallbackErr: any) {
    console.error(
      `[AI] Both providers failed. Last error: ${fallbackErr.message}`
    );
    throw new Error(
      `Cả hai AI provider đều thất bại. CloudAI & Gemini không phản hồi.`
    );
  }
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Gọi AI và trả về JSON object đã parse.
 * Round-robin giữa CloudAI & Gemini, fallback tự động.
 */
export async function generateJSON<T = any>(
  prompt: string,
  systemPrompt: string = 'Bạn là trợ lý AI. Trả về JSON chuẩn.'
): Promise<{ source: ProviderName; fallback: boolean; data: T }> {
  const result = await callWithFallback(prompt, systemPrompt, 'json');
  let content = result.content.trim();
  let data: T;
  
  // ==========================================
  // CHÚ THÍCH: BẮT ĐẦU QUÁ TRÌNH CHUẨN HÓA JSON (JSON NORMALIZATION)
  // Bước 1: Xóa bỏ cụm markdown ```json nếu model nhả rác (thường gặp ở local AI hoặc cấu hình yếu)
  // ==========================================
  if (content.startsWith('```')) {
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }

  try {
    // Bước 2: Thử parse (dịch) nội dung sang Object (định dạng máy tính có thể đọc)
    data = JSON.parse(content) as T;
  } catch (err) {
    // Bước 3: Fallback dọn rác nâng cao - Trích xuất phần lõi JSON an toàn
    // Tìm dấu ngoặc nhọn mở đầu tiên và đóng cuối cùng, loại bỏ toàn bộ text mô tả thừa của AI xung quanh.
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start >= 0 && end > start) {
      data = JSON.parse(content.substring(start, end + 1)) as T;
    } else {
      console.error("[AI] JSON Parse error. Raw content:", result.content.substring(0, 200) + '...');
      throw new Error("Lấy dữ liệu AI thất bại do sai định dạng JSON: " + (err as Error).message);
    }
  }
  // KẾT THÚC QUÁ TRÌNH CHUẨN HÓA JSON ==========================================

  return { source: result.source, fallback: result.fallback, data };
}

/**
 * Gọi AI và trả về plain text (markdown, html, etc.).
 * Round-robin giữa CloudAI & Gemini, fallback tự động.
 */
export async function generateText(
  prompt: string,
  systemPrompt: string = 'Bạn là trợ lý AI chuyên nghiệp.'
): Promise<{ source: ProviderName; fallback: boolean; text: string }> {
  const result = await callWithFallback(prompt, systemPrompt, 'text');
  return { source: result.source, fallback: result.fallback, text: result.content };
}

/**
 * Trả về số lần gọi AI từ khi server khởi động (debug/monitoring).
 */
export function getCallCount(): number {
  return callCounter;
}
