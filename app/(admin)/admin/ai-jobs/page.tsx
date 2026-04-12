import { Activity } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function AdminAiJobsPage() {
  const supabase = await createClient();
  let jobs: any[] = [];
  
  const { data } = await supabase.from('ai_jobs').select('*, documents(title)').order('started_at', { ascending: false });
  if (data) jobs = data;

  return (
    <div className="animate-slide-in-left">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <Activity className="text-blue-600" /> Hệ thống AI / Logs tiến trình
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Job ID</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Loại tác vụ</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Thời gian</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Token đã dùng</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
             {jobs.length === 0 ? (
               <tr>
                 <td colSpan={5} className="px-6 py-10 text-center text-gray-500">Chưa có tiến trình AI nào được chạy</td>
               </tr>
             ) : jobs.map(j => (
               <tr key={j.id}>
                 <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">#{j.id.slice(0,8)}</td>
                 <td className="px-6 py-4 whitespace-nowrap text-gray-800 font-semibold">{j.job_type} ({j.documents?.title || 'Unknown'})</td>
                 <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full font-bold ${
                      j.status === 'completed' ? 'bg-green-100 text-green-700' : 
                      j.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700 animate-pulse'
                    }`}>
                      {String(j.status).toUpperCase()}
                    </span>
                 </td>
                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(j.started_at).toLocaleString('vi-VN')}</td>
                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">-</td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
