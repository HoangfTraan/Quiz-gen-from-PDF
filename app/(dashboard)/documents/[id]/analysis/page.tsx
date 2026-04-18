"use client";

import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle, AlertOctagon, ArrowRight, XCircle, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";



export default function DocumentAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const documentId = resolvedParams.id;
  const searchParams = useSearchParams();
  const questionCount = parseInt(searchParams.get('questionCount') || '20', 10);
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorText, setErrorText] = useState("");
  const [quizId, setQuizId] = useState<string | null>(null);
  const router = useRouter();
  const [progressText, setProgressText] = useState("Đang khởi tạo nền tảng AI...");
  const [progressPercent, setProgressPercent] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);

  // Use ref to prevent supabase from triggering effect re-runs
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

  // Guard against React Strict Mode double-execution
  const orchestrateCalledRef = useRef(false);

  // Orchestration effect — runs once on mount only
  useEffect(() => {
    let mounted = true;
    let pollInterval: any;
    let orchestrateDone = false;

    async function checkProgress() {
      if (!mounted) return;
      try {
        const { data: doc, error: docErr } = await supabase.from('documents').select('status').eq('id', documentId).single();

        if (docErr || !doc) {
          console.error("Document query error:", docErr);
          if (orchestrateDone) {
            setStatus('error');
            setErrorText('Không tìm thấy tài liệu. Vui lòng quay lại và thử lại.');
            if (pollInterval) clearInterval(pollInterval);
          }
          return;
        }

        if (doc.status === 'completed') {
          const { data: qz } = await supabase.from('quizzes').select('id').eq('document_id', documentId).single();
          if (qz) {
            if (pollInterval) clearInterval(pollInterval);
            router.push(`/quizzes/${qz.id}/review`);
            return;
          }
          if (orchestrateDone) {
            setStatus('error');
            setErrorText('Quá trình hoàn thành nhưng không tạo được bộ đề. Vui lòng thử lại.');
            if (pollInterval) clearInterval(pollInterval);
          }
          return;
        }
        if (doc.status === 'failed') {
          setStatus('error');
          setErrorText('Quá trình phân tích thất bại. Vui lòng quay lại và thử tải lên lại tài liệu.');
          if (pollInterval) clearInterval(pollInterval);
          return;
        }

        if (doc.status === 'processing') {
           try {
               const [
                   { data: contents },
                   { count: chunksCount },
                   { data: qz }
               ] = await Promise.all([
                   supabase.from('document_contents').select('id').eq('document_id', documentId).limit(1),
                   supabase.from('document_chunks').select('id', { count: 'exact', head: true }).eq('document_id', documentId),
                   supabase.from('quizzes').select('id').eq('document_id', documentId).maybeSingle()
               ]);

               let hasContents = contents && contents.length > 0;
               let hasChunks = chunksCount && chunksCount > 0;
               let hasQuiz = !!qz;
               let qCountVal = 0;

               if (qz && qz.id) {
                   const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).eq('quiz_id', qz.id);
                   qCountVal = count || 0;
               }

               if (hasQuiz) {
                   const targetQ = Math.max(5, Math.min(200, questionCount));
                   setProgressText(`Đang sinh câu hỏi từ AI (Đã tạo ${qCountVal}/${targetQ} câu)...`);
                   const pct = Math.floor(50 + (qCountVal / targetQ) * 45); // 50 to 95%
                   setProgressPercent(Math.min(99, pct));
               } else if (hasChunks) {
                   setProgressText("Đang tóm tắt và lên dàn ý tự động...");
                   setProgressPercent(40);
               } else if (hasContents) {
                   setProgressText("Đang phân chia và cấu trúc tài liệu...");
                   setProgressPercent(20);
               } else {
                   setProgressText("Đang trích xuất văn bản và nội dung...");
                   setProgressPercent(10);
               }
           } catch (pErr) {
               console.error("Lỗi cập nhật tiến độ:", pErr);
           }
        }

        if (orchestrateDone && doc.status === 'processing') {
          setStatus('error');
          setErrorText('Quá trình xử lý gặp sự cố. Vui lòng quay lại và thử tải lên lại tài liệu.');
          if (pollInterval) clearInterval(pollInterval);
          return;
        }
      } catch (err) {
        console.error("checkProgress error:", err);
      }
    }

    async function startOrchestrator() {
      if (!mounted) return;
      await checkProgress();

      // Always start polling (even on Strict Mode re-mount)
      pollInterval = setInterval(checkProgress, 2000);

      // But only fire the API call once
      if (orchestrateCalledRef.current) return;
      orchestrateCalledRef.current = true;

      fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: documentId, questionCount: questionCount })
      }).then(() => {
        orchestrateDone = true;
        checkProgress();
      }).catch(err => {
        console.error("Fetch failed", err);
        orchestrateDone = true;
        checkProgress();
      });
    }

    startOrchestrator();
    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  return (
    <div className="animate-slide-in-right max-w-3xl mx-auto mt-8">
      <div className="mb-6">
        <Link href={`/documents`} className="text-gray-500 hover:text-gray-800 flex items-center gap-2 w-fit font-medium">
          <ArrowLeft size={20} /> Về danh sách tài liệu
        </Link>
      </div>

      <div className="bg-white p-10 rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center">
        {status === 'processing' && (
          <div className="animate-fade-in-blur flex flex-col items-center w-full">
            {/* Pulsing ring animation */}
            <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-2 rounded-full bg-blue-400/10 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.4s' }}></div>
              <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40">
                <Sparkles size={36} className="text-white animate-pulse" />
              </div>
            </div>

            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">AI đang xử lý</h1>

            {/* Real-time progress text */}
            <div className="h-7 mb-6 flex items-center justify-center w-full">
              <p className="text-gray-600 font-medium text-center animate-fade-in-blur flex items-center gap-2">
                 {progressText}
              </p>
            </div>

            {/* Real-time determinate progress bar */}
            <div className="w-full max-w-sm h-2.5 bg-gray-100 rounded-full overflow-hidden mb-8 shadow-inner relative">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-700 ease-out relative"
                style={{
                  width: `${Math.max(5, progressPercent)}%`,
                }}
              >
                 <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/30 animate-pulse" />
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-6">Thường hoàn tất trong vài giây</p>

            <button
              onClick={handleCancelClick}
              disabled={isCancelling}
              className="flex items-center justify-center gap-2 text-sm font-bold text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
            >
              <XCircle size={18} /> {isCancelling ? "Đang hủy..." : "Hủy phân tích"}
            </button>
          </div>

        )}

        {status === 'error' && (
          <div className="animate-fade-in-blur flex flex-col items-center">
            <div className="w-24 h-24 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6">
              <AlertOctagon size={48} />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-3">Xử lý thất bại!</h1>
            <p className="text-red-500 bg-red-50 px-4 py-2 border border-red-200 rounded-lg text-sm max-w-md">{errorText}</p>
          </div>
        )}

        {status === 'success' && quizId && (
          <div className="text-center animate-slide-up bg-white p-10 rounded-3xl shadow-xl border border-gray-100">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={48} className="text-green-600" />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-3">Xong! Bộ đề đã sẵn sàng</h1>
            <p className="text-gray-500 max-w-md mx-auto mb-8">Tri thức đã được chắt lọc tinh hoa! Bạn có thể bắt đầu làm bài kiểm tra hoặc xem lại bộ câu hỏi.</p>

            <Link href={`/quizzes/${quizId}/review`} className="w-fit mx-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-blue-500/30 flex items-center gap-2 transform transition hover:scale-105">
              Kiểm duyệt & Phê duyệt Đề <ArrowRight size={20} />
            </Link>
          </div>
        )}
      </div>

      {showCancelModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${modalClosing ? 'opacity-0' : 'opacity-100'}`}>
          <div className="absolute inset-0 bg-gray-900/60" onClick={closeCancelModal}></div>
          <div className={`relative bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full transition-transform duration-200 ${modalClosing ? 'scale-95 translate-y-4' : 'scale-100 translate-y-0'}`}>
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-5 mx-auto">
              <AlertOctagon size={32} />
            </div>
            <h3 className="text-2xl font-extrabold text-center text-gray-900 mb-2">Hủy phân tích AI?</h3>
            <p className="text-center text-gray-500 mb-8 font-medium leading-relaxed">Bạn có chắc muốn hủy? Tiến trình đang chạy sẽ dừng lại ngay lập tức và không thể khôi phục.</p>
            <div className="flex gap-4">
              <button
                onClick={closeCancelModal}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
              >
                Quay lại
              </button>
              <button
                onClick={confirmCancel}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-colors flex items-center justify-center gap-2"
              >
                <XCircle size={18} /> Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
