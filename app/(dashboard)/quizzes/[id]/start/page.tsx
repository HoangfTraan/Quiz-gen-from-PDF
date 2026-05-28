"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, PlayCircle, RotateCcw, ShieldOff, CheckCircle, Type, ListChecks, PenLine, GripVertical } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// Kiểu dữ liệu cho các câu trả lời
interface AnswerState {
  // MCQ / True-False: option_id đơn
  selected?: string;
  // Multi-select: set of option_ids
  multiSelected?: Set<string>;
  // Fill blank / Short answer: text
  textAnswer?: string;
  // Matching: map left -> right
  matchingPairs?: Record<string, string>;
}

export default function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetCount = searchParams.get("targetCount");
  const supabase = createClient();
  
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [quizNotPublished, setQuizNotPublished] = useState(false);
  const [alreadyAttempted, setAlreadyAttempted] = useState<{attemptId: string} | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [filter, setFilter] = useState("all");

  const parseExplanation = (text?: string) => {
    if (!text) return { diff: null, text: '' };
    const tagMatch = text.match(/^\[MỨC ĐỘ:\s*(.*?)\]\s*(.*)/is);
    if (tagMatch) return { diff: tagMatch[1].trim(), text: tagMatch[2] };
    const aiMatch = text.match(/^(?:Đây là )?(?:câu hỏi )?(?:ở )?(?:mức độ|cấp độ)\s+([^.]*?)\.\s*(.*)/is);
    if (aiMatch) return { diff: aiMatch[1].trim(), text: aiMatch[2] };
    return { diff: null, text };
  };

  const filteredQuestions = questions.filter((q: any) => {
    const qDiff = parseExplanation(q.explanation).diff?.toLowerCase() || "none";
    if (filter === "all") return true;
    return qDiff === filter.toLowerCase();
  });
  const uniqueDifficulties = Array.from(new Set(questions.map((q: any) => parseExplanation(q.explanation).diff).filter(Boolean)));

  // Đếm câu đã trả lời
  const answeredCount = filteredQuestions.filter(q => {
    const a = answers[q.id];
    if (!a) return false;
    const t = q.question_type || 'mcq';
    if (t === 'mcq' || t === 'true_false') return !!a.selected;
    if (t === 'multi_select') return a.multiSelected && a.multiSelected.size > 0;
    if (t === 'fill_blank' || t === 'short_answer') return !!a.textAnswer?.trim();
    if (t === 'matching') return a.matchingPairs && Object.keys(a.matchingPairs).length > 0;
    return false;
  }).length;

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setHasAccess(false); setLoading(false); return; }

      const { data: learnerRole } = await supabase
        .from('user_roles')
        .select('id, roles!inner(name)')
        .eq('user_id', user.id)
        .eq('roles.name', 'learner')
        .maybeSingle();
      setHasAccess(!!learnerRole);

      if (learnerRole) {
        const { data: quiz } = await supabase
          .from('quizzes')
          .select('status, user_id')
          .eq('id', id)
          .single();

        if (!quiz || (quiz.status !== 'published' && quiz.user_id !== user.id)) {
          setQuizNotPublished(true);
          setLoading(false);
          return;
        }

        const isTeacherQuiz = quiz.status === 'published' && quiz.user_id !== user.id;
        if (isTeacherQuiz) {
          const { data: existingAttempt } = await supabase
            .from('quiz_attempts')
            .select('id')
            .eq('quiz_id', id)
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();

          if (existingAttempt) {
            setAlreadyAttempted({ attemptId: existingAttempt.id });
            setLoading(false);
            return;
          }
        }

        // Load questions with question_type
        const { data } = await supabase
          .from('questions')
          .select(`id, question_text, question_type, explanation,
            question_options (id, option_label, option_text, is_correct)`)
          .eq('quiz_id', id);
        if (data) setQuestions(data);
      }
      setLoading(false);
    }
    init();
  }, [id, supabase]);

  // ==========================================
  // ANSWER HANDLERS
  // ==========================================

  const handleSelectSingle = (questionId: string, optionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], selected: optionId } }));
  };

  const handleToggleMulti = (questionId: string, optionId: string) => {
    setAnswers(prev => {
      const current = prev[questionId]?.multiSelected || new Set<string>();
      const next = new Set(current);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return { ...prev, [questionId]: { ...prev[questionId], multiSelected: next } };
    });
  };

  const handleTextAnswer = (questionId: string, text: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], textAnswer: text } }));
  };

  const handleMatchingPair = (questionId: string, leftValue: string, rightValue: string) => {
    setAnswers(prev => {
      const current = prev[questionId]?.matchingPairs || {};
      return { ...prev, [questionId]: { ...prev[questionId], matchingPairs: { ...current, [leftValue]: rightValue } } };
    });
  };

  const handleClear = (questionId: string) => {
    setAnswers(prev => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  // ==========================================
  // SUBMIT & SCORING
  // ==========================================

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Vui lòng đăng nhập");

      let totalCorrect = 0;
      const answersToInsert = [];

      for (const q of filteredQuestions) {
        const a = answers[q.id];
        const qType = q.question_type || 'mcq';
        let isCorrect = false;
        let selectedOptId: string | null = null;

        if (qType === 'mcq' || qType === 'true_false') {
          selectedOptId = a?.selected || null;
          isCorrect = q.question_options.find((o: any) => o.id === selectedOptId)?.is_correct || false;
        } else if (qType === 'multi_select') {
          // Đúng khi chọn đúng TẤT CẢ các đáp án đúng và không chọn sai
          const correctIds = new Set<string>(q.question_options.filter((o: any) => o.is_correct).map((o: any) => o.id));
          const selectedIds = a?.multiSelected || new Set<string>();
          isCorrect = correctIds.size === selectedIds.size && [...correctIds].every(cid => selectedIds.has(cid));
          selectedOptId = [...selectedIds][0] || null;
        } else if (qType === 'fill_blank' || qType === 'short_answer') {
          const correctOpt = q.question_options.find((o: any) => o.is_correct);
          const userAnswer = (a?.textAnswer || '').trim().toLowerCase();
          const correctAnswer = (correctOpt?.option_text || '').trim().toLowerCase();
          isCorrect = userAnswer === correctAnswer;
          selectedOptId = correctOpt?.id || null;
        } else if (qType === 'matching') {
          // Đúng khi ghép đúng TẤT CẢ các cặp
          const pairs = q.question_options.filter((o: any) => o.option_label?.startsWith('pair_'));
          const userPairs = a?.matchingPairs || {};
          let allCorrect = pairs.length > 0;
          for (const p of pairs) {
            try {
              const parsed = JSON.parse(p.option_text);
              if (userPairs[parsed.left] !== parsed.right) {
                allCorrect = false;
                break;
              }
            } catch { allCorrect = false; break; }
          }
          isCorrect = allCorrect;
          selectedOptId = pairs[0]?.id || null;
        }

        if (isCorrect) totalCorrect++;
        answersToInsert.push({
          question_id: q.id,
          selected_option_id: selectedOptId,
          is_correct: isCorrect
        });
      }

      const { data: attempt, error: attemptErr } = await supabase.from('quiz_attempts').insert({
        user_id: user.id,
        quiz_id: id,
        total_questions: filteredQuestions.length,
        total_correct: totalCorrect
      }).select().single();

      if (attemptErr) throw attemptErr;

      const completeAnswers = answersToInsert.map(a => ({
        ...a,
        attempt_id: attempt.id
      }));

      await supabase.from('attempt_answers').insert(completeAnswers);
      router.push(`/attempts/${attempt.id}/result`);
    } catch (e) {
      console.error("Submission failed: ", e);
      alert("Lỗi khi nộp bài. Vui lòng thử lại!");
      setSubmitting(false);
    }
  };

  // ==========================================
  // QUESTION TYPE RENDERERS
  // ==========================================

  function renderMCQ(q: any) {
    const selectedId = answers[q.id]?.selected;
    const sortedOptions = q.question_options?.sort((a: any, b: any) => (a.option_label || '').localeCompare(b.option_label || ''));
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sortedOptions?.map((opt: any) => {
          const isSelected = selectedId === opt.id;
          return (
            <div
              key={opt.id}
              onClick={() => handleSelectSingle(q.id, opt.id)}
              className={`p-4 rounded-xl transition-all cursor-pointer flex items-center gap-3 active:scale-[0.98] ${
                isSelected ? "bg-blue-50/70 border border-blue-500 text-blue-900 shadow-[0_0_0_4px_theme(colors.blue.50)]" : "bg-gray-50 hover:bg-gray-100/70 hover:border-blue-300 border border-gray-200 text-gray-700"
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-blue-600 bg-white' : 'border-gray-400 bg-white'}`}>
                {isSelected && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-page-fade" />}
              </div>
              <span className="leading-relaxed font-medium"><span className="font-bold mr-1 opacity-70">{opt.option_label}.</span> {opt.option_text}</span>
            </div>
          );
        })}
      </div>
    );
  }

  function renderTrueFalse(q: any) {
    const selectedId = answers[q.id]?.selected;
    const sortedOptions = q.question_options?.sort((a: any, b: any) => (a.option_label || '').localeCompare(b.option_label || ''));
    return (
      <div className="grid grid-cols-2 gap-4">
        {sortedOptions?.map((opt: any) => {
          const isSelected = selectedId === opt.id;
          const optText = opt.option_text?.toLowerCase() || '';
          const isTrue = optText.includes('đúng') || optText === 'true' || opt.option_label === 'A';
          return (
            <div
              key={opt.id}
              onClick={() => handleSelectSingle(q.id, opt.id)}
              className={`p-5 rounded-xl transition-all cursor-pointer flex flex-col items-center gap-2 active:scale-[0.97] ${
                isSelected
                  ? (isTrue ? "bg-green-50 border-2 border-green-500 text-green-800 shadow-lg" : "bg-red-50 border-2 border-red-500 text-red-800 shadow-lg")
                  : "bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              <span className="text-2xl">{isTrue ? '✓' : '✗'}</span>
              <span className="font-bold text-base">{opt.option_text}</span>
            </div>
          );
        })}
      </div>
    );
  }

  function renderFillBlank(q: any) {
    const textVal = answers[q.id]?.textAnswer || '';
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
          <Type size={16} className="text-blue-500" />
          Nhập câu trả lời vào ô bên dưới
        </div>
        <input
          type="text"
          value={textVal}
          onChange={(e) => handleTextAnswer(q.id, e.target.value)}
          placeholder="Nhập đáp án..."
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none font-medium text-gray-800 transition-all placeholder:text-gray-400"
        />
      </div>
    );
  }

  function renderShortAnswer(q: any) {
    const textVal = answers[q.id]?.textAnswer || '';
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
          <PenLine size={16} className="text-purple-500" />
          Viết câu trả lời ngắn gọn
        </div>
        <textarea
          value={textVal}
          onChange={(e) => handleTextAnswer(q.id, e.target.value)}
          placeholder="Nhập câu trả lời ngắn..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-50 outline-none font-medium text-gray-800 transition-all placeholder:text-gray-400 resize-none"
        />
      </div>
    );
  }

  function renderMultiSelect(q: any) {
    const selected = answers[q.id]?.multiSelected || new Set<string>();
    const sortedOptions = q.question_options?.sort((a: any, b: any) => (a.option_label || '').localeCompare(b.option_label || ''));
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-amber-600 font-bold">
          <ListChecks size={16} />
          Chọn nhiều đáp án đúng
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedOptions?.map((opt: any) => {
            const isSelected = selected.has(opt.id);
            return (
              <div
                key={opt.id}
                onClick={() => handleToggleMulti(q.id, opt.id)}
                className={`p-4 rounded-xl transition-all cursor-pointer flex items-center gap-3 active:scale-[0.98] ${
                  isSelected ? "bg-amber-50/70 border border-amber-500 text-amber-900 shadow-[0_0_0_4px_theme(colors.amber.50)]" : "bg-gray-50 hover:bg-gray-100/70 hover:border-amber-300 border border-gray-200 text-gray-700"
                }`}
              >
                <div className={`w-5 h-5 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-amber-600 bg-amber-600' : 'border-gray-400 bg-white'}`}>
                  {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="leading-relaxed font-medium"><span className="font-bold mr-1 opacity-70">{opt.option_label}.</span> {opt.option_text}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderMatching(q: any) {
    const userPairs = answers[q.id]?.matchingPairs || {};
    const pairs = q.question_options?.filter((o: any) => o.option_label?.startsWith('pair_')) || [];
    
    // Parse matching data
    const parsedPairs: { left: string; right: string }[] = [];
    for (const p of pairs) {
      try {
        const parsed = JSON.parse(p.option_text);
        parsedPairs.push({ left: parsed.left, right: parsed.right });
      } catch { /* skip invalid JSON */ }
    }

    // Stable shuffle: sort rightItems alphabetically so it's deterministic per render
    const leftItems = parsedPairs.map(p => p.left);
    const rightItems = [...new Set(parsedPairs.map(p => p.right))].sort();
    const usedRights = new Set(Object.values(userPairs));

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-emerald-600 font-bold">
          <GripVertical size={16} />
          Ghép mỗi mục bên trái với đáp án đúng bên phải
        </div>
        <div className="space-y-3">
          {leftItems.map((left, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
              <div className="bg-emerald-100 text-emerald-800 font-bold px-3 py-2 rounded-lg text-sm min-w-[120px] text-center shrink-0">
                {left}
              </div>
              <span className="text-gray-400 font-bold text-lg">→</span>
              <select
                value={userPairs[left] || ''}
                onChange={(e) => handleMatchingPair(q.id, left, e.target.value)}
                className={`flex-1 px-3 py-2.5 rounded-lg border-2 font-medium outline-none transition-all ${
                  userPairs[left] ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-gray-600'
                } focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50`}
              >
                <option value="">-- Chọn đáp án --</option>
                {rightItems.map((right, rIdx) => (
                  <option key={rIdx} value={right} disabled={usedRights.has(right) && userPairs[left] !== right}>
                    {right}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderQuestion(q: any) {
    const qType = q.question_type || 'mcq';
    switch (qType) {
      case 'true_false': return renderTrueFalse(q);
      case 'fill_blank': return renderFillBlank(q);
      case 'short_answer': return renderShortAnswer(q);
      case 'multi_select': return renderMultiSelect(q);
      case 'matching': return renderMatching(q);
      default: return renderMCQ(q);
    }
  }

  // Question type label
  function getTypeLabel(qType: string) {
    const labels: Record<string, { text: string; color: string }> = {
      'mcq': { text: 'Trắc nghiệm', color: 'bg-blue-100 text-blue-700' },
      'true_false': { text: 'Đúng/Sai', color: 'bg-green-100 text-green-700' },
      'fill_blank': { text: 'Điền trống', color: 'bg-cyan-100 text-cyan-700' },
      'short_answer': { text: 'Trả lời ngắn', color: 'bg-purple-100 text-purple-700' },
      'multi_select': { text: 'Chọn nhiều', color: 'bg-amber-100 text-amber-700' },
      'matching': { text: 'Ghép đôi', color: 'bg-emerald-100 text-emerald-700' },
    };
    return labels[qType] || labels['mcq'];
  }

  // ==========================================
  // RENDER
  // ==========================================

  if (loading) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  if (hasAccess === false) {
    return (
      <div className="max-w-lg mx-auto mt-20 p-10 bg-white rounded-2xl border border-amber-100 shadow text-center">
        <ShieldOff size={48} className="text-amber-400 mx-auto mb-4" />
        <h2 className="text-xl font-extrabold text-gray-800 mb-2">Không có quyền làm bài</h2>
        <p className="text-gray-500 mb-6">
          Tính năng làm bài chỉ dành cho tài khoản có vai trò <strong>Người học</strong>.<br/>
          Liên hệ admin để được cấp quyền.
        </p>
        <Link href="/quizzes" className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
          Về Bộ câu hỏi
        </Link>
      </div>
    );
  }

  if (alreadyAttempted) {
    return (
      <div className="max-w-lg mx-auto mt-20 p-10 bg-white rounded-2xl border border-green-100 shadow text-center">
        <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-extrabold text-gray-800 mb-2">Bạn đã hoàn thành bài thi này</h2>
        <p className="text-gray-500 mb-6">
          Bộ đề này chỉ được làm <strong>một lần duy nhất</strong>.<br />
          Bạn có thể xem lại kết quả bài làm của mình.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href={`/attempts/${alreadyAttempted.attemptId}/result`} className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
            Xem kết quả
          </Link>
          <Link href="/quizzes" className="px-6 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
            Về danh sách bộ đề
          </Link>
        </div>
      </div>
    );
  }

  if (quizNotPublished) {
    return (
      <div className="max-w-lg mx-auto mt-20 p-10 bg-white rounded-2xl border border-orange-100 shadow text-center">
        <ShieldOff size={48} className="text-orange-400 mx-auto mb-4" />
        <h2 className="text-xl font-extrabold text-gray-800 mb-2">Bộ đề chưa được xuất bản</h2>
        <p className="text-gray-500 mb-6">
          Bộ đề này chưa được giáo viên xuất bản.<br />
          Vui lòng liên hệ giáo viên của bạn để làm bài thi này.
        </p>
        <Link href="/quizzes" className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
          Về danh sách bộ đề
        </Link>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto mt-10 p-8 bg-white border border-gray-100 rounded-xl text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Không có câu hỏi nào</h2>
        <Link href="/quizzes" className="text-blue-600 font-medium hover:underline">← Quay lại danh sách</Link>
      </div>
    );
  }

  return (
    <div className="animate-page-fade max-w-4xl mx-auto px-4 pb-12">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow sticky top-6 z-10 mb-8 border border-gray-100">
        <Link href="/quizzes" className="text-gray-500 hover:text-gray-800 font-medium shrink-0 flex items-center gap-2">
           <ArrowLeft size={16} /> Thoát
        </Link>
        <div className="font-extrabold text-gray-800 flex items-center gap-2">
           <PlayCircle className="text-orange-500" size={20} /> Đang làm bài thi
        </div>
        <div className="text-gray-500 text-sm font-medium shrink-0 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
           Đã làm: <span className="font-bold text-blue-600">{answeredCount}</span><span className="text-gray-400">/{filteredQuestions.length}</span>
        </div>
      </div>

      {targetCount && questions.length < parseInt(targetCount, 10) && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100/50 flex items-center justify-center flex-shrink-0 text-blue-600 font-bold">
            💡
          </div>
          <div>
            <h4 className="font-bold text-blue-900 text-sm">Đã tối ưu hóa số lượng câu hỏi</h4>
            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
              Hệ thống đã tạo được <strong className="text-blue-900">{questions.length}</strong> trên tổng số <strong className="text-blue-900">{targetCount}</strong> câu hỏi yêu cầu. 
              Để đảm bảo tính chính xác 100%, hệ thống cam kết <strong>chỉ sử dụng thông tin gốc</strong> và dừng lại khi đã khai thác hết nội dung trong tài liệu mà không tự bịa câu hỏi ảo ngoài lề.
            </p>
          </div>
        </div>
      )}

      {questions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-8 bg-white p-4 rounded-xl shadow-sm border border-orange-100">
          <span className="text-sm font-bold text-orange-600 mr-2 uppercase tracking-tight">Chế độ luyện tập:</span>
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all shadow-md uppercase tracking-wider ${filter === "all" ? "bg-orange-500 text-white scale-105" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300"}`}
          >
            Toàn bộ đề thi
          </button>
          {uniqueDifficulties.map((diff: any) => (
            <button
              key={diff}
              onClick={() => setFilter(diff.toLowerCase())}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all shadow-md uppercase tracking-wider ${filter === diff.toLowerCase() ? "bg-orange-500 text-white scale-105" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300"}`}
            >
              Cấp độ: {diff}
            </button>
          ))}
          {questions.some((q: any) => !parseExplanation(q.explanation).diff) && (
             <button
                onClick={() => setFilter("none")}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all shadow-md uppercase tracking-wider ${filter === "none" ? "bg-gray-600 text-white scale-105" : "bg-white text-gray-400 border border-gray-200 hover:bg-gray-50 hover:border-gray-300"}`}
             >
               Chưa phân loại
             </button>
          )}
        </div>
      )}

      {filteredQuestions.length === 0 ? (
        <div className="text-center bg-gray-50 border border-gray-100 rounded-xl p-10 text-gray-500 font-medium">
          Không có câu hỏi nào thuộc phân loại này.
        </div>
      ) : (
      <div className="space-y-8">
        {filteredQuestions.map((quiz, qIndex) => {
          const qType = quiz.question_type || 'mcq';
          const typeLabel = getTypeLabel(qType);

          return (
            <div key={quiz.id} className="bg-white p-6 md:p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-100/80 transition-all hover:border-gray-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
              <h3 className="font-bold text-lg mb-2 flex items-start gap-3 text-gray-800 leading-relaxed">
                <span className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg text-sm shrink-0 mt-0.5 font-extrabold shadow-sm">Câu {qIndex + 1}</span>
                <span className="flex-1">{quiz.question_text}</span>
                <span className="flex items-center gap-1.5 shrink-0 mt-1">
                  {parseExplanation(quiz.explanation).diff && (
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">{parseExplanation(quiz.explanation).diff}</span>
                  )}
                  <span className={`${typeLabel.color} px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider`}>{typeLabel.text}</span>
                </span>
              </h3>

              <div className="mt-5">
                {renderQuestion(quiz)}
              </div>

              {answers[quiz.id] && (
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => handleClear(quiz.id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors shrink-0 bg-gray-50 hover:bg-red-50 px-3 py-2 rounded-lg border border-transparent hover:border-red-100 animate-page-fade"
                    title="Xóa lựa chọn cho câu này"
                  >
                    <RotateCcw size={14} /> Xóa lựa chọn
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex justify-center pt-8 pb-12">
          <button
            onClick={handleSubmit}
            disabled={submitting || filteredQuestions.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed text-white font-black py-4 px-12 rounded-full shadow-xl shadow-blue-500/30 text-lg transform hover:scale-105 transition-all w-full md:w-auto flex justify-center items-center gap-2"
          >
            {submitting ? <><Loader2 className="animate-spin" size={24} /> ĐANG NỘP BÀI...</> : "NỘP BÀI THI"}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
