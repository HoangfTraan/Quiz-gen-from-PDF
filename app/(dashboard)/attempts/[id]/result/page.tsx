import Link from "next/link";
import { CheckCircle, XCircle, ArrowLeft, RefreshCw, FileText, User } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { notFound, redirect } from "next/navigation";
import AiRecommendationCard from "./AiRecommendationCard";
import ReportButton from "./ReportButton";
import { getUserRole } from "@/utils/rbac-server";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const adminDb = createAdminClient();

  // Lấy user hiện tại (dùng client bình thường để xác thực)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Dùng admin client để fetch attempt (bypass RLS)
  const { data: attempt } = await adminDb
    .from('quiz_attempts')
    .select('*, quizzes(title, id, user_id), users(full_name, email)')
    .eq('id', id)
    .single();

  if (!attempt) return notFound();

  const role = await getUserRole(user.id);

  // Kiểm tra quyền xem
  const isAttemptOwner = attempt.user_id === user.id;
  const isQuizOwner = attempt.quizzes?.user_id === user.id;
  const isTeacherViewing = isQuizOwner && !isAttemptOwner && (role === 'teacher' || role === 'admin');

  if (!isAttemptOwner && !isQuizOwner) {
    return notFound();
  }

  // Dùng admin client để fetch answers (bypass RLS cho giáo viên)
  const { data: answers } = await adminDb
    .from('attempt_answers')
    .select(`
       id,
       is_correct,
       questions (id, question_text, question_type, explanation, difficulty),
       question_options (*),
       selected_option_id
    `)
    .eq('attempt_id', id);

  // Get ALL options for each question (to display multi-select, matching etc.)
  const questionIds = answers?.map((a: any) => a.questions?.id).filter(Boolean) || [];
  const { data: allOptions } = await adminDb
    .from('question_options')
    .select('question_id, option_text, option_label, is_correct')
    .in('question_id', questionIds);

  const score = attempt.total_correct || 0;
  const total = attempt.total_questions || 0;
  const hasWrongAnswers = score < total;

  const parseExplanation = (text?: string, dbDiff?: string) => {
    if (!text) return { diff: dbDiff || null, text: '' };
    const tagMatch = text.match(/^\[MỨC ĐỘ:\s*(.*?)\]\s*(.*)/is);
    if (tagMatch) return { diff: tagMatch[1].trim(), text: tagMatch[2] };
    const aiMatch = text.match(/^(?:Đây là )?(?:câu hỏi )?(?:ở )?(?:mức độ|cấp độ)\s+([^.]*?)\.\s*(.*)/is);
    if (aiMatch) return { diff: aiMatch[1].trim(), text: aiMatch[2] };
    return { diff: dbDiff || null, text };
  };

  // Type label helper
  const getTypeLabel = (qType: string) => {
    const labels: Record<string, { text: string; color: string }> = {
      'mcq': { text: 'Trắc nghiệm', color: 'bg-blue-100 text-blue-700' },
      'true_false': { text: 'Đúng/Sai', color: 'bg-green-100 text-green-700' },
      'fill_blank': { text: 'Điền trống', color: 'bg-cyan-100 text-cyan-700' },
      'short_answer': { text: 'Trả lời ngắn', color: 'bg-purple-100 text-purple-700' },
      'multi_select': { text: 'Chọn nhiều', color: 'bg-amber-100 text-amber-700' },
      'matching': { text: 'Ghép đôi', color: 'bg-emerald-100 text-emerald-700' },
    };
    return labels[qType] || labels['mcq'];
  };

  const learnerName = attempt.users?.full_name || attempt.users?.email || "Học viên";

  return (
    <div className="animate-slide-in-left max-w-4xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <Link href={isTeacherViewing ? "/teacher-results" : "/history"} className="text-gray-500 hover:text-gray-800 flex items-center gap-2">
          <ArrowLeft size={16} /> {isTeacherViewing ? "Kết quả học viên" : "Lịch sử làm bài"}
        </Link>
        {isAttemptOwner && isQuizOwner && (
          <Link href={`/quizzes/${attempt.quizzes?.id}/start`} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 shadow-sm transition transform hover:scale-105">
            <RefreshCw size={16} /> Thi lại
          </Link>
        )}
      </div>

      {isTeacherViewing && (
        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 font-black flex items-center justify-center shrink-0 border border-purple-200">
            <User size={20} />
          </div>
          <div>
            <p className="font-bold text-purple-900">Bài làm của: {learnerName}</p>
            {attempt.users?.email && attempt.users?.full_name && (
              <p className="text-sm text-purple-600">{attempt.users.email}</p>
            )}
          </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 text-center mb-8">
        <h1 className="text-3xl font-extrabold text-blue-700 mb-2">{isTeacherViewing ? "Chi tiết bài làm" : "Kết quả bài thi"}</h1>
        <p className="text-gray-500 mb-8 font-medium">{attempt.quizzes?.title || "Bài trắc nghiệm"}</p>

        <div className="inline-flex flex-col items-center justify-center p-8 bg-blue-50/50 rounded-full border-[6px] border-blue-100 mb-6 w-56 h-56 shadow-inner">
          <span className="text-6xl font-black text-blue-700">{score}/{total}</span>
          <span className="text-md font-bold text-blue-500 mt-2 tracking-wide uppercase">Cấp độ Điểm: {total > 0 ? ((score / total) * 10).toFixed(1) : 0}</span>
        </div>

        {hasWrongAnswers ? (
          <p className="text-gray-700 font-medium text-lg">Bạn cần ôn lại <span className="font-bold text-orange-600 px-1">{total - score} khái niệm</span> để đạt kết quả hoàn hảo!</p>
        ) : (
          <p className="text-green-600 font-bold text-lg">Xuất sắc! Bạn đã vượt qua bài khi với số điểm tuyệt đối!</p>
        )}
      </div>

      {isAttemptOwner && isQuizOwner && (
        <AiRecommendationCard attemptId={id} hasWrongAnswers={hasWrongAnswers} />
      )}

      <div className="space-y-6 mb-12">
        <h2 className="text-xl font-black text-gray-800 border-b border-gray-200 pb-4 mb-6">Chi tiết đáp án ({answers?.length} câu)</h2>

        {answers?.map((ans: any, index: number) => {
          const qType = ans.questions?.question_type || 'mcq';
          const typeLabel = getTypeLabel(qType);
          const qOptions = allOptions?.filter(o => o.question_id === ans.questions?.id) || [];
          const correctOpts = qOptions.filter(o => o.is_correct);

          return (
            <div key={ans.id} className={`bg-white p-6 rounded-2xl shadow-sm relative border-l-4 ${ans.is_correct ? 'border-green-500' : 'border-red-500'} overflow-hidden`}>
              {ans.is_correct ? (
                <CheckCircle size={28} className="text-green-500 absolute top-6 right-6" />
              ) : (
                <XCircle size={28} className="text-red-500 absolute top-6 right-6" />
              )}

              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-5 pr-12">
                <h3 className="font-bold text-lg text-gray-800 leading-relaxed m-0">Câu {index + 1}: {ans.questions?.question_text}</h3>
                <div className="flex items-center gap-2 shrink-0 mt-1 sm:mt-0">
                  <span className={`${typeLabel.color} px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider`}>{typeLabel.text}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-black rounded uppercase tracking-widest border shadow-sm ${parseExplanation(ans.questions?.explanation, ans.questions?.difficulty).diff ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-gray-50 text-gray-400 border-gray-100 italic"}`}>
                    {parseExplanation(ans.questions?.explanation, ans.questions?.difficulty).diff || "Chưa phân loại"}
                  </span>
                </div>
              </div>

              {/* === ANSWER DISPLAY BY TYPE === */}
              {(qType === 'mcq' || qType === 'true_false') && (
                <>
                  {!ans.is_correct && ans.question_options && (
                    <div className="p-3 bg-red-50/50 border border-red-100 text-red-800 rounded-xl mb-3 flex items-start gap-2 relative">
                      <div className="w-1.5 h-full bg-red-300 absolute left-0 top-0 rounded-l-xl"></div>
                      <span className="font-bold opacity-70 min-w-[24px]">{ans.question_options?.option_label}.</span>
                      <span className="line-through opacity-70">{ans.question_options?.option_text}</span>
                      <span className="ml-auto text-xs font-bold text-red-500 bg-red-100 px-2 py-1 rounded">{isTeacherViewing ? "(Lựa chọn của học viên)" : "(Lựa chọn của bạn)"}</span>
                    </div>
                  )}
                  <div className="p-3 bg-green-50/50 border border-green-100 text-green-800 font-medium rounded-xl mb-4 flex items-start gap-2 relative">
                    <div className="w-1.5 h-full bg-green-400 absolute left-0 top-0 rounded-l-xl"></div>
                    <span className="font-bold text-green-700 min-w-[24px]">{correctOpts[0]?.option_label}.</span>
                    <span>{correctOpts[0]?.option_text}</span>
                    {!ans.is_correct ? (
                      <span className="ml-auto text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">(Đáp án chuẩn)</span>
                    ) : (
                      <span className="ml-auto text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">{isTeacherViewing ? "(Học viên chọn đúng)" : "(Bạn chọn đúng)"}</span>
                    )}
                  </div>
                </>
              )}

              {(qType === 'fill_blank' || qType === 'short_answer') && (
                <>
                  <div className="p-3 bg-green-50/50 border border-green-100 text-green-800 font-medium rounded-xl mb-4 flex items-start gap-2 relative">
                    <div className="w-1.5 h-full bg-green-400 absolute left-0 top-0 rounded-l-xl"></div>
                    <span className="font-bold text-green-700">Đáp án đúng:</span>
                    <span>{correctOpts[0]?.option_text || '—'}</span>
                    {ans.is_correct && (
                      <span className="ml-auto text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">{isTeacherViewing ? "(Học viên trả lời đúng)" : "(Bạn trả lời đúng)"}</span>
                    )}
                  </div>
                </>
              )}

              {qType === 'multi_select' && (
                <>
                  <div className="p-3 bg-green-50/50 border border-green-100 text-green-800 font-medium rounded-xl mb-4 relative">
                    <div className="w-1.5 h-full bg-green-400 absolute left-0 top-0 rounded-l-xl"></div>
                    <div className="pl-2">
                      <span className="font-bold text-green-700 block mb-1">Các đáp án đúng:</span>
                      <ul className="list-disc list-inside space-y-1">
                        {correctOpts.map((opt, i) => (
                          <li key={i}><span className="font-bold">{opt.option_label}.</span> {opt.option_text}</li>
                        ))}
                      </ul>
                    </div>
                    {ans.is_correct && (
                      <span className="absolute top-3 right-3 text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">{isTeacherViewing ? "(Chọn đúng tất cả)" : "(Bạn chọn đúng)"}</span>
                    )}
                  </div>
                </>
              )}

              {qType === 'matching' && (
                <>
                  <div className="p-3 bg-green-50/50 border border-green-100 text-green-800 font-medium rounded-xl mb-4 relative">
                    <div className="w-1.5 h-full bg-green-400 absolute left-0 top-0 rounded-l-xl"></div>
                    <div className="pl-2">
                      <span className="font-bold text-green-700 block mb-2">Các cặp ghép đúng:</span>
                      <div className="space-y-2">
                        {qOptions.filter(o => o.option_label?.startsWith('pair_')).map((opt, i) => {
                          try {
                            const parsed = JSON.parse(opt.option_text);
                            return (
                              <div key={i} className="flex items-center gap-2">
                                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded text-sm">{parsed.left}</span>
                                <span className="text-gray-400">→</span>
                                <span className="bg-emerald-50 text-emerald-800 font-medium px-2 py-1 rounded text-sm border border-emerald-200">{parsed.right}</span>
                              </div>
                            );
                          } catch { return null; }
                        })}
                      </div>
                    </div>
                    {ans.is_correct && (
                      <span className="absolute top-3 right-3 text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">{isTeacherViewing ? "(Ghép đúng tất cả)" : "(Bạn ghép đúng)"}</span>
                    )}
                  </div>
                </>
              )}

              <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-600 border border-gray-100 leading-relaxed">
                <strong className="text-gray-800 mr-2 flex items-center gap-1 mb-1"><FileText size={14} className="text-blue-500" /> Giải thích chi tiết:</strong>
                {parseExplanation(ans.questions?.explanation, ans.questions?.difficulty).text || 'Không có giải thích cho câu hỏi này.'}
              </div>

              {!isTeacherViewing && (
                <div className="flex justify-end mt-4">
                  <ReportButton questionId={ans.questions?.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
