import Link from "next/link";
import { ArrowLeft, Play, Edit3 } from "lucide-react";
import QuestionList from "./QuestionList";
import QuizActions from "./QuizActions";
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { getUserRole } from "@/utils/rbac-server";
import { canManageQuiz, canTakeQuiz } from "@/utils/rbac";

export default async function QuizDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Lấy user hiện tại và role
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user ? await getUserRole(user.id) : "user";
  const canManage = canManageQuiz(role);
  const canTake = canTakeQuiz(role);

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("*, documents(title)")
    .eq("id", id)
    .single();

  if (!quiz) return notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select(
      `
       id,
       question_text,
       explanation,
       difficulty,
       moderation_status,
       question_options (id, option_label, option_text, is_correct)
    `
    )
    .eq("quiz_id", id);

  return (
    <div className="animate-slide-in-right max-w-4xl mx-auto px-4 pb-20">
      <div className="mb-6 flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
        <Link
          href="/quizzes"
          className="text-gray-500 hover:text-gray-800 flex items-center gap-2 font-medium"
        >
          <ArrowLeft size={16} /> Bộ câu hỏi
        </Link>
        <div className="flex flex-wrap gap-2">
          {/* Kiểm duyệt: chỉ teacher/admin */}
          {canManage && quiz.status === "draft" && (
            <Link
              href={`/quizzes/${id}/review`}
              className="px-4 py-2 text-sm font-medium border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 flex items-center gap-2"
            >
              <Edit3 size={16} /> Kiểm duyệt ngay
            </Link>
          )}

          {/* Xóa / Publish: chỉ teacher/admin */}
          {canManage && (
            <QuizActions quizId={id} initialStatus={quiz.status} />
          )}

          {/* Làm bài: chỉ learner */}
          {canTake && (
            <Link
              href={`/quizzes/${id}/start`}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 shadow-sm transition-transform hover:scale-105"
            >
              <Play size={16} /> Làm bài thi
            </Link>
          )}

          {/* Thông báo cho user/teacher không được làm bài */}
          {!canTake && role !== "learner" && (
            <span className="px-4 py-2 text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-lg">
              {role === "teacher" || role === "admin"
                ? "Giáo viên không làm bài"
                : "Yêu cầu quyền Người học để làm bài"}
            </span>
          )}
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-800">{quiz.title}</h1>
        <p className="text-gray-500 mt-2">
          ID: #{quiz.id.slice(0, 8)}...{" "}
          {quiz.documents
            ? `Dựa trên tài liệu "${quiz.documents.title}"`
            : "Đề thi độc lập"}{" "}
          • Gồm {questions?.length || 0} câu hỏi
        </p>
      </div>

      {(!questions || questions.length === 0) && (
        <div className="text-center p-12 bg-white rounded-2xl border border-gray-100 text-gray-500 font-medium mb-6">
          Chưa có câu hỏi nào được tích hợp trong bộ đề. Bạn có thể tự thêm
          thủ công bằng nút bên dưới.
        </div>
      )}

      {questions && (
        <QuestionList
          initialQuestions={questions}
          quizId={id}
          canEdit={canManage}
        />
      )}
    </div>
  );
}
