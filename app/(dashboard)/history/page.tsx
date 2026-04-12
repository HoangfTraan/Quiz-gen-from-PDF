import Link from "next/link";
import { History as HistoryIcon, Clock, Award } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let history: any[] = [];
  if (user) {
    const { data } = await supabase
      .from("quiz_attempts")
      .select("*, quizzes(title)")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false });
    
    if (data) history = data;
  }

  return (
    <div className="animate-slide-in-left">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-3">
          <HistoryIcon className="text-blue-600" /> Lịch sử làm bài
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="min-w-full divide-y divide-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bộ đề</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thời gian</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Điểm số</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 font-medium">
                    Bạn chưa thực hiện bài thi nào. <Link href="/quizzes" className="text-blue-600 hover:underline">Vào Danh sách Quiz làm ngay!</Link>
                  </td>
                </tr>
              ) : history.map((record) => {
                const ratio = record.total_questions > 0 ? (record.total_correct / record.total_questions) : 0;
                return (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="font-bold text-gray-800">{record.quizzes?.title || 'Bộ đề không xác định'}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                      <Clock size={14} className="text-gray-400" /> {new Date(record.started_at || record.submitted_at || Date.now()).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs font-bold rounded-full border items-center gap-1.5 ${
                        ratio >= 0.8 ? 'bg-green-50 border-green-200 text-green-700' :
                        ratio >= 0.5 ? 'bg-orange-50 border-orange-200 text-orange-700' :
                        'bg-red-50 border-red-200 text-red-700'
                      }`}>
                        <Award size={14} /> {record.total_correct}/{record.total_questions}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <Link href={`/attempts/${record.id}/result`} className="text-blue-600 hover:text-blue-800 font-semibold underline decoration-blue-300 underline-offset-2">Xem chi tiết</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
