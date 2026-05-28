/**
 * Chapter Detection Engine
 * 
 * Phát hiện chương/mục trong tài liệu bằng chiến lược Regex-first + AI fallback.
 */

import { generateJSON } from '@/utils/ai/provider';

// ==========================================
// TYPES
// ==========================================

export interface DetectedChapter {
  index: number;
  title: string;
  content: string;
  startPosition: number;
  endPosition: number;
  detectionMethod: 'regex' | 'ai' | 'default';
  metadata?: any;
}

// ==========================================
// REGEX PATTERNS
// ==========================================

// Danh sách các từ khóa tiêu đề phụ, trang phi nội dung học tập để loại bỏ khỏi danh sách chương
const BLACKLISTED_HEADING_KEYWORDS = [
  'mục lục',
  'table of contents',
  'tài liệu tham khảo',
  'references',
  'lời nói đầu',
  'lời mở đầu',
  'phụ lục',
  'appendix',
  'appendices',
  'chỉ mục',
  'index'
];

// Mẫu regex nhận diện tiêu đề chương (tiếng Việt + tiếng Anh)
// Thêm negative lookahead (?![a-zA-Z\u00C0-\u024F\u1EA0-\u1EFF]) để ngăn khớp nhầm số La Mã với ký tự trong từ tiếng Việt (VD: "L" trong "Lục", "l" trong "lớn")
const CHAPTER_PATTERNS = [
  // Tiếng Việt — "Chương 1:", "Chương I:", "CHƯƠNG 1", "CHƯƠNG I"
  /^[\s]*(?:CHƯƠNG|Chương|chương)\s+(\d+|[IVXLCDM]+)(?![a-zA-Z\u00C0-\u024F\u1EA0-\u1EFF])[:\.\s\-–—]?\s*(.*)/im,
  // Tiếng Anh — "Chapter 1:", "CHAPTER 1"
  /^[\s]*(?:CHAPTER|Chapter|chapter)\s+(\d+|[IVXLCDM]+)(?![a-zA-Z\u00C0-\u024F\u1EA0-\u1EFF])[:\.\s\-–—]?\s*(.*)/im,
  // Tiếng Việt — "Phần 1:", "PHẦN 1", "Phần I:"
  /^[\s]*(?:PHẦN|Phần|phần)\s+(\d+|[IVXLCDM]+)(?![a-zA-Z\u00C0-\u024F\u1EA0-\u1EFF])[:\.\s\-–—]?\s*(.*)/im,
  // Tiếng Việt — "Bài 1:", "BÀI 1"
  /^[\s]*(?:BÀI|Bài|bài)\s+(\d+|[IVXLCDM]+)(?![a-zA-Z\u00C0-\u024F\u1EA0-\u1EFF])[:\.\s\-–—]?\s*(.*)/im,
  // Tiếng Anh — "Part 1:", "PART 1"
  /^[\s]*(?:PART|Part|part)\s+(\d+|[IVXLCDM]+)(?![a-zA-Z\u00C0-\u024F\u1EA0-\u1EFF])[:\.\s\-–—]?\s*(.*)/im,
  // Tiếng Anh — "Section 1:", "SECTION 1"
  /^[\s]*(?:SECTION|Section|section)\s+(\d+|[IVXLCDM]+)(?![a-zA-Z\u00C0-\u024F\u1EA0-\u1EFF])[:\.\s\-–—]?\s*(.*)/im,
  // Tiếng Việt — "MỤC 1", "Mục 1"
  /^[\s]*(?:MỤC|Mục|mục)\s+(\d+|[IVXLCDM]+)(?![a-zA-Z\u00C0-\u024F\u1EA0-\u1EFF])[:\.\s\-–—]?\s*(.*)/im,
];

// Pattern cho numbered sections: "1.", "2.", nhưng chỉ khi đứng đầu dòng và theo sau là text đủ dài
const NUMBERED_SECTION_PATTERN = /^[\s]*(\d+)\.\s+([A-ZÀ-Ỹ][^\n]{5,})/gm;

// ==========================================
// REGEX DETECTION
// ==========================================

interface RegexMatch {
  fullMatch: string;
  number: string;
  title: string;
  position: number;
  lineNumber: number;
}

interface TempChapter {
  title: string;
  number: string;
  sections: OutlineSection[];
}

interface OutlineSection {
  title: string;
  sections?: OutlineSection[];
}

function cleanTOCLineTitle(title: string): string {
  return title
    .replace(/\.+\s*\d+$/, '') // Dấu chấm lửng dẫn trang ở cuối (vd: ........... 12)
    .replace(/\s+\d+$/, '')    // Số trang đơn ở cuối (vd:  12)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Trích xuất các mục con (numbered sections) từ nội dung chương.
 * Dùng khi chương không có hierarchy từ TOC parser.
 * 
 * Nhận diện: "1. Title", "2. Title" (số tuần tự + tiêu đề viết hoa)
 * và sub-sections: "1.1 Title", "1.2. Title" (ký hiệu thập phân)
 * 
 * Dùng heuristic "consecutive numbering": chỉ chấp nhận nếu số tăng tuần tự (1→2→3).
 * Khi gặp số không tuần tự (restart lại từ 1 hoặc nhảy bậc), dừng trích xuất
 * để tránh bắt nhầm danh sách con trong nội dung (VD: 7 tầng OSI).
 */
function extractSectionsFromContent(content: string): OutlineSection[] {
  if (!content || content.length < 50) return [];

  const sections: OutlineSection[] = [];
  const lines = content.split('\n');

  // Main section: "N. Title" — số ở đầu dòng, dấu chấm, khoảng trắng, tiêu đề viết hoa (>5 ký tự)
  const MAIN_SECTION_RE = /^[\s]*(\d+)\.\s+([A-ZÀ-Ỹ][^\n]{5,})/;
  // Sub-section: "N.N Title" hoặc "N.N. Title" — ký hiệu thập phân
  const SUB_SECTION_RE = /^[\s]*(\d+\.\d+)\.?\s+([A-ZÀ-Ỹa-zà-ỹ][^\n]{3,})/;

  let currentSection: OutlineSection | null = null;
  let lastMainNumber = 0;
  let extractionStopped = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;
    if (extractionStopped) break;

    // Kiểm tra sub-section trước (pattern cụ thể hơn: "1.1 Title")
    const subMatch = trimmed.match(SUB_SECTION_RE);
    if (subMatch && currentSection) {
      currentSection.sections = currentSection.sections || [];
      currentSection.sections.push({ title: cleanTOCLineTitle(trimmed) });
      continue;
    }

    // Kiểm tra main section ("N. Title")
    const mainMatch = trimmed.match(MAIN_SECTION_RE);
    if (mainMatch) {
      const num = parseInt(mainMatch[1], 10);
      if (num === lastMainNumber + 1) {
        // Số tuần tự → section hợp lệ
        currentSection = { title: cleanTOCLineTitle(trimmed), sections: [] };
        sections.push(currentSection);
        lastMainNumber = num;
      } else {
        // Số không tuần tự → danh sách con hoặc nội dung khác, dừng trích xuất
        extractionStopped = true;
      }
    }
  }

  // Chỉ trả về nếu tìm được >= 2 sections (tránh false positive)
  return sections.length >= 2 ? sections : [];
}

function detectByRegex(text: string): DetectedChapter[] {
  // Chuẩn hóa Unicode NFC và sửa lỗi font chữ Ƣ/ƣ trong tài liệu bị lỗi font map
  text = text.normalize('NFC').replace(/Ƣ/g, 'Ư').replace(/ƣ/g, 'ư');
  
  console.log('[ChapterDetector/Regex] Initializing Super-Regex TOC Parser v2...');
  
  const allLines = text.split('\n');
  
  // ========================================================================
  // PATTERNS — Định nghĩa các mẫu Regex phân cấp đề mục
  // ========================================================================
  const CHAPTER_KW_RE   = /^[\s]*(?:CHƯƠNG|Chương|chương|PHẦN|Phần|phần|BÀI|Bài|bài|CHAPTER|Chapter|chapter|PART|Part|part)\s+(\d+|[IVXLCDM]+)(?![a-zA-Z\u00C0-\u024F\u1EA0-\u1EFF])/i;
  const ROMAN_RE        = /^[\s]*([IVXLCDM]+)(?![a-zA-Z\u00C0-\u024F\u1EA0-\u1EFF])[\s:.\-–—]+\s*\S/;
  const DECIMAL_RE      = /^[\s]*(\d+\.\d+(?:\.\d+)?)\.?\s+\S/;
  const NUMBER_RE       = /^[\s]*(\d+)\.\s+\S/;
  const DOT_PAGE_RE     = /\.{3,}\s*\d+\s*$/;  // Dòng kết thúc bằng "............. 4"

  // Danh sách từ khóa loại trừ (không phải nội dung chương học tập)
  const SKIP_HEADINGS = [
    'lời mở đầu', 'lời nói đầu', 'kết luận', 'tài liệu tham khảo',
    'danh mục tài liệu', 'danh mục bảng', 'danh mục hình',
    'danh mục từ viết tắt', 'danh mục sơ đồ', 'danh mục biểu đồ',
    'phụ lục', 'appendix', 'references', 'table of contents',
    'mục lục', 'bibliography', 'acknowledgement', 'lời cảm ơn',
    'nhận xét', 'index', 'chỉ mục'
  ];

  function shouldSkipEntry(line: string): boolean {
    const lower = line.toLowerCase().trim();
    return SKIP_HEADINGS.some(kw => lower.includes(kw));
  }

  // ========================================================================
  // STEP 1: Phát hiện vùng MỤC LỤC (TOC) bằng clustering dòng có dấu chấm lửng
  // ========================================================================
  let tocStartLine = -1;
  let tocEndLine = -1;

  // Phương pháp A: Tìm keyword "MỤC LỤC" trong 60 dòng đầu
  for (let i = 0; i < Math.min(allLines.length, 60); i++) {
    const lower = allLines[i].trim().toLowerCase();
    if (lower === 'mục lục' || lower === 'table of contents' ||
        /^mục\s+lục\s*$/.test(lower) || /^table\s+of\s+contents\s*$/.test(lower)) {
      tocStartLine = i + 1; // Bắt đầu parse từ dòng sau keyword
      break;
    }
  }

  // Phương pháp B: Nếu không tìm thấy keyword, tìm vùng có nhiều dòng "....... N" tập trung
  if (tocStartLine === -1) {
    let bestClusterStart = -1;
    let bestClusterEnd = -1;
    let bestClusterCount = 0;

    for (let start = 0; start < Math.min(allLines.length, 80); start++) {
      if (!DOT_PAGE_RE.test(allLines[start])) continue;
      let count = 0;
      let end = start;
      // Đếm số dòng có dots trong cửa sổ 150 dòng
      for (let j = start; j < Math.min(start + 150, allLines.length); j++) {
        if (DOT_PAGE_RE.test(allLines[j])) {
          count++;
          end = j;
        }
      }
      if (count > bestClusterCount) {
        bestClusterCount = count;
        bestClusterStart = start;
        bestClusterEnd = end;
      }
    }
    if (bestClusterCount >= 5) {
      tocStartLine = bestClusterStart;
      tocEndLine = bestClusterEnd;
    }
  }

  // Tìm dòng cuối của TOC (dòng cuối cùng có dots trước khi body text bắt đầu)
  if (tocStartLine !== -1 && tocEndLine === -1) {
    for (let i = tocStartLine; i < Math.min(tocStartLine + 200, allLines.length); i++) {
      if (DOT_PAGE_RE.test(allLines[i])) {
        tocEndLine = i;
      }
    }
    if (tocEndLine === -1) {
      tocEndLine = Math.min(tocStartLine + 80, allLines.length - 1);
    }
  }

  // ========================================================================
  // STEP 2: Parse TOC entries thành cây phân cấp (nếu tìm được TOC)
  // ========================================================================
  const tempChapters: TempChapter[] = [];

  if (tocStartLine !== -1 && tocEndLine !== -1 && tocEndLine > tocStartLine) {
    console.log(`[ChapterDetector/Regex] TOC detected at lines ${tocStartLine}-${tocEndLine}`);

    // Xác định loại mẫu regex khớp dòng
    type EntryType = 'chapter' | 'roman' | 'decimal' | 'number';
    interface RawEntry {
      rawText: string;
      type: EntryType;
    }

    function classifyLine(line: string): { type: EntryType } | null {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 2) return null;
      // Bỏ qua dòng chỉ có số trang (iii, iv, 1, 2...)
      if (/^[ivxlcdm]+\s*$/i.test(trimmed) || /^\d{1,3}\s*$/.test(trimmed)) return null;

      if (CHAPTER_KW_RE.test(trimmed))  return { type: 'chapter' };
      if (DECIMAL_RE.test(trimmed))     return { type: 'decimal' };
      if (ROMAN_RE.test(trimmed))       return { type: 'roman' };
      if (NUMBER_RE.test(trimmed))      return { type: 'number' };
      return null;
    }

    // Gộp các dòng multi-line: khi gặp dòng pattern mới → flush entry cũ, bắt đầu entry mới
    // Khi gặp dòng không match pattern → coi là dòng tiếp nối (continuation) của entry trước
    const rawEntries: RawEntry[] = [];
    let currentRaw: RawEntry | null = null;

    for (let i = tocStartLine; i <= tocEndLine; i++) {
      const line = allLines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Bỏ qua các tiêu đề phi nội dung
      if (shouldSkipEntry(trimmed)) continue;

      const classification = classifyLine(trimmed);
      if (classification) {
        // Flush entry cũ
        if (currentRaw) rawEntries.push(currentRaw);
        currentRaw = { rawText: trimmed, type: classification.type };
      } else if (currentRaw) {
        // Dòng tiếp nối (continuation) — gộp vào entry hiện tại
        currentRaw.rawText += ' ' + trimmed;
      }
      // Nếu chưa có entry nào và dòng không match → bỏ qua (orphan)
    }
    if (currentRaw) rawEntries.push(currentRaw);

    console.log(`[ChapterDetector/Regex] Parsed ${rawEntries.length} raw TOC entries`);

    // Dựng cây phân cấp từ rawEntries
    let curChapter: TempChapter | null = null;
    let curLevel2: OutlineSection | null = null;
    let curLevel3: OutlineSection | null = null;

    for (const entry of rawEntries) {
      const title = cleanTOCLineTitle(entry.rawText);
      if (!title || title.length < 3) continue;

      // Kiểm tra lại entry có phải heading phụ bị lọt lưới
      if (shouldSkipEntry(title)) continue;

      switch (entry.type) {
        case 'chapter': {
          const m = title.match(CHAPTER_KW_RE);
          const number = m ? m[1] : String(tempChapters.length + 1);
          curChapter = { title, number, sections: [] };
          tempChapters.push(curChapter);
          curLevel2 = null;
          curLevel3 = null;
          break;
        }
        case 'roman': {
          if (!curChapter) break;
          const node: OutlineSection = { title, sections: [] };
          curChapter.sections.push(node);
          curLevel2 = node;
          curLevel3 = null;
          break;
        }
        case 'number': {
          if (!curChapter) break;
          const node: OutlineSection = { title, sections: [] };
          if (curLevel2) {
            curLevel2.sections = curLevel2.sections || [];
            curLevel2.sections.push(node);
          } else {
            curChapter.sections.push(node);
          }
          curLevel3 = node;
          break;
        }
        case 'decimal': {
          const node: OutlineSection = { title };
          if (curLevel3) {
            curLevel3.sections = curLevel3.sections || [];
            curLevel3.sections.push(node);
          } else if (curLevel2) {
            curLevel2.sections = curLevel2.sections || [];
            curLevel2.sections.push(node);
          } else if (curChapter) {
            curChapter.sections.push(node);
          }
          break;
        }
      }
    }
  }

  // ========================================================================
  // STEP 3: Tìm vị trí body thực tế cho từng chương (progressive search)
  // ========================================================================
  if (tempChapters.length >= 1) {
    console.log(`[ChapterDetector/Regex] ✅ Successfully extracted ${tempChapters.length} chapters & full outline from TOC!`);

    const chapters: DetectedChapter[] = [];

    // Tính offset ký tự của dòng cuối TOC → bắt đầu tìm body từ đây
    let tocEndCharPos = 0;
    if (tocEndLine !== -1) {
      for (let i = 0; i <= tocEndLine && i < allLines.length; i++) {
        tocEndCharPos += allLines[i].length + 1; // +1 cho '\n'
      }
    }

    // Progressive search: mỗi chương tìm từ SAU vị trí chương trước
    let searchFrom = Math.max(tocEndCharPos, 0);

    for (let i = 0; i < tempChapters.length; i++) {
      const tempCh = tempChapters[i];
      let startPos = -1;

      // Tìm "CHƯƠNG N" trong body (sau TOC)
      const searchPattern = new RegExp(
        `(?:CHƯƠNG|Chương|chương|CHAPTER|Chapter|chapter|PHẦN|Phần|phần|BÀI|Bài|bài|PART|Part|part)\\s+${tempCh.number}(?![a-zA-Z\\u00C0-\\u024F\\u1EA0-\\u1EFF])`,
        'i'
      );

      const bodySlice = text.substring(searchFrom);
      const match = bodySlice.match(searchPattern);

      if (match && match.index !== undefined) {
        startPos = searchFrom + match.index;
        searchFrom = startPos + 50; // Tiến lên sau vị trí tìm được
      }

      // Fallback: ước lượng vị trí
      if (startPos === -1) {
        if (chapters.length > 0) {
          startPos = chapters[chapters.length - 1].endPosition;
        } else {
          startPos = tocEndCharPos;
        }
        searchFrom = startPos + 50;
      }

      chapters.push({
        index: i + 1,
        title: tempCh.title,
        content: '',
        startPosition: startPos,
        endPosition: text.length,
        detectionMethod: 'regex',
        metadata: { hierarchy: tempCh.sections }
      });
    }

    // Cập nhật endPosition và cắt content chính xác
    for (let i = 0; i < chapters.length; i++) {
      const next = chapters[i + 1];
      chapters[i].endPosition = next ? next.startPosition : text.length;
      chapters[i].content = text.substring(chapters[i].startPosition, chapters[i].endPosition).trim();
    }

    // Bổ sung hierarchy cho chương chưa có sections (trích xuất từ nội dung)
    for (const ch of chapters) {
      if (!ch.metadata?.hierarchy || ch.metadata.hierarchy.length === 0) {
        const sections = extractSectionsFromContent(ch.content);
        if (sections.length > 0) {
          ch.metadata = { ...ch.metadata, hierarchy: sections };
        }
      }
    }

    return chapters;
  }

  // ========================================================================
  // STEP 4: FALLBACK — Không tìm được TOC, quét body text tuần tự + dedup
  // ========================================================================
  console.log('[ChapterDetector/Regex] TOC not found or insufficient chapters. Scanning body text sequentially...');

  // Dùng Map để dedup theo chapter number — giữ occurrence CÓ khoảng cách xa TOC nhất (body text)
  const chapterByNumber = new Map<string, { title: string; position: number }>();
  let currentPosition = 0;

  for (let lineIdx = 0; lineIdx < allLines.length; lineIdx++) {
    const line = allLines[lineIdx];
    const trimmed = line.trim();

    // Bỏ qua dòng TOC (có dấu chấm lửng dẫn trang)
    if (DOT_PAGE_RE.test(trimmed)) {
      currentPosition += line.length + 1;
      continue;
    }

    for (const pattern of CHAPTER_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        const number = match[1];
        const titlePart = match[2]?.trim() || '';
        const fullTitle = titlePart
          ? `${match[0].trim().split(/\s+/).slice(0, 2).join(' ')}${titlePart ? ': ' + titlePart : ''}`
          : match[0].trim();

        const cleanFullTitle = cleanTitle(fullTitle);
        const titleLower = cleanFullTitle.toLowerCase();

        // Bỏ qua heading phi nội dung
        if (BLACKLISTED_HEADING_KEYWORDS.some(keyword => titleLower.includes(keyword))) break;
        if (shouldSkipEntry(cleanFullTitle)) break;

        // Giữ occurrence cuối cùng (body, không phải TOC) cho mỗi số chương
        chapterByNumber.set(number, { title: cleanFullTitle, position: currentPosition });
        break;
      }
    }
    currentPosition += line.length + 1;
  }

  if (chapterByNumber.size < 1) {
    // FALLBACK 4.2: Phát hiện các phần đánh số đơn thuần (Plain Numbered Sections) VD: "1. Tiêu đề", "2. Tiêu đề"
    console.log('[ChapterDetector/Regex] No regular chapters found. Checking for plain numbered sections...');
    const NUMBER_RE = /^[\s]*(\d+)\.(?!\d)[\s]*(.+)$/;
    const rawMatches: { number: number; title: string; position: number; lineIndex: number }[] = [];
    let curPos = 0;

    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      const trimmed = line.trim();
      
      // Bỏ qua dòng giống mục lục
      if (DOT_PAGE_RE.test(trimmed)) {
        curPos += line.length + 1;
        continue;
      }

      const match = trimmed.match(NUMBER_RE);
      if (match) {
        const cleanFullTitle = cleanTitle(trimmed);
        if (!shouldSkipEntry(cleanFullTitle)) {
          rawMatches.push({
            number: parseInt(match[1], 10),
            title: trimmed, // Giữ nguyên tiêu đề đầy đủ bao gồm cả số
            position: curPos,
            lineIndex: i
          });
        }
      }
      curPos += line.length + 1;
    }

    // Lọc bỏ các mục là inline list (các mục có số liên tiếp và nằm quá gần nhau <= 3 dòng)
    const matches = rawMatches.filter((m, i, arr) => {
      const prev = arr[i - 1];
      const next = arr[i + 1];
      let isInline = false;
      
      if (prev && m.number === prev.number + 1 && (m.lineIndex - prev.lineIndex) <= 3) {
        isInline = true;
      }
      if (next && next.number === m.number + 1 && (next.lineIndex - m.lineIndex) <= 3) {
        isInline = true;
      }
      
      return !isInline;
    });

    const tempChapterMap = new Map<number, { title: string; position: number }>();
    matches.forEach(m => {
      // Lấy occurrence ĐẦU TIÊN để tránh các list con hoặc số liệu rác đè lên tiêu đề chính
      if (!tempChapterMap.has(m.number)) {
        tempChapterMap.set(m.number, {
          title: m.title,
          position: m.position
        });
      }
    });

    const sortedChapters = Array.from(tempChapterMap.entries())
      .map(([num, data]) => ({ number: num, ...data }))
      .sort((a, b) => a.position - b.position);

    let validPrefixCount = 0;
    for (let i = 0; i < sortedChapters.length; i++) {
      // Tìm chuỗi các chương liên tiếp hợp lệ (1, 2, 3...)
      if (sortedChapters[i].number === i + 1) {
        validPrefixCount++;
      } else {
        break; // Dừng lại ở số lạc loài đầu tiên
      }
    }

    if (validPrefixCount >= 2) {
      const finalChapters = sortedChapters.slice(0, validPrefixCount);
      console.log(`[ChapterDetector/Regex] Valid numbered outline found with ${finalChapters.length} sections`);
      finalChapters.forEach(c => {
        chapterByNumber.set(c.number.toString(), { title: c.title, position: c.position });
      });
    } else {
      console.log(`[ChapterDetector/Regex] Numbered items did not form a valid chapter structure. Ignoring.`);
    }
    
    if (chapterByNumber.size < 1) {
      return [];
    }
  }

  // Sắp xếp theo vị trí và tạo DetectedChapter
  const sortedMatches = Array.from(chapterByNumber.values()).sort((a, b) => a.position - b.position);

  const chapters: DetectedChapter[] = [];
  for (let i = 0; i < sortedMatches.length; i++) {
    const current = sortedMatches[i];
    const next = sortedMatches[i + 1];
    const startPos = current.position;
    const endPos = next ? next.position : text.length;

    chapters.push({
      index: i + 1,
      title: current.title,
      content: text.substring(startPos, endPos).trim(),
      startPosition: startPos,
      endPosition: endPos,
      detectionMethod: 'regex',
      metadata: { hierarchy: [] }
    });
  }

  // Bổ sung hierarchy cho chương chưa có sections (trích xuất từ nội dung)
  for (const ch of chapters) {
    if (!ch.metadata?.hierarchy || ch.metadata.hierarchy.length === 0) {
      const sections = extractSectionsFromContent(ch.content);
      if (sections.length > 0) {
        ch.metadata = { ...ch.metadata, hierarchy: sections };
      }
    }
  }

  return chapters;
}

// ==========================================
// AI FALLBACK
// ==========================================

async function detectByAI(text: string): Promise<DetectedChapter[]> {
  // Chỉ gửi phần đầu tài liệu để AI phân tích cấu trúc Đề cương/Mục lục (tiết kiệm token)
  const previewLength = Math.min(text.length, 25000);
  const previewText = text.substring(0, previewLength);

  const prompt = `Phân tích cấu trúc tài liệu sau và nhận diện tất cả các chương/phần và các mục nhỏ lồng nhau có trong tài liệu.
Đặc biệt chú ý đến phần Mục lục hoặc Đề cương ở những trang đầu của tài liệu hoặc các tiêu đề slide bài giảng lớn phân chia nội dung chính.

QUY TẮC BẮT BUỘC VỀ SỰ TỒN TẠI CỦA CẤU TRÚC:
- Nếu tài liệu là văn bản ngắn, liên tục, hoặc chỉ là nội dung thô không được phân chia thành các phần lớn/chương rõ ràng (không có Mục lục hay Đề cương rõ ràng ở đầu, không phải slide bài giảng phân chủ đề), bạn BẮT BUỘC phải trả về danh sách "chapters" là RỖNG ([]).
- Tuyệt đối không tự ý bịa ra hay cố gắng chia nhỏ tài liệu nếu cấu trúc của nó không rõ ràng. Chỉ chia khi có cấu trúc chương/mục lớn rõ ràng.

QUY TẮC PHÂN CẤP ĐỀ CƯƠNG (chỉ áp dụng nếu tài liệu CÓ cấu trúc rõ ràng):
1. Nhận diện các chương/phần lớn nhất làm gốc (Level 1). Ví dụ: "Chương 1", "Chương I", "Phần I", "Bài 1", các tiêu đề lớn phân chia rõ ràng hoặc các phần chính của slide.
2. Nhận diện các mục con của từng chương lớn (Level 2). Ví dụ: mục đánh dấu bằng số La Mã như "I.", "II.", "III." hoặc các chủ đề con lớn.
3. Nhận diện các mục con nhỏ hơn của mục Level 2 (Level 3). Ví dụ: mục đánh dấu bằng số lẻ như "1.", "2.", "3." hoặc tương đương.
4. Đảm bảo tên các tiêu đề chương/mục được làm sạch: loại bỏ toàn bộ các dấu chấm lửng dẫn trang (như "....... 4") và số trang ở cuối.

Trả về định dạng JSON chuẩn:
{
  "chapters": [
    {
      "title": "Tên chương lớn (Level 1) hoặc tên phần chính",
      "start_keyword": "Vài từ độc nhất ở dòng bắt đầu chương/phần này trong tài liệu",
      "sections": [
        {
          "title": "Tên mục con Level 2",
          "sections": []
        }
      ]
    }
  ]
}

NỘI DUNG TÀI LIỆU:
"""
${previewText}
"""`;

  try {
    const { data: aiData } = await generateJSON(
      prompt,
      'Bạn là chuyên gia phân tích cấu trúc tài liệu học thuật. Trả về JSON chuẩn.'
    );

    if (!aiData.chapters || !Array.isArray(aiData.chapters) || aiData.chapters.length < 1) {
      return [];
    }

    // Map AI results sang DetectedChapter
    const chapters: DetectedChapter[] = [];
    let searchFrom = 0;

    for (let i = 0; i < aiData.chapters.length; i++) {
      const ch = aiData.chapters[i];
      if (!ch.title) continue;

      // Tìm vị trí bắt đầu bằng start_keyword (Tìm tuần tự từ searchFrom để tránh dính TOC)
      let startPos = -1;
      if (ch.start_keyword) {
        const keywordPos = text.indexOf(ch.start_keyword, searchFrom);
        if (keywordPos >= 0) {
          // Lùi lại đầu dòng
          startPos = text.lastIndexOf('\n', keywordPos) + 1;
        }
      }

      // Nếu không tìm được bằng keyword, ước lượng hoặc lấy điểm tiếp tục
      if (startPos === -1) {
        if (i === 0) {
          startPos = 0;
        } else {
          startPos = searchFrom;
        }
      }

      chapters.push({
        index: i + 1,
        title: ch.title,
        content: '',
        startPosition: startPos,
        endPosition: text.length,
        detectionMethod: 'ai',
        metadata: {
          hierarchy: ch.sections || []
        }
      });

      // Di chuyển searchFrom để tìm chương tiếp theo
      searchFrom = startPos + 20;
    }

    // Phân chia ranh giới nội dung và cập nhật endPosition
    for (let i = 0; i < chapters.length; i++) {
      const next = chapters[i + 1];
      chapters[i].endPosition = next ? next.startPosition : text.length;
      chapters[i].content = text.substring(chapters[i].startPosition, chapters[i].endPosition).trim();
    }

    return chapters.length >= 2 ? chapters : [];
  } catch (err) {
    console.error('[ChapterDetector/AI] Error:', err);
    return [];
  }
}

// ==========================================
// UTILITIES
// ==========================================

function cleanTitle(title: string): string {
  return title
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s:.\-–—]+|[\s:.\-–—]+$/g, '')
    .trim();
}

// ==========================================
// PUBLIC API
// ==========================================

// Thẩm định danh sách chương của Regex bằng AI và trích xuất thêm đề cương chi tiết
async function validateRegexChaptersWithAI(text: string, regexChapters: DetectedChapter[]): Promise<boolean> {
  const previewLength = Math.min(text.length, 12000);
  const previewText = text.substring(0, previewLength);
  const detectedTitles = regexChapters.map(c => c.title);

  const prompt = `Bạn là chuyên gia thẩm định cấu trúc tài liệu học thuật.
Chúng tôi đã sử dụng bộ lọc Regex để tự động phát hiện các chương/phần lớn trong tài liệu và tìm thấy danh sách sau:
${detectedTitles.map((t, idx) => `${idx + 1}. ${t}`).join('\n')}

NHIỆM VỤ:
1. Đọc đoạn đầu tài liệu học thuật dưới đây (thường chứa Mục lục hoặc Đề cương).
2. Thẩm định xem danh sách chương phát hiện bằng Regex trên có CHÍNH XÁC và phản ánh cấu trúc chương/phần LỚN thực tế của tài liệu không (không được khớp nhầm các đề mục con ngẫu nhiên hoặc các trang rác).
3. Nếu danh sách chương này ĐÚNG, hãy trích xuất thêm đề cương phân cấp các mục con (La Mã I, II... ➔ số lẻ 1, 2... ➔ thập phân 1.1, 1.2...) của từng chương đó.
4. Nếu danh sách chương này SAI (ví dụ: khớp nhầm phần lớn văn bản không phải chương, bỏ sót nhiều chương chính, hoặc danh sách vô lý), hãy đánh giá là không hợp lệ (is_valid = false).

Hãy trả về định dạng JSON chuẩn:
{
  "is_valid": true/false,
  "reason": "Giải thích ngắn gọn tại sao đúng hoặc sai",
  "chapters": [
    {
      "title": "Tên chương (khớp với danh sách trên)",
      "sections": [
        {
          "title": "Tên mục con Level 2 (Ví dụ: 'I. Giới thiệu')",
          "sections": [
            {
              "title": "Tên mục con Level 3 (Ví dụ: '1. Khái niệm')",
              "sections": [
                {
                  "title": "Tên mục con Level 4 (Ví dụ: '1.1. Khái niệm chuỗi cung ứng')"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

ĐOẠN ĐẦU TÀI LIỆU:
"""
${previewText}
"""`;

  try {
    const { data: aiData } = await generateJSON(
      prompt,
      'Bạn là chuyên gia thẩm định cấu trúc tài liệu học thuật. Trả về JSON chuẩn.'
    );

    if (aiData.is_valid && Array.isArray(aiData.chapters)) {
      console.log(`[ChapterDetector/Validation] AI validated Regex result as VALID. Reason: ${aiData.reason}`);
      
      // Đồng bộ hóa cấu trúc cây phân cấp về cho regexChapters
      for (let i = 0; i < regexChapters.length; i++) {
        const matchingAIChapter = aiData.chapters.find((c: any) =>
          c.title && (c.title.toLowerCase().includes(regexChapters[i].title.toLowerCase()) ||
                      regexChapters[i].title.toLowerCase().includes(c.title.toLowerCase()))
        ) || aiData.chapters[i];

        if (matchingAIChapter) {
          regexChapters[i].metadata = {
            hierarchy: matchingAIChapter.sections || []
          };
        }
      }
      return true;
    } else {
      console.log(`[ChapterDetector/Validation] AI validated Regex result as INVALID. Reason: ${aiData.reason}`);
      return false;
    }
  } catch (err) {
    console.error('[ChapterDetector/Validation] Error during validation:', err);
    return false;
  }
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Phát hiện chương trong tài liệu.
 * 
 * Chiến lược: Regex-First ➔ AI Validation ➔ AI Fallback ➔ Default chapter
 * 
 * @param text - Cleaned text của toàn bộ tài liệu
 * @returns Danh sách chapters đã phát hiện (luôn ≥ 1)
 */
export async function detectChapters(text: string): Promise<DetectedChapter[]> {
  // Chuẩn hóa Unicode NFC và sửa lỗi font chữ Ƣ/ƣ trong tài liệu bị lỗi font map
  text = text.normalize('NFC').replace(/Ƣ/g, 'Ư').replace(/ƣ/g, 'ư');

  console.log('[ChapterDetector] Starting detection (TEMPORARY: Regex-Only Mode)...');

  // Step 1: Chạy Regex trước
  const regexResult = detectByRegex(text);
  
  if (regexResult.length >= 2) {
    console.log(`[ChapterDetector] Super-Regex successfully extracted ${regexResult.length} chapters.`);

    // Sửa lỗi dính chữ (thiếu dấu cách) trong tiêu đề bằng AI
    try {
      const titles = regexResult.map(c => c.title);
      // Chỉ gọi AI sửa khi có ít nhất một tiêu đề có dấu hiệu dính chữ (có từ dài > 10 ký tự không chứa khoảng cách)
      const needsFix = titles.some(title => {
        const words = title.split(/\s+/);
        return words.some(w => w.length > 10);
      });

      if (needsFix) {
        console.log('[ChapterDetector] Spacing errors detected in titles. Calling AI to correct spacing...');
        const prompt = `Sửa lỗi dính chữ (thiếu dấu cách/khoảng trắng) trong danh sách tiêu đề chương/mục dưới đây. Trả về đúng số lượng tiêu đề theo thứ tự, giữ nguyên số chương/mục ở đầu (ví dụ: "1. Tại sao...").
Nếu tiêu đề đã có dấu cách đầy đủ và đúng chính tả tiếng Việt thì giữ nguyên.

Danh sách tiêu đề cần sửa:
${titles.map((t, i) => `${i+1}. "${t}"`).join('\n')}

Trả về định dạng JSON chuẩn:
{
  "corrected_titles": [
    "Tiêu đề 1 đã sửa hoặc giữ nguyên",
    "Tiêu đề 2 đã sửa hoặc giữ nguyên"
  ]
}`;
        const { data } = await generateJSON<{ corrected_titles: string[] }>(
          prompt,
          "Bạn là chuyên gia sửa lỗi chính tả và định dạng văn bản tiếng Việt. Chỉ trả về JSON."
        );

        if (data.corrected_titles && data.corrected_titles.length === regexResult.length) {
          for (let i = 0; i < regexResult.length; i++) {
            console.log(`[ChapterDetector] Title corrected: "${regexResult[i].title}" -> "${data.corrected_titles[i]}"`);
            regexResult[i].title = data.corrected_titles[i];
          }
        }
      }
    } catch (err) {
      console.error('[ChapterDetector] Error correcting title spaces with AI:', err);
      // Bỏ qua lỗi và trả về tiêu đề gốc của regex, tránh crash
    }

    return regexResult;
  }

  // Step 2: AI Fallback (Chạy khi Regex không tìm đủ số chương/phần)
  console.log(`[ChapterDetector] Regex found too few chapters (${regexResult.length}). Falling back to AI extraction...`);
  const aiResult = await detectByAI(text);
  if (aiResult.length >= 2) {
    console.log(`[ChapterDetector] AI successfully extracted outline with ${aiResult.length} chapters.`);
    return aiResult;
  }

  // Step 3: Default — 1 chương duy nhất (khi cả regex và AI đều không tìm thấy cấu trúc rõ ràng)
  console.log('[ChapterDetector] Both Regex and AI failed to find structured chapters, using default chapter.');
  return [{
    index: 1,
    title: 'Toàn bộ tài liệu',
    content: text,
    startPosition: 0,
    endPosition: text.length,
    detectionMethod: 'default'
  }];
}

/**
 * Kiểm tra xem kết quả detect có phải fallback mặc định không.
 * Dùng để hiển thị thông báo cho người dùng.
 */
export function isDefaultChapter(chapters: DetectedChapter[]): boolean {
  return chapters.length === 1 && chapters[0].detectionMethod === 'default';
}
