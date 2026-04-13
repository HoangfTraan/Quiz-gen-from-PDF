"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, PlayCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({}); // question_id -> option_id
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

  useEffect(() => {
    async function loadQuestions() {
      const { data } = await supabase
        .from('questions')
        .select(`
          id,
          question_text,
          explanation,
          question_options (id, option_label, option_text, is_correct)
        `)
        .eq('quiz_id', id);

      if (data) setQuestions(data);
      setLoading(false);
    }
    loadQuestions();
  }, [id, supabase]);

  const handleSelect = (questionId: string, optionId: string) => {
    setSelectedAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Vui lòng đăng nhập");

        let totalCorrect = 0;
        const answersToInsert = [];

        // Compute correct answers locally
        for (const q of filteredQuestions) {
            const selectedOptId = selectedAnswers[q.id];
            const isCorrect = q.question_options.find((o: any) => o.id === selectedOptId)?.is_correct || false;
            if (isCorrect) totalCorrect++;

            // We prepare it but need attempt_id first
            answersToInsert.push({
                question_id: q.id,
                selected_option_id: selectedOptId || null,
                is_correct: isCorrect
            });
        }

        // Insert Attempt
        const { data: attempt, error: attemptErr } = await supabase.from('quiz_attempts').insert({
            user_id: user.id,
            quiz_id: id,
            total_questions: filteredQuestions.length,
            total_correct: totalCorrect
        }).select().single();

        if (attemptErr) throw attemptErr;

        // Insert Answers
        const completeAnswers = answersToInsert.map(a => ({
            ...a,
            attempt_id: attempt.id
        }));

        await supabase.from('attempt_answers').insert(completeAnswers);

        // Navigate to result
        router.push(`/attempts/${attempt.id}/result`);
    } catch (e) {
        console.error("Submission failed: ", e);
        alert("Lỗi khi nộp bài. Vui lòng thử lại!");
        setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  if (questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto mt-10 p-8 bg-white border border-gray-100 rounded-xl text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Không có câu hỏi nào</h2>
        <Link href={`/quizzes/${id}`} className="text-blue-600 font-medium hover:underline">← Quay lại danh sách</Link>
      </div>
    );
  }

  return (
    <div className="animate-slide-in-right max-w-4xl mx-auto px-4 pb-12">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow sticky top-6 z-10 mb-8 border border-gray-100">
        <Link href={`/quizzes/${id}`} className="text-gray-500 hover:text-gray-800 font-medium shrink-0 flex items-center gap-2">
           <ArrowLeft size={16} /> Thoát
        </Link>
        <div className="font-extrabold text-gray-800 flex items-center gap-2">
           <PlayCircle className="text-orange-500" size={20} /> Đang làm bài thi
        </div>
        <div className="text-gray-500 text-sm font-medium shrink-0 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
           Đã làm: <span className="font-bold text-blue-600">{Object.keys(selectedAnswers).length}</span><span className="text-gray-400">/{filteredQuestions.length}</span>
        </div>
      </div>

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
          const selected = selectedAnswers[quiz.id];

          // Sort options A, B, C, D stably
          const sortedOptions = quiz.question_options?.sort((a: any, b: any) => a.option_label.localeCompare(b.option_label));

          return (
            <div key={quiz.id} className="bg-white p-6 md:p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-100/80 transition-all hover:border-gray-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
              <h3 className="font-bold text-lg mb-6 flex items-start gap-4 text-gray-800 leading-relaxed">
                <span className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg text-sm shrink-0 mt-0.5 font-extrabold shadow-sm">Câu {qIndex + 1}</span> 
                {quiz.question_text}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sortedOptions?.map((opt: any) => {
                  const isSelected = selected === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSelect(quiz.id, opt.id)}
                      className={`p-4 rounded-xl transition-all cursor-pointer flex items-center gap-3 active:scale-[0.98] ${
                        isSelected ? "bg-blue-50/70 border border-blue-500 text-blue-900 shadow-[0_0_0_4px_theme(colors.blue.50)]" : "bg-gray-50 hover:bg-gray-100/70 hover:border-blue-300 border border-gray-200 text-gray-700"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-blue-600 bg-white' : 'border-gray-400 bg-white'}`}>
                        {isSelected && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-fade-in-blur" />}
                      </div>
                      <span className="leading-relaxed font-medium"><span className="font-bold mr-1 opacity-70">{opt.option_label}.</span> {opt.option_text}</span>
                    </div>
                  )
                })}
              </div>
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
