import Link from "next/link";
import { ArrowLeft, ShieldOff } from "lucide-react";
import QuestionList from "./QuestionList";
import QuizActions from "./QuizActions";
import QuizTitleEditor from "./QuizTitleEditor";
import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getUserRole } from "@/utils/rbac-server";
import { canAuthorQuiz, canTakePublishedQuiz } from "@/utils/rbac";

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
  if (!user) redirect("/login");

  const role = await getUserRole(user.id);

  const isAuthor = canAuthorQuiz(role);
  const isLearner = canTakePublishedQuiz(role);

  // Chỉ teacher và learner được truy cập
  if (!isAuthor && !isLearner) {
    return (
      <div className="max-w-lg mx-auto mt-20 p-10 bg-white rounded-2xl border border-amber-100 shadow text-center">
        <ShieldOff size={48} className="text-amber-400 mx-auto mb-4" />
        <h2 className="text-xl font-extrabold text-gray-800 mb-2">Không có quyền truy cập</h2>
        <p className="text-gray-500 mb-6">
          Chức năng này chỉ dành cho tài khoản <strong>Giáo viên</strong> hoặc <strong>Người học</strong>.
        </p>
        <Link href="/dashboard" className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
          Về trang chủ
        </Link>
      </div>
    );
  }

  // Người học redirect thẳng vào trang làm bài thi
  if (isLearner) {
    redirect(`/quizzes/${id}/start`);
  }

  // Song song hóa việc lấy thông tin bộ đề và danh sách câu hỏi kèm đáp án
  const [quizResult, questionsResult] = await Promise.all([
    supabase
      .from("quizzes")
      .select("*, documents(title)")
      .eq("id", id)
      .single(),
    supabase
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
      .eq("quiz_id", id)
  ]);

  const quiz = quizResult.data;
  if (!quiz) return notFound();

  // Kiểm tra quyền sở hữu: chỉ teacher owner mới được xem chi tiết
  if (quiz.user_id !== user.id) {
    return (
      <div className="max-w-lg mx-auto mt-20 p-10 bg-white rounded-2xl border border-amber-100 shadow text-center">
        <ShieldOff size={48} className="text-amber-400 mx-auto mb-4" />
        <h2 className="text-xl font-extrabold text-gray-800 mb-2">Không có quyền truy cập</h2>
        <p className="text-gray-500 mb-6">
          Bạn không phải chủ sở hữu bộ đề này.
        </p>
        <Link href="/quizzes" className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
          Về danh sách bộ đề
        </Link>
      </div>
    );
  }

  const questions = questionsResult.data;
  const questionCount = questions?.length || 0;

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
          {/* Xóa / Lưu nháp / Xuất bản: chỉ teacher owner */}
          <QuizActions quizId={id} initialStatus={quiz.status} questionCount={questionCount} />
        </div>
      </div>

      <div className="mb-8">
        <QuizTitleEditor quizId={id} initialTitle={quiz.title} canEdit={isAuthor} />
        <p className="text-gray-500 mt-2">
          ID: #{quiz.id.slice(0, 8)}...{" "}
          {quiz.documents
            ? `Dựa trên tài liệu "${quiz.documents.title}"`
            : "Đề thi độc lập"}{" "}
          • Gồm {questionCount} câu hỏi
        </p>
      </div>

      {questionCount === 0 && (
        <div className="text-center p-12 bg-white rounded-2xl border border-gray-100 text-gray-500 font-medium mb-6">
          Chưa có câu hỏi nào được tích hợp trong bộ đề. Bạn có thể tự thêm
          thủ công bằng nút bên dưới.
        </div>
      )}

      {questions && (
        <QuestionList
          initialQuestions={questions}
          quizId={id}
          canEdit={isAuthor}
        />
      )}
    </div>
  );
}
