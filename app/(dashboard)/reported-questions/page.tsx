import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/utils/rbac-server";
import { redirect } from "next/navigation";
import PendingReviewTable from "./PendingReviewTable";

export default async function ReportedQuestionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = await getUserRole(user.id);
  if (role !== "teacher" && role !== "admin") {
    redirect("/dashboard?error=teacher_only");
  }

  // Lấy các câu hỏi có moderation_status = 'pending_review' hoặc 'error' thuộc về quiz do user hiện tại tạo
  // Dùng in('moderation_status', ['pending_review', 'error'])
  const { data: questions } = await supabase
    .from("questions")
    .select(`
      id,
      question_text,
      explanation,
      moderation_status,
      created_at,
      question_type,
      difficulty,
      image_url,
      question_options (
        id,
        option_label,
        option_text,
        is_correct
      ),
      quizzes!inner (
        id,
        title,
        user_id
      )
    `)
    .eq("quizzes.user_id", user.id)
    .in("moderation_status", ["pending_review", "error", "teacher_reported"])
    .order("created_at", { ascending: false });

  const pendingQuestions = questions?.filter(q => q.moderation_status === 'pending_review') || [];
  const errorQuestions = questions?.filter(q => q.moderation_status === 'error' || q.moderation_status === 'teacher_reported') || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Câu hỏi báo lỗi</h1>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
          Chờ duyệt ({pendingQuestions.length})
        </h2>
        <PendingReviewTable questions={pendingQuestions as any} />
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-2 h-6 bg-red-500 rounded-full"></span>
          Đã xác nhận lỗi ({errorQuestions.length})
        </h2>
        <PendingReviewTable questions={errorQuestions as any} />
      </div>
    </div>
  );
}
