import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Thiết lập workerSrc để tránh lỗi "No GlobalWorkerOptions.workerSrc specified"
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

export interface RichTextItem {
  text: string;
  fontSize: number;
  fontName: string;
  x: number;
  y: number;
  page: number;
}

export interface HeadingCandidate {
  text: string;
  fontSize: number;
  page: number;
}

/**
 * Đọc file PDF và trích xuất text kèm theo thông tin định dạng (Font Size, Font Name, Tọa độ).
 */
export async function extractRichText(buffer: Buffer): Promise<RichTextItem[]> {
  const data = new Uint8Array(buffer);
  
  const loadingTask = pdfjsLib.getDocument({
    data,
    disableFontFace: true, // Tối ưu tốc độ, không cần load font trên server
    verbosity: 0           // 0 = ERRORS. Tắt cảnh báo Warning TT: undefined function
  });

  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;
  const items: RichTextItem[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim()) {
        // transform là mảng 6 phần tử: [scaleX, skewY, skewX, scaleY, translateX, translateY]
        const transform = item.transform;
        // Chiều cao thực tế của chữ xấp xỉ bằng scaleY (transform[3])
        const fontSize = Math.sqrt(transform[2] * transform[2] + transform[3] * transform[3]) || transform[3];
        
        items.push({
          text: item.str,
          fontSize: Math.round(fontSize * 10) / 10,
          fontName: item.fontName,
          x: transform[4],
          y: transform[5],
          page: i
        });
      }
    }
  }

  return items;
}

/**
 * Dựa vào thông số kích thước chữ (Font Size), tìm ra những đoạn Text có kích thước lớn
 * bất thường so với phần còn lại của tài liệu (Body text).
 * Đây chính là các Tiêu đề Chương tiềm năng.
 */
export function extractHeadingCandidates(items: RichTextItem[]): HeadingCandidate[] {
  if (items.length === 0) return [];

  // Bước 1: Tìm ra kích thước chữ phổ biến nhất (Mode) -> Chính là Body Text
  const sizeCounts: Record<number, number> = {};
  let maxCount = 0;
  let bodyFontSize = 0;
  
  for (const item of items) {
    const size = item.fontSize;
    sizeCounts[size] = (sizeCounts[size] || 0) + 1;
    if (sizeCounts[size] > maxCount) {
      maxCount = sizeCounts[size];
      bodyFontSize = size;
    }
  }

  // Bước 2: Thiết lập ngưỡng kích thước. 
  // Text được coi là Heading nếu lớn hơn body text ít nhất 15% (hoặc 1.5pt)
  const minHeadingSize = Math.max(bodyFontSize * 1.15, bodyFontSize + 1.5);
  
  const candidates: HeadingCandidate[] = [];
  let currentCandidate: HeadingCandidate | null = null;

  for (const item of items) {
    // Nếu text này đủ lớn để làm Heading
    if (item.fontSize >= minHeadingSize) {
      // Gộp các text liền kề trên cùng 1 dòng (cùng trang, sai số tọa độ Y nhỏ, sai số fontSize nhỏ)
      if (
        currentCandidate && 
        currentCandidate.page === item.page && 
        Math.abs(currentCandidate.fontSize - item.fontSize) < 1.0
      ) {
        currentCandidate.text += ' ' + item.text.trim();
      } else {
        if (currentCandidate) candidates.push(currentCandidate);
        currentCandidate = {
          text: item.text.trim(),
          fontSize: item.fontSize,
          page: item.page
        };
      }
    } else {
      if (currentCandidate) {
        candidates.push(currentCandidate);
        currentCandidate = null;
      }
    }
  }
  if (currentCandidate) candidates.push(currentCandidate);

  // Bước 3: Làm sạch và loại bỏ nhiễu
  let cleanedCandidates = candidates
    .map(c => ({ ...c, text: c.text.replace(/\s+/g, ' ').trim() }))
    // Loại bỏ text quá ngắn (<= 2 ký tự) hoặc chỉ chứa toàn số
    .filter(c => c.text.length > 2 && !/^\d+$/.test(c.text));

  // Bước 4: Loại bỏ Header / Footer (xuất hiện lặp lại trên nhiều trang)
  const textPageMap: Record<string, Set<number>> = {};
  for (const c of cleanedCandidates) {
    const key = c.text.toLowerCase();
    if (!textPageMap[key]) textPageMap[key] = new Set();
    textPageMap[key].add(c.page);
  }

  // Chỉ giữ lại những candidate xuất hiện trên <= 2 trang khác nhau
  cleanedCandidates = cleanedCandidates.filter(c => {
    const key = c.text.toLowerCase();
    return textPageMap[key].size <= 2;
  });

  return cleanedCandidates;
}
