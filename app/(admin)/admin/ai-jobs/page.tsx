import { Activity, Eye, ExternalLink } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import JobTable from "./JobTable";

export default async function AdminAiJobsPage() {
  const supabase = await createClient();
  
  const { data: jobs } = await supabase
    .from('ai_jobs')
    .select('*, documents(title)')
    .order('started_at', { ascending: false });

  /*
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Activity className="text-blue-600" /> Hệ thống AI / Logs tiến trình
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Theo dõi hoạt động thô, chẩn đoán lỗi và kiểm soát dữ liệu của mô hình AI.</p>
        </div>
      </div>

      <JobTable initialJobs={jobs || []} />

      <div className="mt-8 bg-blue-50/50 p-6 rounded-3xl border border-blue-100/50">
        <h4 className="text-sm font-black text-blue-900 uppercase tracking-tight mb-2">💡 Mẹo quản trị</h4>
        <ul className="text-sm text-blue-800/70 space-y-2 list-disc pl-5 font-medium leading-relaxed">
          <li>Sử dụng nút <span className="inline-flex items-center bg-white px-2 py-0.5 rounded border border-gray-200"><Eye size={12} className="mr-1" /> Chi tiết</span> để xem nội dung AI đã thực sự gửi và nhận, giúp kiểm tra tính chính xác của Prompt.</li>
          <li>Đối với các tác vụ tạo câu hỏi hoàn tất, bấm vào biểu tượng <span className="inline-flex items-center bg-white px-2 py-0.5 rounded border border-gray-200"><ExternalLink size={12} className="mr-1" /> Kết quả</span> để xem bộ đề đã được tạo ra.</li>
        </ul>
      </div>
    </div>
  );
  */
  return <div className="p-10 text-center text-gray-400 font-medium">Phần này tạm thời được ẩn.</div>;
}
