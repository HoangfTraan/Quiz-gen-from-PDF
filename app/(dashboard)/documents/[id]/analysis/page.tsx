"use client";

import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, CheckCircle, AlertOctagon, ArrowRight, XCircle,
  Sparkles, Eye, Play, BookOpen, CheckSquare, Square, Info,
  ChevronDown, ChevronUp, Loader2
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type AnalysisPhase = 'loading' | 'analyzing' | 'select-chapters' | 'generating' | 'success' | 'error';

interface Chapter {
  id: string;
  chapter_index: number;
  title: string;
  content: string | null;
  summary: string | null;
  start_page: number | null;
  end_page: number | null;
  detection_method: string;
  metadata: any;
}

// Hàm đệ quy render cấu trúc đề cương phân cấp (Tree-view) với Checkboxes tương tác
function renderHierarchy(
  sections: any[],
  chapterId: string,
  selectedSet: Set<string>,
  onToggle: (title: string, checked: boolean) => void,
  level: number = 0
): React.ReactNode {
  if (!sections || sections.length === 0) return null;
  return (
    <div className={`flex flex-col gap-2 ${level > 0 ? 'ml-5 pl-4 border-l border-dashed border-gray-200 mt-1.5' : 'mt-2'}`}>
      {sections.map((sec: any, idx: number) => {
        const isChecked = selectedSet?.has(sec.title) ?? false;
        return (
          <div key={idx} className="flex flex-col">
            <div className="flex items-start gap-2.5 py-0.5 text-xs text-gray-600 group">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => onToggle(sec.title, e.target.checked)}
                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer mt-0.5 transition-all"
              />
              <span className={`leading-relaxed select-none ${level === 0 ? 'text-gray-800 font-bold' : 'text-gray-500 font-semibold'} transition-colors group-hover:text-gray-900`}>
                {sec.title}
              </span>
            </div>
            {sec.sections && renderHierarchy(sec.sections, chapterId, selectedSet, onToggle, level + 1)}
          </div>
        );
      })}
    </div>
  );
}

// Lấy tất cả tiêu đề các mục trong đề cương phân cấp
function getAllSectionTitles(sections: any[]): string[] {
  if (!sections || sections.length === 0) return [];
  let titles: string[] = [];
  for (const sec of sections) {
    titles.push(sec.title);
    if (sec.sections) {
      titles.push(...getAllSectionTitles(sec.sections));
    }
  }
  return titles;
}

// Lấy tiêu đề toàn bộ các mục con của một nút mục lục cụ thể
function getChildTitles(node: any): string[] {
  let titles: string[] = [];
  if (node.sections) {
    for (const child of node.sections) {
      titles.push(child.title);
      titles.push(...getChildTitles(child));
    }
  }
  return titles;
}

// Tìm nút mục lục cụ thể theo tiêu đề
function findSectionNode(sections: any[], title: string): any | null {
  for (const sec of sections) {
    if (sec.title === title) return sec;
    if (sec.sections) {
      const found = findSectionNode(sec.sections, title);
      if (found) return found;
    }
  }
  return null;
}

export default function DocumentAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const documentId = resolvedParams.id;
  const searchParams = useSearchParams();
  const questionCount = parseInt(searchParams.get('questionCount') || '20', 10);
  const bloomLevelsParam = searchParams.get('bloomLevels') || '';
  const bloomLevels = bloomLevelsParam ? bloomLevelsParam.split(',') : [];
  const questionTypesParam = searchParams.get('questionTypes') || '';
  const questionTypes = questionTypesParam ? questionTypesParam.split(',') : ['mcq'];

  // Phase state
  const [phase, setPhase] = useState<AnalysisPhase>('loading');
  const [errorText, setErrorText] = useState("");
  const [quizId, setQuizId] = useState<string | null>(null);
  const router = useRouter();

  // Analysis progress
  const [progressText, setProgressText] = useState("Đang khởi tạo nền tảng AI...");
  const [progressPercent, setProgressPercent] = useState(0);

  // Chapter selection
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());
  const [selectedSectionMap, setSelectedSectionMap] = useState<Record<string, Set<string>>>({});
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [isDefaultChapter, setIsDefaultChapter] = useState(false);
  const [docTitle, setDocTitle] = useState('');

  // Generation progress
  const [genProgressText, setGenProgressText] = useState("Đang chuẩn bị...");
  const [genProgressPercent, setGenProgressPercent] = useState(0);

  // Cancel
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);

  // Role
  const [canReview, setCanReview] = useState(false);
  const [canTake, setCanTake] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const canReviewRef = useRef(false);
  const canTakeRef = useRef(false);
  const roleLoadingRef = useRef(true);

  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const handleCancelClick = () => {
    setModalClosing(false);
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    setModalClosing(true);
    setTimeout(() => setShowCancelModal(false), 200);
  };

  const confirmCancel = async () => {
    setIsCancelling(true);
    await supabase.from('documents').update({ status: 'failed' }).eq('id', documentId);
    window.location.href = '/documents';
  };

  // Check role
  useEffect(() => {
    async function checkRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single();
        if (dbUser?.role === 'admin') {
          setCanReview(true);
          canReviewRef.current = true;
          return;
        }
        const { data: userRoles } = await supabase
          .from('user_roles').select('id, roles!inner(name)')
          .eq('user_id', user.id);
        if (userRoles && userRoles.length > 0) {
          const roleNames = userRoles.map((ur: any) => ur.roles?.name);
          if (roleNames.includes('teacher')) {
            setCanReview(true);
            canReviewRef.current = true;
          }
          if (roleNames.includes('learner')) {
            setCanTake(true);
            canTakeRef.current = true;
          }
        }
      } catch (err) {
        console.error("Error checking role:", err);
      } finally {
        setRoleLoading(false);
        roleLoadingRef.current = false;
      }
    }
    checkRole();
  }, [supabase]);

  // ==========================================
  // PHASE 1: ANALYZE DOCUMENT
  // ==========================================
  // Guard: chỉ gọi API 1 lần, nhưng polling luôn chạy ở mọi mount
  // (React Strict Mode unmount/remount component — polling phải restart)
  const analyzeCalledRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let pollInterval: any;

    async function checkAnalysisStatus() {
      if (!mounted) return;
      try {
        const { data: doc } = await supabase.from('documents').select('status, title').eq('id', documentId).single();
        if (!doc || !mounted) return;
        setDocTitle(doc.title);

        if (doc.status === 'analyzed') {
          clearInterval(pollInterval);
          if (mounted) await loadChapters();
          return;
        }

        if (doc.status === 'completed') {
          clearInterval(pollInterval);
          const { data: qz } = await supabase.from('quizzes').select('id').eq('document_id', documentId).single();
          if (qz && mounted) {
            if (canReviewRef.current) {
              router.push(`/quizzes/${qz.id}?targetCount=${questionCount}`);
            } else if (canTakeRef.current) {
              router.push(`/quizzes/${qz.id}/start?targetCount=${questionCount}`);
            } else {
              router.push(`/quizzes/${qz.id}?targetCount=${questionCount}`);
            }
          } else if (mounted) {
            await loadChapters();
          }
          return;
        }

        if (doc.status === 'failed') {
          clearInterval(pollInterval);
          if (mounted) {
            setPhase('error');
            setErrorText('Quá trình phân tích thất bại. Vui lòng quay lại và thử tải lên lại tài liệu.');
          }
          return;
        }

        // Đang processing → cập nhật progress
        if (mounted) {
          const [{ data: contents }, { count: chaptersCount }] = await Promise.all([
            supabase.from('document_contents').select('id').eq('document_id', documentId).limit(1),
            supabase.from('chapters').select('id', { count: 'exact', head: true }).eq('document_id', documentId)
          ]);

          if (chaptersCount && chaptersCount > 0) {
            setProgressText("Đang tóm tắt nội dung tài liệu...");
            setProgressPercent(80);
          } else if (contents && contents.length > 0) {
            setProgressText("Đang nhận diện cấu trúc chương...");
            setProgressPercent(50);
          } else {
            setProgressText("Đang trích xuất văn bản từ tài liệu...");
            setProgressPercent(20);
          }
        }
      } catch (err) {
        console.error("checkAnalysisStatus error:", err);
      }
    }

    async function startAnalysis() {
      if (!mounted) return;

      // Kiểm tra trạng thái hiện tại trước
      await checkAnalysisStatus();

      // Nếu db trả về đã phân tích hoặc đang tải chương thì checkAnalysisStatus đã đổi phase.
      // Chúng ta sẽ đổi phase thành analyzing nếu tài liệu đang processing ở useEffect trên,
      // hoặc khi ta thực sự phải gọi API orchestrate.

      // Luôn bắt đầu polling (kể cả khi Strict Mode remount)
      pollInterval = setInterval(checkAnalysisStatus, 2000);

      // Chỉ gọi API orchestrate 1 lần duy nhất (guard bằng ref)
      if (analyzeCalledRef.current) return;
      analyzeCalledRef.current = true;

      const { data: docInfo } = await supabase.from('documents').select('status').eq('id', documentId).single();
      
      // Nếu đã analyze xong thì không cần gọi webhook nữa
      if (docInfo && (docInfo.status === 'analyzed' || docInfo.status === 'completed' || docInfo.status === 'failed')) {
        return; 
      }

      setPhase('analyzing');
      setProgressPercent(5);
      setProgressText("Đang khởi tạo phân tích AI...");

      fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, phase: 'analyze' })
      }).then(() => {
        if (mounted) checkAnalysisStatus();
      }).catch(err => {
        console.error("Analyze fetch failed:", err);
        if (mounted) checkAnalysisStatus();
      });
    }

    startAnalysis();
    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // ==========================================
  // LOAD CHAPTERS
  // ==========================================
  async function loadChapters() {
    try {
      const res = await fetch(`/api/chapters?documentId=${documentId}`);
      const data = await res.json();

      if (data.chapters && data.chapters.length > 0) {
        setChapters(data.chapters);
        // Default: chọn tất cả các chương
        setSelectedChapterIds(new Set(data.chapters.map((c: Chapter) => c.id)));

        // Khởi tạo bản đồ các phần con được chọn (mặc định chọn tất cả)
        const initialMap: Record<string, Set<string>> = {};
        data.chapters.forEach((ch: Chapter) => {
          if (ch.metadata?.hierarchy) {
            initialMap[ch.id] = new Set(getAllSectionTitles(ch.metadata.hierarchy));
          } else {
            initialMap[ch.id] = new Set();
          }
        });
        setSelectedSectionMap(initialMap);

        // Kiểm tra default chapter
        const isDefault = data.chapters.length === 1 &&
          data.chapters[0].metadata?.is_default === true;
        setIsDefaultChapter(isDefault);

        setPhase('select-chapters');
      } else {
        setPhase('error');
        setErrorText('Không tìm thấy chương nào trong tài liệu.');
      }
    } catch (err) {
      console.error("loadChapters error:", err);
      setPhase('error');
      setErrorText('Lỗi khi tải danh sách chương.');
    }
  }

  // ==========================================
  // CHAPTER & SECTION SELECTION HANDLERS
  // ==========================================
  const toggleChapter = (id: string) => {
    setSelectedChapterIds(prev => {
      const next = new Set(prev);
      const isSelected = next.has(id);
      
      const chapter = chapters.find(c => c.id === id);
      const allTitles = chapter?.metadata?.hierarchy ? getAllSectionTitles(chapter.metadata.hierarchy) : [];

      if (isSelected) {
        next.delete(id);
        // Bỏ chọn toàn bộ phần con
        setSelectedSectionMap(prevMap => ({
          ...prevMap,
          [id]: new Set()
        }));
      } else {
        next.add(id);
        // Chọn toàn bộ phần con
        setSelectedSectionMap(prevMap => ({
          ...prevMap,
          [id]: new Set(allTitles)
        }));
      }
      return next;
    });
  };

  const handleSectionToggle = (chapterId: string, sectionTitle: string, checked: boolean) => {
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter || !chapter.metadata?.hierarchy) return;

    const node = findSectionNode(chapter.metadata.hierarchy, sectionTitle);
    if (!node) return;

    const affectedTitles = [sectionTitle, ...getChildTitles(node)];

    setSelectedSectionMap(prev => {
      const nextSet = new Set(prev[chapterId] || new Set());
      for (const title of affectedTitles) {
        if (checked) {
          nextSet.add(title);
        } else {
          nextSet.delete(title);
        }
      }
      
      // Nếu có ít nhất 1 mục con được chọn, tự động đảm bảo chapter.id nằm trong selectedChapterIds!
      // Ngược lại, nếu không có mục nào được chọn, tự động bỏ chọn chapter.id khỏi selectedChapterIds.
      setSelectedChapterIds(prevChapters => {
        const nextChapters = new Set(prevChapters);
        if (nextSet.size > 0) {
          nextChapters.add(chapterId);
        } else {
          nextChapters.delete(chapterId);
        }
        return nextChapters;
      });

      return {
        ...prev,
        [chapterId]: nextSet
      };
    });
  };

  const selectAll = () => {
    setSelectedChapterIds(new Set(chapters.map(c => c.id)));
    const newMap: Record<string, Set<string>> = {};
    chapters.forEach(ch => {
      const allTitles = ch.metadata?.hierarchy ? getAllSectionTitles(ch.metadata.hierarchy) : [];
      newMap[ch.id] = new Set(allTitles);
    });
    setSelectedSectionMap(newMap);
  };

  const deselectAll = () => {
    setSelectedChapterIds(new Set());
    const newMap: Record<string, Set<string>> = {};
    chapters.forEach(ch => {
      newMap[ch.id] = new Set();
    });
    setSelectedSectionMap(newMap);
  };

  // ==========================================
  // PHASE 2: GENERATE QUESTIONS
  // ==========================================
  const generateCalledRef = useRef(false);

  const handleGenerate = async () => {
    if (generateCalledRef.current) return;
    if (selectedChapterIds.size === 0) return;
    generateCalledRef.current = true;

    setPhase('generating');
    setGenProgressPercent(5);
    setGenProgressText("Đang chuẩn bị tạo câu hỏi...");

    // Poll generation progress
    const pollGen = setInterval(async () => {
      try {
        const { data: doc } = await supabase.from('documents').select('status').eq('id', documentId).single();
        if (!doc) return;

        if (doc.status === 'completed') {
          clearInterval(pollGen);
          const { data: qz } = await supabase.from('quizzes').select('id').eq('document_id', documentId).single();
          if (qz) {
            if (roleLoadingRef.current) return;
            if (canReviewRef.current) {
              router.push(`/quizzes/${qz.id}?targetCount=${questionCount}`);
            } else if (canTakeRef.current) {
              router.push(`/quizzes/${qz.id}/start?targetCount=${questionCount}`);
            } else {
              router.push(`/quizzes/${qz.id}?targetCount=${questionCount}`);
            }
          }
          return;
        }

        if (doc.status === 'failed') {
          clearInterval(pollGen);
          setPhase('error');
          setErrorText('Tạo câu hỏi thất bại. Vui lòng thử lại.');
          generateCalledRef.current = false;
          return;
        }

        // Check question count
        const { data: qz } = await supabase.from('quizzes').select('id').eq('document_id', documentId).maybeSingle();
        if (qz?.id) {
          const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).eq('quiz_id', qz.id);
          const qCount = count || 0;
          const targetQ = Math.max(5, Math.min(200, questionCount));
          setGenProgressText(`Đang sinh câu hỏi từ AI (${qCount}/${targetQ} câu)...`);
          const pct = Math.floor(10 + (qCount / targetQ) * 85);
          setGenProgressPercent(Math.min(99, pct));
        }
      } catch (err) {
        console.error("pollGen error:", err);
      }
    }, 2000);

    // Fire generate API
    try {
      const res = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          phase: 'generate',
          questionCount,
          bloomLevels,
          questionTypes,
          selectedChapterIds: Array.from(selectedChapterIds),
          selectedSections: Object.fromEntries(
            Object.entries(selectedSectionMap).map(([cid, set]) => [cid, Array.from(set)])
          )
        })
      });

      const result = await res.json();
      if (!res.ok) {
        clearInterval(pollGen);
        setPhase('error');
        setErrorText(result.error || 'Lỗi tạo câu hỏi.');
        generateCalledRef.current = false;
        return;
      }

      // API trả về thành công → đợi poll detect completed
    } catch (err: any) {
      clearInterval(pollGen);
      setPhase('error');
      setErrorText(err.message || 'Lỗi kết nối.');
      generateCalledRef.current = false;
    }
  };

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="animate-slide-in-right max-w-3xl mx-auto mt-8">
      <div className="mb-6">
        <Link href="/documents" className="text-gray-500 hover:text-gray-800 flex items-center gap-2 w-fit font-medium">
          <ArrowLeft size={20} /> Về danh sách tài liệu
        </Link>
      </div>

      <div className="bg-white p-10 rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center">

        {/* ==========================================
            PHASE: LOADING (Khởi tạo trang)
            ========================================== */}
        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center py-20 w-full animate-fade-in-blur">
            <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
            <h2 className="text-xl font-bold text-gray-700">Đang tải dữ liệu...</h2>
            <p className="text-sm text-gray-500 mt-2">Vui lòng đợi trong giây lát</p>
          </div>
        )}

        {/* ==========================================
            PHASE: ANALYZING (Phase 1)
            ========================================== */}
        {phase === 'analyzing' && (
          <div className="animate-fade-in-blur flex flex-col items-center w-full">
            <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-2 rounded-full bg-blue-400/10 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.4s' }}></div>
              <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40">
                <BookOpen size={36} className="text-white animate-pulse" />
              </div>
            </div>

            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Đang phân tích tài liệu</h1>
            <div className="h-7 mb-6 flex items-center justify-center w-full">
              <p className="text-gray-600 font-medium text-center animate-fade-in-blur flex items-center gap-2">
                {progressText}
              </p>
            </div>

            <div className="w-full max-w-sm h-2.5 bg-gray-100 rounded-full overflow-hidden mb-8 shadow-inner relative">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-700 ease-out relative"
                style={{ width: `${Math.max(5, progressPercent)}%` }}
              >
                <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/30 animate-pulse" />
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-6">Hệ thống đang nhận diện cấu trúc chương...</p>

            <button
              onClick={handleCancelClick}
              disabled={isCancelling}
              className="flex items-center justify-center gap-2 text-sm font-bold text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
            >
              <XCircle size={18} /> {isCancelling ? "Đang hủy..." : "Hủy phân tích"}
            </button>
          </div>
        )}

        {/* ==========================================
            PHASE: SELECT CHAPTERS (Phase 2)
            ========================================== */}
        {phase === 'select-chapters' && (
          <div className="animate-fade-in-blur w-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <BookOpen size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900">Cấu trúc tài liệu đã phát hiện</h1>
                <p className="text-sm text-gray-500 font-medium">{docTitle}</p>
              </div>
            </div>

            {/* Thông báo tài liệu không có chương */}
            {isDefaultChapter && (
              <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <Info size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-800">Tài liệu không có cấu trúc chương rõ ràng</p>
                  <p className="text-xs text-amber-600 mt-1">
                    Hệ thống không nhận diện được các chương/phần trong tài liệu này.
                    Toàn bộ nội dung sẽ được xử lý như một phần duy nhất.
                  </p>
                </div>
              </div>
            )}

            {/* Danh sách chương */}
            <div className="space-y-2 mb-6">
              {chapters.map((chapter) => {
                const isSelected = selectedChapterIds.has(chapter.id);
                const isExpanded = expandedChapterId === chapter.id;

                return (
                  <div key={chapter.id} className={`border-2 rounded-xl transition-all ${
                    isSelected ? 'border-blue-200 bg-blue-50/50' : 'border-gray-100 bg-white'
                  }`}>
                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => toggleChapter(chapter.id)}>
                      <button className="flex-shrink-0 text-blue-600 hover:text-blue-700 transition-colors">
                        {isSelected ? <CheckSquare size={22} /> : <Square size={22} className="text-gray-300" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm truncate ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                          {chapter.title}
                        </p>
                        {chapter.start_page && (
                          <p className="text-xs text-gray-400">Trang {chapter.start_page}{chapter.end_page ? ` - ${chapter.end_page}` : ''}</p>
                        )}
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        chapter.detection_method === 'regex' ? 'bg-green-100 text-green-700' :
                        chapter.detection_method === 'ai' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {chapter.detection_method}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedChapterId(isExpanded ? null : chapter.id); }}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-gray-100/80 bg-gray-50/20">
                        {chapter.metadata?.hierarchy && chapter.metadata.hierarchy.length > 0 ? (
                          <div className="py-1">
                            <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider select-none">
                              Đề cương chương chi tiết:
                            </p>
                            {renderHierarchy(
                              chapter.metadata.hierarchy,
                              chapter.id,
                              selectedSectionMap[chapter.id] || new Set(),
                              (title, checked) => handleSectionToggle(chapter.id, title, checked)
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {chapter.summary || (chapter.content ? chapter.content.substring(0, 180).replace(/[\r\n]+/g, ' ').trim() + '...' : 'Chưa có tóm tắt cho chương này.')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-500 font-medium">
                Đã chọn: <span className="font-extrabold text-gray-800">{selectedChapterIds.size}</span>/{chapters.length} chương
              </p>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-bold transition-colors">
                  Chọn tất cả
                </button>
                <button onClick={deselectAll} className="text-xs px-3 py-1.5 bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 font-bold transition-colors">
                  Bỏ chọn
                </button>
              </div>
            </div>

            {(() => {
              const selectedContentLength = chapters
                .filter(c => selectedChapterIds.has(c.id))
                .reduce((sum, c) => sum + (c.content?.length || 0), 0);
              const maxReasonableQuestions = Math.max(1, Math.floor(selectedContentLength / 500));
              const isOverLimit = selectedChapterIds.size > 0 && questionCount > maxReasonableQuestions;
              if (!isOverLimit) return null;
              const contentKB = (selectedContentLength / 1024).toFixed(1);
              return (
                <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-left w-full">
                  <AlertOctagon size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-800">Cảnh báo: Số lượng câu hỏi lớn</p>
                    <p className="text-xs text-amber-600 mt-1 leading-relaxed">
                      Bạn đang yêu cầu tạo <span className="font-bold">{questionCount} câu hỏi</span> từ nội dung khoảng <span className="font-bold">{contentKB} KB</span> văn bản (ước tính tối đa hợp lý: ~<span className="font-bold">{maxReasonableQuestions} câu</span>). 
                      Hệ thống sẽ nỗ lực tối đa để sinh nhiều câu hỏi nhất có thể nhưng cam kết <span className="font-bold text-amber-700 underline">chỉ sử dụng thông tin gốc và TUYỆT ĐỐI không tự bịa (hallucinate) hay tạo câu hỏi ảo ngoài tài liệu</span>.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={selectedChapterIds.size === 0}
              className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] ${
                selectedChapterIds.size === 0
                  ? 'bg-gray-300 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/30'
              }`}
            >
              <Sparkles size={20} />
              Tạo {questionCount} câu hỏi từ {selectedChapterIds.size} chương đã chọn
            </button>
          </div>
        )}

        {/* ==========================================
            PHASE: GENERATING (Phase 3)
            ========================================== */}
        {phase === 'generating' && (
          <div className="animate-fade-in-blur flex flex-col items-center w-full">
            <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-indigo-400/20 animate-ping" style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-2 rounded-full bg-indigo-400/10 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.4s' }}></div>
              <div className="relative w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/40">
                <Sparkles size={36} className="text-white animate-pulse" />
              </div>
            </div>

            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Đang tạo câu hỏi</h1>
            <div className="h-7 mb-6 flex items-center justify-center w-full">
              <p className="text-gray-600 font-medium text-center animate-fade-in-blur flex items-center gap-2">
                {genProgressText}
              </p>
            </div>

            <div className="w-full max-w-sm h-2.5 bg-gray-100 rounded-full overflow-hidden mb-8 shadow-inner relative">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-700 ease-out relative"
                style={{ width: `${Math.max(5, genProgressPercent)}%` }}
              >
                <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/30 animate-pulse" />
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-6">
              Đang tạo câu hỏi từ {selectedChapterIds.size} chương đã chọn...
            </p>

            <button
              onClick={handleCancelClick}
              disabled={isCancelling}
              className="flex items-center justify-center gap-2 text-sm font-bold text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
            >
              <XCircle size={18} /> {isCancelling ? "Đang hủy..." : "Hủy tạo câu hỏi"}
            </button>
          </div>
        )}

        {/* ==========================================
            PHASE: ERROR
            ========================================== */}
        {phase === 'error' && (
          <div className="animate-fade-in-blur flex flex-col items-center">
            <div className="w-24 h-24 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6">
              <AlertOctagon size={48} />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-3">Xử lý thất bại!</h1>
            <p className="text-red-500 bg-red-50 px-4 py-2 border border-red-200 rounded-lg text-sm max-w-md text-center">{errorText}</p>
            <Link href="/documents" className="mt-6 text-blue-600 hover:text-blue-700 font-bold flex items-center gap-2">
              <ArrowLeft size={16} /> Quay lại danh sách
            </Link>
          </div>
        )}


      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${modalClosing ? 'opacity-0' : 'opacity-100'}`}>
          <div className="absolute inset-0 bg-gray-900/60" onClick={closeCancelModal}></div>
          <div className={`relative bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full transition-transform duration-200 ${modalClosing ? 'scale-95 translate-y-4' : 'scale-100 translate-y-0'}`}>
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-5 mx-auto">
              <AlertOctagon size={32} />
            </div>
            <h3 className="text-2xl font-extrabold text-center text-gray-900 mb-2">Hủy quá trình?</h3>
            <p className="text-center text-gray-500 mb-8 font-medium leading-relaxed">Tiến trình đang chạy sẽ dừng lại ngay lập tức và không thể khôi phục.</p>
            <div className="flex gap-4">
              <button onClick={closeCancelModal} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">
                Quay lại
              </button>
              <button onClick={confirmCancel} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-colors flex items-center justify-center gap-2">
                <XCircle size={18} /> Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
