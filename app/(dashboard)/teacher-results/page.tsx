import Link from "next/link";
import { BarChart, Clock, Award, ShieldAlert, Eye } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/utils/rbac-server";
import Pagination from "../history/Pagination";

export default async function TeacherResultsPage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 10;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Kiểm tra quyền (chỉ teacher hoặc admin mới được xem)
  const role = user ? await getUserRole(user.id) : "user";
  const hasAccess = role === "teacher" || role === "admin";

  if (!hasAccess) {
    return (
      <div className="animate-page-fade">
        <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-3 mb-8">
          <BarChart className="text-purple-600" /> Kết quả thi của Học viên
        </h1>
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-red-200 text-center px-6 shadow-sm">
          <ShieldAlert size={52} className="text-red-400 mb-4" />
          <h2 className="text-xl font-extrabold text-gray-800 mb-2">
            Tính năng dành riêng cho Giáo viên
          </h2>
          <p className="text-gray-500 max-w-md">
            Chỉ tài khoản được cấp quyền <strong>Giáo viên</strong> mới có thể
            xem thống kê điểm thi của các bộ đề đã xuất bản.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 px-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  let history: any[] = [];
  let totalItems = 0;

  if (user) {
    // Đếm tổng số lượt làm bài của các bộ đề thuộc về giáo viên này
    const { count } = await supabase
      .from("quiz_attempts")
      .select("*, quizzes!inner(user_id)", { count: "exact", head: true })
      .eq("quizzes.user_id", user.id);
      
    totalItems = count || 0;

    // Lấy dữ liệu chi tiết
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select(`
        *,
        quizzes!inner(title, user_id),
        users(full_name, email)
      `)
      .eq("quizzes.user_id", user.id)
      .order("started_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      console.error("Lỗi khi tải kết quả:", error);
    }
    
    if (data) history = data;
  }

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="animate-page-fade">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-3">
            <BarChart className="text-purple-600" /> Kết quả thi của Học viên
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            Danh sách điểm số các lượt làm bài từ bộ đề mà bạn đã xuất bản.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden transition-all hover:shadow-2xl">
        <div className="min-w-full divide-y divide-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest w-1/4">
                  Học viên
                </th>
                <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest w-1/3">
                  Bộ đề
                </th>
                <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">
                  Thời gian làm bài
                </th>
                <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest">
                  Điểm số
                </th>
                <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest">
                  Chi tiết
                </th>
              </tr>
            </thead>
            <tbody
              key={page}
              className="bg-white divide-y divide-gray-100 animate-page-fade"
            >
              {history.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-16 text-center text-gray-500 font-medium"
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                        <BarChart size={32} />
                      </div>
                      <p>Chưa có học viên nào làm bài bộ đề của bạn.</p>
                      <Link
                        href="/quizzes"
                        className="text-purple-600 hover:text-purple-700 hover:underline font-bold transition-all"
                      >
                        Quản lý Bộ câu hỏi
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                history.map((record) => {
                  const ratio =
                    record.total_questions > 0
                      ? record.total_correct / record.total_questions
                      : 0;
                      
                  const learnerName = record.users?.full_name || record.users?.email || "Học viên ẩn danh";
                  
                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-purple-50/30 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 font-black flex items-center justify-center shrink-0 border border-purple-200">
                            {learnerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 line-clamp-1">{learnerName}</p>
                            {record.users?.email && record.users?.full_name && (
                                <p className="text-xs text-gray-500 line-clamp-1">{record.users.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-800 line-clamp-2">
                          {record.quizzes?.title || "Bộ đề không xác định"}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Clock size={14} className="text-gray-400" />
                          {new Date(
                            record.submitted_at || record.started_at || Date.now()
                          ).toLocaleString("vi-VN", {
                            hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`px-3 py-1.5 inline-flex text-sm font-black rounded-xl border items-center justify-center gap-1.5 shadow-sm ${
                            ratio >= 0.8
                              ? "bg-green-50 border-green-200 text-green-700"
                              : ratio >= 0.5
                              ? "bg-orange-50 border-orange-200 text-orange-700"
                              : "bg-red-50 border-red-200 text-red-700"
                          }`}
                        >
                          <Award size={16} />
                          {record.total_correct}/{record.total_questions}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <Link
                          href={`/attempts/${record.id}/result`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 hover:text-purple-800 transition-all shadow-sm"
                        >
                          <Eye size={14} /> Xem
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalItems > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
            />
          </div>
        )}
      </div>
    </div>
  );
}
