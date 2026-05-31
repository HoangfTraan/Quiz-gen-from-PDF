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
 * Trích xuất chapter number từ tiêu đề chương.
 * VD: "1. QUAN ĐIỂM CƠ BẢN..." → 1, "Chương 2: Sứ mệnh..." → 2
 */
function inferChapterNumber(chapterTitle: string): number | null {
  const numDotMatch = chapterTitle.match(/^[\s]*(\d+)[\.\s]/);
  if (numDotMatch) return parseInt(numDotMatch[1], 10);
  const kwMatch = chapterTitle.match(/(?:Chương|CHƯƠNG|Phần|PHẦN|Bài|BÀI|Chapter|CHAPTER|Part|PART)\s+(\d+)/i);
  if (kwMatch) return parseInt(kwMatch[1], 10);
  return null;
}

/**
 * Trích xuất các mục con (decimal sections) từ nội dung chương.
 * 
 * Hỗ trợ:
 * - "1.1. Title", "1.1 Title", "1.1.Title" (có hoặc không khoảng trắng)
 * - "1.1.1. Title" (3-level decimal)
 * - Dedup slide lặp (cùng heading xuất hiện nhiều lần)
 * - Chỉ lấy heading thuộc đúng chapter (Chapter 2 chỉ lấy 2.x)
 */
function extractSectionsFromContent(content: string, chapterTitle?: string): OutlineSection[] {
  if (!content || content.length < 50) return [];

  const chapterNum = chapterTitle ? inferChapterNumber(chapterTitle) : null;
  const lines = content.split('\n');

  // Regex patterns
  // 1. Decimal headings like "1.1 Title", "1.1.1 Title", allowing optional space after dot
  const DECIMAL_HEADING_RE = /^[\s]*(\d+\.\d+(?:\.\d+)?)\.?\s*([A-ZÀ-Ỹa-zà-ỹ].*)/;
  // 2. Single number headings like "1. Title"
  const SINGLE_HEADING_RE = /^[\s]*(\d+)\.\s+([A-ZÀ-Ỹ][^\n]{4,})/;

  interface HeadingEntry {
    number: string;
    title: string;
    depth: number;
    lineIndex: number;
  }

  // --- OPTION A: Look for Decimal Headings (Slide PDF style) ---
  const decimalEntries: HeadingEntry[] = [];
  const seenNumbers = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.length < 3) continue;

    const match = trimmed.match(DECIMAL_HEADING_RE);
    if (!match) continue;

    const number = match[1];
    const title = cleanTOCLineTitle(trimmed);
    const parts = number.split('.');
    const depth = parts.length;

    decimalEntries.push({
      number,
      title,
      depth,
      lineIndex: i
    });
  }

  // If we have decimal entries, filter and build hierarchy
  if (decimalEntries.length > 0) {
    // Determine the expected parent prefix.
    // If chapterNum is known, we expect the prefix to be chapterNum (e.g. Chapter 2 -> "2")
    // If not, we infer the prefix from the first decimal entry's first part.
    let expectedPrefix: string | null = chapterNum !== null ? chapterNum.toString() : null;
    if (expectedPrefix === null && decimalEntries.length > 0) {
      expectedPrefix = decimalEntries[0].number.split('.')[0];
    }

    if (expectedPrefix !== null) {
      const filteredDecimals = decimalEntries.filter(entry => {
        const parts = entry.number.split('.');
        return parts[0] === expectedPrefix;
      });

      // Dedup: only keep the first occurrence of each decimal number
      const dedupedDecimals: HeadingEntry[] = [];
      const seen = new Set<string>();
      for (const entry of filteredDecimals) {
        if (!seen.has(entry.number)) {
          seen.add(entry.number);
          dedupedDecimals.push(entry);
        }
      }

      if (dedupedDecimals.length >= 1) {
        const topLevel: OutlineSection[] = [];
        let currentL2: OutlineSection | null = null;

        for (const entry of dedupedDecimals) {
          if (entry.depth === 2) {
            currentL2 = { title: entry.title, sections: [] };
            topLevel.push(currentL2);
          } else if (entry.depth === 3 && currentL2) {
            currentL2.sections = currentL2.sections || [];
            currentL2.sections.push({ title: entry.title });
          }
        }
        // If we found at least 1 section, return it
        if (topLevel.length > 0) {
          return topLevel;
        }
      }
    }
  }

  // --- OPTION B: Look for Sequential Single Number Headings (Textbook style) ---
  const sections: OutlineSection[] = [];
  let currentSection: OutlineSection | null = null;
  let lastMainNumber = 0;
  let extractionStopped = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.length < 3) continue;
    if (extractionStopped) break;

    // Check for decimal sub-section if we already have a parent section active
    const decimalMatch = trimmed.match(DECIMAL_HEADING_RE);
    if (decimalMatch && currentSection) {
      const number = decimalMatch[1];
      const parts = number.split('.');
      // If it's a decimal under the current sequential number (e.g. current is "1", number is "1.1" or "1.1.1")
      if (parts[0] === lastMainNumber.toString()) {
        currentSection.sections = currentSection.sections || [];
        // Prevent duplicate sub-sections
        const subTitle = cleanTOCLineTitle(trimmed);
        if (!currentSection.sections.some(s => s.title === subTitle)) {
          currentSection.sections.push({ title: subTitle });
        }
        continue;
      }
    }

    // Check for main section
    const mainMatch = trimmed.match(SINGLE_HEADING_RE);
    if (mainMatch) {
      const num = parseInt(mainMatch[1], 10);
      if (num === lastMainNumber + 1) {
        currentSection = { title: cleanTOCLineTitle(trimmed), sections: [] };
        sections.push(currentSection);
        lastMainNumber = num;
      } else if (num > lastMainNumber + 1) {
        // If number skips (e.g., 1 -> 3), stop extraction to avoid matching random lists in the document
        extractionStopped = true;
      }
    }
  }

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
  const CHAPTER_KW_RE = /^[\s]*(?:CHƯƠNG|Chương|chương|PHẦN|Phần|phần|BÀI|Bài|bài|CHAPTER|Chapter|chapter|PART|Part|part)\s+(\d+|[IVXLCDM]+)(?![a-zA-Z\u00C0-\u024F\u1EA0-\u1EFF])/i;
  const ROMAN_RE = /^[\s]*([IVXLCDM]+)(?![a-zA-Z\u00C0-\u024F\u1EA0-\u1EFF])[\s:.\-–—]+\s*\S/;
  const DECIMAL_RE = /^[\s]*(\d+\.\d+(?:\.\d+)?)\.?\s+\S/;
  const NUMBER_RE = /^[\s]*(\d+)\.\s+\S/;
  const DOT_PAGE_RE = /\.{3,}\s*\d+\s*$/;  // Dòng kết thúc bằng "............. 4"

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

      if (CHAPTER_KW_RE.test(trimmed)) return { type: 'chapter' };
      if (DECIMAL_RE.test(trimmed)) return { type: 'decimal' };
      if (ROMAN_RE.test(trimmed)) return { type: 'roman' };
      if (NUMBER_RE.test(trimmed)) return { type: 'number' };
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
    console.log(`[ChapterDetector/Regex] Successfully extracted ${tempChapters.length} chapters & full outline from TOC!`);

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
        const sections = extractSectionsFromContent(ch.content, ch.title);
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

  // FILTER: Compact Syllabus — Bỏ qua danh sách chương nằm quá gần nhau (syllabus/giới thiệu môn học)
  // Khi slide bài giảng có 1 trang liệt kê tất cả chương của cả khóa học (VD: "Chương 1... Chương 7"),
  // các keyword nằm liền kề nhau (avg gap < 200 chars). Đây KHÔNG phải cấu trúc chương thực sự.
  if (chapterByNumber.size >= 3) {
    const positions = Array.from(chapterByNumber.values()).map(v => v.position).sort((a, b) => a - b);
    let totalGap = 0;
    for (let i = 1; i < positions.length; i++) {
      totalGap += positions[i] - positions[i - 1];
    }
    const avgGap = totalGap / (positions.length - 1);
    if (avgGap < 200) {
      console.log(`[ChapterDetector/Regex] Detected compact syllabus listing (avg gap: ${Math.round(avgGap)} chars, ${chapterByNumber.size} items). Ignoring as chapter structure.`);
      chapterByNumber.clear();
    }
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
      const sections = extractSectionsFromContent(ch.content, ch.title);
      if (sections.length > 0) {
        ch.metadata = { ...ch.metadata, hierarchy: sections };
      }
    }
  }

  // FILTER: Empty Chapter — Bỏ qua kết quả nếu >50% chapters không có nội dung thực
  // Khi chapter keyword khớp nhầm (VD: syllabus listing), các "chương" sẽ có rất ít hoặc không có nội dung.
  // Nếu đa số chapters có content < 100 chars → false positive, trả về [] để trigger AI fallback.
  if (chapters.length >= 2) {
    const emptyCount = chapters.filter(ch => ch.content.length < 100).length;
    if (emptyCount > chapters.length / 2) {
      console.log(`[ChapterDetector/Regex] ${emptyCount}/${chapters.length} chapters have <100 chars of content. Likely false-positive detection. Returning empty.`);
      return [];
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
Đặc biệt chú ý đến phần Mục lục hoặc Đề cương ở những trang đầu của tài liệu.

QUY TẮC BẮT BUỘC:
- Nếu tài liệu không có cấu trúc rõ ràng, trả về "chapters": []
- Không tự ý bịa ra.

Trả về định dạng JSON chuẩn:
{
  "chapters": [
    {
      "title": "Tên chương lớn (Ví dụ: Chương 1: Mở đầu)",
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

    const chapters: DetectedChapter[] = [];
    const allLines = text.split('\n');
    let searchFromLine = 0;

    // Tìm dòng chứa "Mục lục" để skip
    for (let i = 0; i < Math.min(allLines.length, 100); i++) {
      if (allLines[i].toLowerCase().includes('mục lục') || allLines[i].toLowerCase().includes('table of contents')) {
        searchFromLine = i + 1;
        break;
      }
    }

    let searchFromChar = allLines.slice(0, searchFromLine).join('\n').length;

    for (let i = 0; i < aiData.chapters.length; i++) {
      const ch = aiData.chapters[i];
      if (!ch.title) continue;

      let startPos = -1;

      // Progressive Regex search for the chapter title in the body
      // We take the first few words of the title to make matching flexible
      const titleWords = ch.title.trim().split(/\s+/).slice(0, 3);
      // Join with \s+ to allow newlines and multiple spaces between words
      const titlePattern = titleWords.map((w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
      const searchPattern = new RegExp(`(?:^|\\n)\\s*(?:${titlePattern})`, 'i');

      const bodySlice = text.substring(searchFromChar);
      const match = bodySlice.match(searchPattern);

      if (match && match.index !== undefined) {
        // Cộng thêm 1 để bỏ qua dấu \n ở đầu regex (nếu có)
        startPos = searchFromChar + match.index + (match[0].startsWith('\n') ? 1 : 0);
        searchFromChar = startPos + 50;
      }

      if (startPos === -1) {
        // FALLBACK: If we couldn't find the title, just place it 50 chars after the previous chapter
        startPos = searchFromChar + 50;
        searchFromChar = startPos;
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
    }

    // Cập nhật endPosition
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

/**
 * Sửa lỗi dính chữ (thiếu dấu cách/khoảng trắng) trong toàn bộ tiêu đề chương và các mục con bằng AI.
 * Gom toàn bộ outline thành một danh sách duy nhất để sửa đổi trong duy nhất 1 lần gọi API (tối ưu hóa hiệu năng).
 */
async function fixSpacingsInOutline(chapters: DetectedChapter[]): Promise<void> {
  // 1. Thu thập tất cả các phần cần sửa đổi tiêu đề (gồm cả chương lớn và các mục con)
  interface OutlineItemRef {
    title: string;
    update: (newTitle: string) => void;
  }

  const refs: OutlineItemRef[] = [];

  for (const ch of chapters) {
    // Thêm chương lớn
    refs.push({
      title: ch.title,
      update: (newTitle: string) => { ch.title = newTitle; }
    });

    // Duyệt đệ quy qua hierarchy mục con
    if (ch.metadata?.hierarchy) {
      const traverse = (sections: OutlineSection[]) => {
        for (const s of sections) {
          refs.push({
            title: s.title,
            update: (newTitle: string) => { s.title = newTitle; }
          });
          if (s.sections && s.sections.length > 0) {
            traverse(s.sections);
          }
        }
      };
      traverse(ch.metadata.hierarchy);
    }
  }

  if (refs.length === 0) return;

  // 2. Kiểm tra xem có bất kỳ tiêu đề nào bị dính chữ không (heuristic: có từ dài hơn 10 ký tự)
  const needsFix = refs.some(ref => {
    const words = ref.title.split(/\s+/);
    return words.some(w => w.length > 10);
  });

  if (!needsFix) return;

  console.log(`[ChapterDetector] Spacing errors detected in outline (${refs.length} items). Calling AI to correct spacing...`);

  try {
    const prompt = `Sửa lỗi dính chữ (thiếu dấu cách/khoảng trắng) trong danh sách tiêu đề chương/mục dưới đây. Trả về đúng số lượng tiêu đề theo thứ tự, giữ nguyên số chương/mục ở đầu (ví dụ: "1.1. Khái niệm" hay "1.2.2. Đặc điểm").
Nếu tiêu đề đã có dấu cách đầy đủ và đúng chính tả tiếng Việt thì bạn BẮT BUỘC phải giữ nguyên, không được tự ý sửa hay viết lại. Không thêm bớt bất kỳ từ hay số nào ngoài việc sửa lỗi khoảng cách.

Danh sách tiêu đề cần sửa:
${refs.map((ref, idx) => `${idx + 1}. "${ref.title}"`).join('\n')}

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

    if (data.corrected_titles && data.corrected_titles.length === refs.length) {
      for (let i = 0; i < refs.length; i++) {
        const original = refs[i].title;
        const corrected = data.corrected_titles[i];
        if (corrected) {
          console.log(`[ChapterDetector] Spacing Corrected: "${original}" -> "${corrected}"`);
          refs[i].update(corrected);
        }
      }
    } else {
      console.warn(`[ChapterDetector] AI spacing fixer returned mismatching items count: ${data.corrected_titles?.length} vs expected ${refs.length}`);
    }
  } catch (err) {
    console.error('[ChapterDetector] Error correcting outline spaces with AI:', err);
  }
}


// ==========================================
// PUBLIC API
// ==========================================

// Thẩm định danh sách chương của Regex bằng AI và trích xuất thêm đề cương chi tiết
async function validateRegexChaptersWithAI(text: string, regexChapters: DetectedChapter[]): Promise<boolean> {
  const previewLength = Math.min(text.length, 25000);
  const previewText = text.substring(0, previewLength);
  const detectedTitles = regexChapters.map(c => c.title);

  // Generate Chapter Proof Map
  let chapterProofMap = '';
  for (let i = 0; i < regexChapters.length; i++) {
    const ch = regexChapters[i];
    const pos = ch.startPosition;
    // Lấy 50 ký tự trước và 150 ký tự sau vị trí tìm thấy để làm bằng chứng
    const startClip = Math.max(0, pos - 50);
    const endClip = Math.min(text.length, pos + 150);
    const snippet = text.substring(startClip, endClip).replace(/\n/g, ' ').trim();
    chapterProofMap += `${i + 1}. "${ch.title}"\\n   - Trích đoạn tại vị trí tìm thấy: "...${snippet}..."\\n`;
  }

  const prompt = `Bạn là chuyên gia thẩm định cấu trúc tài liệu học thuật.
Chúng tôi đã sử dụng bộ lọc Regex để tự động phát hiện các chương/phần lớn trong tài liệu và tìm thấy danh sách sau:
${detectedTitles.map((t, idx) => `${idx + 1}. ${t}`).join('\\n')}

NHIỆM VỤ:
1. Đọc ĐOẠN ĐẦU TÀI LIỆU dưới đây (chứa Mục lục/Đề cương) và BẰNG CHỨNG CÁC CHƯƠNG.
2. BẰNG CHỨNG CÁC CHƯƠNG là trích đoạn thực tế ở giữa văn bản nơi chúng tôi tìm thấy tiêu đề chương. Hãy dùng nó để xác nhận rằng chương này thực sự tồn tại trong nội dung (tránh việc báo lỗi sai khi tài liệu không có mục lục).
3. Thẩm định xem danh sách chương phát hiện bằng Regex trên có CHÍNH XÁC và phản ánh cấu trúc chương/phần LỚN thực tế của tài liệu không (không được khớp nhầm các đề mục con ngẫu nhiên hoặc các trang rác).
4. Nếu danh sách chương này ĐÚNG, hãy trích xuất thêm đề cương phân cấp các mục con (La Mã I, II... ➔ số lẻ 1, 2... ➔ thập phân 1.1, 1.2...) của từng chương đó.
5. Nếu danh sách chương này SAI (ví dụ: khớp nhầm phần lớn văn bản không phải chương, bỏ sót nhiều chương chính, hoặc danh sách vô lý), hãy đánh giá là không hợp lệ (is_valid = false).

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
              "title": "Tên mục con Level 3 (Ví dụ: '1. Khái niệm')"
            }
          ]
        }
      ]
    }
  ]
}

BẰNG CHỨNG CÁC CHƯƠNG TÌM THẤY TRONG NỘI DUNG (PROOF MAP):
${chapterProofMap}

ĐOẠN ĐẦU TÀI LIỆU (MỤC LỤC):
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

function detectByPdfJs(text: string, headingCandidates: { text: string; fontSize: number; page: number; }[]): DetectedChapter[] {
  console.log(`[ChapterDetector/PdfJs] Analyzing ${headingCandidates.length} heading candidates`);
  const chapters: DetectedChapter[] = [];
  
  let searchFrom = 0;
  for (let i = 0; i < headingCandidates.length; i++) {
    const cand = headingCandidates[i];
    const pattern = cand.text.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
    const searchPattern = new RegExp(`(?:^|\\n)\\s*(?:${pattern})`, 'i');
    
    const bodySlice = text.substring(searchFrom);
    const match = bodySlice.match(searchPattern);
    
    if (match && match.index !== undefined) {
      const pos = searchFrom + match.index + (match[0].startsWith('\n') ? 1 : 0);
      chapters.push({
        index: chapters.length + 1,
        title: cand.text,
        content: '',
        startPosition: pos,
        endPosition: text.length,
        detectionMethod: 'regex', // Dùng chung type với regex để đồng nhất format UI
        metadata: { hierarchy: [] }
      });
      searchFrom = pos + cand.text.length;
    }
  }

  if (chapters.length < 2) return [];

  // Update endPosition
  for (let i = 0; i < chapters.length; i++) {
    const next = chapters[i + 1];
    chapters[i].endPosition = next ? next.startPosition : text.length;
    chapters[i].content = text.substring(chapters[i].startPosition, chapters[i].endPosition).trim();
  }
  
  // Filter noise
  const validChapters = chapters.filter(c => c.content.length > 50);
  
  // Bổ sung hierarchy
  for (const ch of validChapters) {
    const sections = extractSectionsFromContent(ch.content, ch.title);
    if (sections.length > 0) {
      ch.metadata = { hierarchy: sections };
    }
  }

  return validChapters.length >= 2 ? validChapters : [];
}

/**
 * Phát hiện chương trong tài liệu.
 * 
 * Regex ➔ AI Validation ➔ PdfJs Fallback ➔ AI Fallback ➔ Default chapter
 * 
 * @param text - Cleaned text của toàn bộ tài liệu
 * @param headingCandidates - (Optional) Danh sách các dòng chữ có kích thước to nhất trích xuất từ pdf.js
 * @returns Danh sách chapters đã phát hiện (luôn ≥ 1)
 */
export async function detectChapters(text: string, headingCandidates?: { text: string; fontSize: number; page: number; }[]): Promise<DetectedChapter[]> {
  // Chuẩn hóa Unicode NFC và sửa lỗi font chữ Ƣ/ƣ trong tài liệu bị lỗi font map
  text = text.normalize('NFC').replace(/Ƣ/g, 'Ư').replace(/ƣ/g, 'ư');

  console.log('[ChapterDetector] Starting detection...');

  // Step 1: Chạy Regex trước
  const regexResult = detectByRegex(text);

  let finalChapters: DetectedChapter[] = [];

  if (regexResult.length >= 2) {
    console.log(`[ChapterDetector] Super-Regex successfully extracted ${regexResult.length} chapters.`);

    // Step 2: Validate Regex Result with AI
    console.log(`[ChapterDetector] Validating Regex result with AI...`);
    const isValid = await validateRegexChaptersWithAI(text, regexResult);

    if (isValid) {
      finalChapters = regexResult;
    } else {
      console.log(`[ChapterDetector] Regex result invalidated by AI. Checking PdfJs candidates...`);
      const pdfjsResult = headingCandidates ? detectByPdfJs(text, headingCandidates) : [];
      if (pdfjsResult.length >= 2) {
        console.log(`[ChapterDetector] PdfJs successfully extracted ${pdfjsResult.length} chapters.`);
        finalChapters = pdfjsResult;
      } else {
        console.log(`[ChapterDetector] PdfJs failed. Falling back to full AI extraction...`);
        const aiResult = await detectByAI(text);
        if (aiResult.length >= 2) {
          console.log(`[ChapterDetector] AI successfully extracted outline with ${aiResult.length} chapters.`);
          finalChapters = aiResult;
        }
      }
    }
  } else {
    // Nếu Regex thất bại, thử PdfJs trước khi gọi AI
    console.log(`[ChapterDetector] Regex found too few chapters (${regexResult.length}). Checking PdfJs candidates...`);
    const pdfjsResult = headingCandidates ? detectByPdfJs(text, headingCandidates) : [];
    if (pdfjsResult.length >= 2) {
      console.log(`[ChapterDetector] PdfJs successfully extracted ${pdfjsResult.length} chapters.`);
      finalChapters = pdfjsResult;
    } else {
      console.log(`[ChapterDetector] PdfJs failed. Falling back to full AI extraction...`);
      const aiResult = await detectByAI(text);
      if (aiResult.length >= 2) {
        console.log(`[ChapterDetector] AI successfully extracted outline with ${aiResult.length} chapters.`);
        finalChapters = aiResult;
      }
    }
  }

  // Step 3: Default — 1 chương duy nhất (khi cả regex và AI đều không tìm thấy cấu trúc rõ ràng)
  if (finalChapters.length < 2) {
    console.log('[ChapterDetector] Both Regex and AI failed to find structured chapters, using default chapter.');
    finalChapters = [{
      index: 1,
      title: 'Toàn bộ tài liệu',
      content: text,
      startPosition: 0,
      endPosition: text.length,
      detectionMethod: 'default'
    }];
  }

  // Sửa lỗi dính chữ (thiếu dấu cách) trong toàn bộ tiêu đề chương và các mục con bằng AI (trong 1 lần gọi duy nhất)
  try {
    await fixSpacingsInOutline(finalChapters);
  } catch (err) {
    console.error('[ChapterDetector] Error correcting outline spaces with AI:', err);
  }

  return finalChapters;
}

/**
 * Kiểm tra xem kết quả detect có phải fallback mặc định không.
 * Dùng để hiển thị thông báo cho người dùng.
 */
export function isDefaultChapter(chapters: DetectedChapter[]): boolean {
  return chapters.length === 1 && chapters[0].detectionMethod === 'default';
}
