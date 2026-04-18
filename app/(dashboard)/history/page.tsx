import Link from "next/link";
import { History as HistoryIcon, Clock, Award } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import Pagination from "./Pagination";

export default async function HistoryPage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 10;
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let history: any[] = [];
  let totalItems = 0;
  
  if (user) {
    // 1. Get total count
    const { count } = await supabase
      .from("quiz_attempts")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", user.id);
    
    totalItems = count || 0;

    // 2. Get paginated data
    const { data } = await supabase
      .from("quiz_attempts")
      .select("*, quizzes(title)")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    
    if (data) history = data;
  }

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="animate-page-fade">
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
                <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Bộ đề</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Thời gian</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Điểm số</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody key={page} className="bg-white divide-y divide-gray-200 animate-page-fade">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 font-medium">
                    Bạn chưa thực hiện bài thi nào. <Link href="/quizzes" className="text-blue-600 hover:outline-none hover:underline font-bold">Vào Danh sách Quiz làm ngay!</Link>
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
                      <span className={`px-3 py-1 inline-flex text-xs font-black rounded-full border items-center gap-1.5 ${
                        ratio >= 0.8 ? 'bg-green-50 border-green-200 text-green-700' :
                        ratio >= 0.5 ? 'bg-orange-50 border-orange-200 text-orange-700' :
                        'bg-red-50 border-red-200 text-red-700'
                      }`}>
                        <Award size={14} /> {record.total_correct}/{record.total_questions}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <Link href={`/attempts/${record.id}/result`} className="text-blue-600 hover:text-blue-800 font-bold underline decoration-blue-200 underline-offset-4 decoration-2 transition-all">Xem chi tiết</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <Pagination 
          currentPage={page} 
          totalPages={totalPages} 
          totalItems={totalItems} 
          pageSize={pageSize} 
        />
      </div>
    </div>
  );
}
