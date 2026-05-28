/**
 * Page-level Text Extraction
 * 
 * Trích xuất text theo từng trang PDF thay vì lấy toàn bộ text cùng lúc.
 * Cho phép xác định start_page / end_page cho từng chương.
 */

import pdfParse from 'pdf-parse';

export interface PageContent {
  pageNumber: number;
  text: string;
}

export interface ExtractionResult {
  pages: PageContent[];
  fullText: string;
  totalPages: number;
}

/**
 * Trích xuất text theo từng trang từ buffer PDF.
 * Sử dụng pdf-parse với custom pagerender để tách từng trang.
 */
export async function extractPageByPage(buffer: Buffer): Promise<ExtractionResult> {
  const pages: PageContent[] = [];

  // pdf-parse trả về text theo trang qua callback pagerender
  // nhưng API chính không hỗ trợ tách trang trực tiếp.
  // Workaround: parse toàn bộ rồi tách theo page markers.

  const pdfData = await pdfParse(buffer, {
    // Không dùng pagerender vì pdf-parse có bug với một số PDF
    // Thay vào đó dùng phương pháp tách page từ text trả về
  });

  const totalPages = pdfData.numpages || 1;
  const rawText = pdfData.text || '';

  // Phương pháp tách trang: Nhiều PDF parser chèn form-feed (\f) hoặc nhiều newline giữa các trang
  // Ưu tiên tách bằng form-feed character (\f)
  const pageTexts = rawText.split('\f');

  if (pageTexts.length > 1) {
    // Có form-feed separator → mỗi phần tử là 1 trang
    pageTexts.forEach((text, i) => {
      if (text.trim()) {
        pages.push({
          pageNumber: i + 1,
          text: text.trim()
        });
      }
    });
  } else {
    // Không có form-feed → chia đều theo số trang (ước lượng)
    if (totalPages <= 1) {
      pages.push({ pageNumber: 1, text: rawText.trim() });
    } else {
      // Chia text thành các đoạn xấp xỉ bằng nhau theo số trang
      const lines = rawText.split('\n');
      const linesPerPage = Math.ceil(lines.length / totalPages);

      for (let i = 0; i < totalPages; i++) {
        const start = i * linesPerPage;
        const end = Math.min(start + linesPerPage, lines.length);
        const pageText = lines.slice(start, end).join('\n').trim();
        if (pageText) {
          pages.push({
            pageNumber: i + 1,
            text: pageText
          });
        }
      }
    }
  }

  // Nếu không tách được trang nào, fallback về 1 trang duy nhất
  if (pages.length === 0 && rawText.trim()) {
    pages.push({ pageNumber: 1, text: rawText.trim() });
  }

  return {
    pages,
    fullText: rawText,
    totalPages: pages.length
  };
}

/**
 * Xác định trang chứa vị trí ký tự cụ thể trong fullText.
 * Dùng để map start_position/end_position → start_page/end_page.
 */
export function getPageForPosition(pages: PageContent[], position: number, fullText: string): number {
  let currentPos = 0;
  for (const page of pages) {
    const pageStart = fullText.indexOf(page.text, currentPos);
    const pageEnd = pageStart + page.text.length;
    if (position >= pageStart && position < pageEnd) {
      return page.pageNumber;
    }
    currentPos = pageEnd;
  }
  return pages.length > 0 ? pages[pages.length - 1].pageNumber : 1;
}
