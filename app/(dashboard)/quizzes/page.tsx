import Link from "next/link";
import { BookOpen, PlusCircle, Play, Eye, Edit3 } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/utils/rbac-server";
import { canManageQuiz, canTakeQuiz } from "@/utils/rbac";
import Pagination from "./Pagination";

export default async function QuizzesPage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 9;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Xác định role để điều chỉnh giao diện
  const role = user ? await getUserRole(user.id) : "user";
  const canManage = canManageQuiz(role);  // teacher / admin
  const canTake   = canTakeQuiz(role);    // learner

  let quizzes: any[] = [];
  let totalItems = 0;

  if (user) {
    const { count } = await supabase
      .from("quizzes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    totalItems = count || 0;

    const { data } = await supabase
      .from("quizzes")
      .select("*, questions(count)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (data) quizzes = data;
  }

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-extrabold text-gray-800">
          Danh sách Bộ Câu hỏi
        </h1>
        <Link
          href="/quizzes/create"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
        >
          <PlusCircle size={18} />
          Tạo Quiz tự do
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quizzes.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 font-medium pb-20">
            Bạn chưa tạo Bộ câu hỏi nào.{" "}
            <Link href="/quizzes/create" className="text-blue-600 hover:underline">
              Tạo ngay
            </Link>
          </div>
        ) : (
          quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col"
            >
              {/* Header: icon + badge trạng thái (chỉ teacher/admin/user thấy) */}
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <BookOpen size={20} />
                </div>

                {/* Badge Bản nháp / Đã lưu: chỉ hiện với teacher/admin (canManage) */}
                {canManage && (
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      quiz.status === "published"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {quiz.status === "published" ? "Đã lưu" : "Bản nháp"}
                  </span>
                )}
              </div>

              <h3 className="font-bold text-lg text-gray-800 mb-1 line-clamp-2 min-h-[56px]">
                {quiz.title}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {quiz.total_questions || quiz.questions?.[0]?.count || 0} câu hỏi
              </p>

              {/* Footer actions — theo role */}
              <div className="flex gap-2 mt-auto pt-4 border-t border-gray-100">

                {/* Learner: chỉ hiện "Làm bài ngay" */}
                {canTake && (
                  <Link
                    href={`/quizzes/${quiz.id}/start`}
                    className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Play size={15} /> Làm bài ngay
                  </Link>
                )}

                {/* Teacher / Admin: "Chỉnh sửa" (draft) hoặc "Xem" (published) — không làm bài */}
                {canManage && (
                  <Link
                    href={`/quizzes/${quiz.id}`}
                    className="flex-1 text-center bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    {quiz.status === "published" ? (
                      <><Eye size={15} /> Xem</>
                    ) : (
                      <><Edit3 size={15} /> Chỉnh sửa</>
                    )}
                  </Link>
                )}

                {/* User mặc định: chỉ "Xem" — không sửa, không làm bài */}
                {!canTake && !canManage && (
                  <Link
                    href={`/quizzes/${quiz.id}`}
                    className="flex-1 text-center bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Eye size={15} /> Xem
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
      />
    </div>
  );
}
