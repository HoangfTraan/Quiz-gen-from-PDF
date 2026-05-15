import Link from "next/link";
import { CheckCircle, XCircle, ArrowLeft, RefreshCw, FileText, User } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { notFound, redirect } from "next/navigation";
import AiRecommendationCard from "./AiRecommendationCard";
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

  // Kiểm tra quyền xem:
  // 1. Người làm bài (attempt owner) luôn xem được kết quả của chính mình
  // 2. Giáo viên sở hữu bộ đề (quiz owner) được xem kết quả của học viên
  const isAttemptOwner = attempt.user_id === user.id;
  const isQuizOwner = attempt.quizzes?.user_id === user.id;
  const isTeacherViewing = isQuizOwner && !isAttemptOwner && (role === 'teacher' || role === 'admin');

  // Chặn truy cập nếu không phải attempt owner và không phải quiz owner
  if (!isAttemptOwner && !isQuizOwner) {
    return notFound();
  }

  // Dùng admin client để fetch answers (bypass RLS cho giáo viên)
  const { data: answers } = await adminDb
    .from('attempt_answers')
    .select(`
       id,
       is_correct,
       questions (id, question_text, explanation, difficulty),
       question_options (*),
       selected_option_id
    `)
    .eq('attempt_id', id);

  // Get the correct options for the questions that the user answered to display right/wrong
  const questionIds = answers?.map((a: any) => a.questions?.id) || [];
  const { data: correctOptions } = await adminDb
    .from('question_options')
    .select('question_id, option_text, option_label')
    .in('question_id', questionIds)
    .eq('is_correct', true);

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
          const correctOpt = correctOptions?.find(opt => opt.question_id === ans.questions?.id);

          return (
            <div key={ans.id} className={`bg-white p-6 rounded-2xl shadow-sm relative border-l-4 ${ans.is_correct ? 'border-green-500' : 'border-red-500'} overflow-hidden`}>
              {ans.is_correct ? (
                <CheckCircle size={28} className="text-green-500 absolute top-6 right-6" />
              ) : (
                <XCircle size={28} className="text-red-500 absolute top-6 right-6" />
              )}

              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-5 pr-12">
                <h3 className="font-bold text-lg text-gray-800 leading-relaxed m-0">Câu {index + 1}: {ans.questions?.question_text}</h3>
                <span className={`shrink-0 inline-flex items-center px-2 py-0.5 text-[10px] font-black rounded uppercase tracking-widest border shadow-sm transition-all mt-1 sm:mt-0 ${parseExplanation(ans.questions?.explanation, ans.questions?.difficulty).diff ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-gray-50 text-gray-400 border-gray-100 italic"}`}>
                  {parseExplanation(ans.questions?.explanation, ans.questions?.difficulty).diff || "Chưa phân loại"}
                </span>
              </div>

              {!ans.is_correct && (
                <div className="p-3 bg-red-50/50 border border-red-100 text-red-800 rounded-xl mb-3 flex items-start gap-2 relative">
                  <div className="w-1.5 h-full bg-red-300 absolute left-0 top-0 rounded-l-xl"></div>
                  <span className="font-bold opacity-70 min-w-[24px]">{ans.question_options?.option_label}.</span>
                  <span className="line-through opacity-70">{ans.question_options?.option_text}</span>
                  <span className="ml-auto text-xs font-bold text-red-500 bg-red-100 px-2 py-1 rounded">{isTeacherViewing ? "(Lựa chọn của học viên)" : "(Lựa chọn của bạn)"}</span>
                </div>
              )}

              <div className="p-3 bg-green-50/50 border border-green-100 text-green-800 font-medium rounded-xl mb-4 flex items-start gap-2 relative">
                <div className="w-1.5 h-full bg-green-400 absolute left-0 top-0 rounded-l-xl"></div>
                <span className="font-bold text-green-700 min-w-[24px]">{correctOpt?.option_label}.</span>
                <span>{correctOpt?.option_text}</span>
                {!ans.is_correct ? (
                  <span className="ml-auto text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">(Đáp án chuẩn)</span>
                ) : (
                  <span className="ml-auto text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">{isTeacherViewing ? "(Học viên chọn đúng)" : "(Bạn chọn đúng)"}</span>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-600 border border-gray-100 leading-relaxed">
                <strong className="text-gray-800 mr-2 flex items-center gap-1 mb-1"><FileText size={14} className="text-blue-500" /> Giải thích chi tiết:</strong>
                {parseExplanation(ans.questions?.explanation, ans.questions?.difficulty).text || 'Không có giải thích cho câu hỏi này.'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
