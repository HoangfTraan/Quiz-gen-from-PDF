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
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ targetCount?: string; capped?: string; originalCount?: string }>;
}) {
  const { id } = await params;
  const { targetCount, capped, originalCount } = await searchParams;
  const supabase = await createClient();

  // Lấy user hiện tại và role
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await getUserRole(user.id);

  const isAuthor = canAuthorQuiz(role);
  const isLearner = canTakePublishedQuiz(role);

  // Bỏ qua kiểm tra role ban đầu vì người dùng mặc định cũng có thể xem bộ đề CỦA MÌNH
  // Quyền truy cập sẽ được kiểm tra ở bước check quyền sở hữu (quiz.user_id !== user.id) bên dưới

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
         question_type,
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
          {isAuthor && <QuizActions quizId={id} initialStatus={quiz.status} questionCount={questionCount} />}
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

      {capped === 'true' && originalCount && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100/50 flex items-center justify-center flex-shrink-0 text-amber-600 font-bold">
            ⚠️
          </div>
          <div>
            <h4 className="font-bold text-amber-900 text-sm">Đã điều chỉnh số lượng câu hỏi</h4>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              Bạn yêu cầu tạo <strong className="text-amber-900">{originalCount} câu hỏi</strong> nhưng hệ thống đã <strong className="text-amber-900">tự động giảm xuống {questionCount} câu</strong> phù hợp với lượng nội dung có trong tài liệu.
              Điều này đảm bảo <strong>100% câu hỏi đều dựa trên thông tin gốc</strong> và không có câu hỏi bịa ra ngoài tài liệu.
            </p>
          </div>
        </div>
      )}

      {!capped && targetCount && questionCount < parseInt(targetCount, 10) && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100/50 flex items-center justify-center flex-shrink-0 text-blue-600 font-bold">
            💡
          </div>
          <div>
            <h4 className="font-bold text-blue-900 text-sm">Đã tối ưu hóa số lượng câu hỏi</h4>
            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
              Hệ thống đã tạo được <strong className="text-blue-900">{questionCount}</strong> trên tổng số <strong className="text-blue-900">{targetCount}</strong> câu hỏi yêu cầu. 
              Để đảm bảo tính chính xác 100%, hệ thống cam kết <strong>chỉ sử dụng thông tin gốc</strong> và dừng lại khi đã khai thác hết nội dung trong tài liệu mà không tự bịa câu hỏi ảo ngoài lề.
            </p>
          </div>
        </div>
      )}

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
