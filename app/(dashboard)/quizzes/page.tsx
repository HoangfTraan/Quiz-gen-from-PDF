import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getUserRole } from "@/utils/rbac-server";
import { canAuthorQuiz, canTakePublishedQuiz } from "@/utils/rbac";
import { redirect } from "next/navigation";
import { ShieldOff } from "lucide-react";
import Link from "next/link";
import QuizListClient from "./QuizListClient";

export default async function QuizzesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = await getUserRole(user.id);

  // Chỉ teacher và learner được truy cập trang này
  if (!canAuthorQuiz(role) && !canTakePublishedQuiz(role)) {
    return (
      <div className="max-w-lg mx-auto mt-20 p-10 bg-white rounded-2xl border border-amber-100 shadow text-center">
        <ShieldOff size={48} className="text-amber-400 mx-auto mb-4" />
        <h2 className="text-xl font-extrabold text-gray-800 mb-2">Không có quyền truy cập</h2>
        <p className="text-gray-500 mb-6">
          Chức năng Bộ câu hỏi chỉ dành cho tài khoản có vai trò <strong>Giáo viên</strong> hoặc <strong>Người học</strong>.<br />
          Liên hệ admin để được cấp quyền.
        </p>
        <Link
          href="/dashboard"
          className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
        >
          Về trang chủ
        </Link>
      </div>
    );
  }

  // Lấy danh sách teacher IDs (dùng admin client để bypass RLS)
  let teacherIds: string[] = [];
  if (canTakePublishedQuiz(role)) {
    const adminDb = createAdminClient();
    const { data: teacherRoles } = await adminDb
      .from("user_roles")
      .select("user_id, roles!inner(name)")
      .eq("roles.name", "teacher");
    teacherIds = teacherRoles?.map((r: any) => r.user_id) || [];
  }

  return <QuizListClient role={role} userId={user.id} teacherIds={teacherIds} />;
}
