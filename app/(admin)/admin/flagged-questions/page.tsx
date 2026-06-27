import { createClient } from "@/utils/supabase/server";
import { AlertTriangle, CheckCircle, Percent } from "lucide-react";
import AdminStatsChart from "./AdminStatsChart";

export default async function AdminFlaggedQuestionsPage() {
  const supabase = await createClient();

  const { data: errorQuestions, count: errorCount } = await supabase
    .from("questions")
    .select("id", { count: "exact" })
    .in("moderation_status", ["error", "flagged", "teacher_reported"]);

  const { data: totalQuestionsData, count: totalCount } = await supabase
    .from("questions")
    .select("id", { count: "exact" });

  const goodCount = (totalCount || 0) - (errorCount || 0);
  const totalQuestions = totalCount || 0;
  const errorRate = totalQuestions > 0 ? (((errorCount || 0) / totalQuestions) * 100).toFixed(2) : "0.00";

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Thống kê Chất lượng AI</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-14 h-14 bg-red-50 text-red-600 flex justify-center items-center rounded-xl shrink-0">
            <AlertTriangle size={28} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Số câu hỏi lỗi</p>
            <p className="text-3xl font-black text-gray-900">{errorCount || 0}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-14 h-14 bg-green-50 text-green-600 flex justify-center items-center rounded-xl shrink-0">
            <CheckCircle size={28} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Số câu hỏi tốt</p>
            <p className="text-3xl font-black text-gray-900">{goodCount || 0}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 flex justify-center items-center rounded-xl shrink-0">
            <Percent size={28} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Tỷ lệ lỗi (Tần suất)</p>
            <p className="text-3xl font-black text-gray-900">{errorRate}%</p>
          </div>
        </div>
      </div>

      <AdminStatsChart goodCount={goodCount} errorCount={errorCount || 0} />
    </div>
  );
}
