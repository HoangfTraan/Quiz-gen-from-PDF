"use client";

import { Activity, Clock, Database, Eye, ExternalLink, FileText, Brain, Zap, ShieldCheck } from "lucide-react";
import { useState } from "react";
import JobDetailModal from "./JobDetailModal";
import Link from "next/link";

const JOB_TYPE_MAP: Record<string, { label: string; icon: any; color: string }> = {
  extract_text: { label: "Trích xuất văn bản", icon: FileText, color: "text-blue-500" },
  summarize: { label: "Tóm tắt & Phân tích", icon: Brain, color: "text-purple-500" },
  generate_questions: { label: "Biên soạn câu hỏi", icon: Zap, color: "text-orange-500" },
  validate_questions: { label: "Kiểm soát chất lượng", icon: ShieldCheck, color: "text-emerald-500" },
  diagnosis: { label: "Chẩn đoán hệ thống", icon: Activity, color: "text-slate-500" },
};

export default function JobTable({ initialJobs }: { initialJobs: any[] }) {
  const [selectedJob, setSelectedJob] = useState<any>(null);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tác vụ</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tài liệu liên quan</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Thời gian</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
               {initialJobs.length === 0 ? (
                 <tr>
                   <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">
                     <Database className="mx-auto mb-2 opacity-20" size={40} />
                     Chưa có tiến trình AI nào được khởi chạy
                   </td>
                 </tr>
               ) : initialJobs.map(j => {
                 const typeInfo = JOB_TYPE_MAP[j.job_type] || { label: j.job_type, icon: Activity, color: "text-gray-400" };
                 const Icon = typeInfo.icon;
                 
                 return (
                   <tr key={j.id} className="hover:bg-gray-50/50 transition-colors group">
                     <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl bg-white border border-gray-100 shadow-sm transition-transform group-hover:scale-110 ${typeInfo.color}`}>
                            <Icon size={18} />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm leading-none">{typeInfo.label}</div>
                            <div className="text-[10px] text-gray-400 mt-1 font-mono uppercase tracking-tighter">ID: {j.id.slice(0,8)}</div>
                          </div>
                        </div>
                     </td>
                     <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                           {j.documents?.title ? (
                             <span className="font-semibold text-gray-700 text-sm truncate max-w-[200px]" title={j.documents.title}>
                               {j.documents.title}
                             </span>
                           ) : (
                             <span className="text-gray-400 italic text-sm">N/A</span>
                           )}
                           <span className="text-[10px] text-gray-400 uppercase font-black tracking-tight italic">
                             Tokens: {j.token_used || "N/A"}
                           </span>
                        </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2.5 py-1 text-[10px] rounded-lg font-black uppercase tracking-widest border ${
                            j.status === 'completed' ? 'bg-green-50 text-green-700 border-green-100' : 
                            j.status === 'failed' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100 animate-pulse'
                          }`}>
                            {j.status}
                          </span>
                          {j.status === 'failed' && j.error_message && (
                            <span className="text-[10px] text-red-400 font-medium max-w-[120px] truncate" title={j.error_message}>
                              Gặp sự cố xử lý
                            </span>
                          )}
                        </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="text-sm font-bold text-gray-700 flex items-center gap-1">
                            <Clock size={12} className="text-gray-400" />
                            {new Date(j.started_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-[10px] text-gray-400 font-medium tracking-tight">
                            {new Date(j.started_at).toLocaleDateString('vi-VN')}
                          </div>
                        </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center gap-2">
                           <button 
                             onClick={() => setSelectedJob(j)}
                             className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all active:scale-90"
                             title="Xem chi tiết dữ liệu"
                           >
                              <Eye size={18} />
                           </button>
                           
                           {j.status === 'completed' && j.quiz_id && (
                             <Link 
                               href={`/quizzes/${j.quiz_id}`}
                               className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-90"
                               title="Xem kết quả Quiz"
                             >
                                <ExternalLink size={18} />
                             </Link>
                           )}
                        </div>
                     </td>
                   </tr>
                 );
               })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedJob && (
        <JobDetailModal 
          job={selectedJob} 
          onClose={() => setSelectedJob(null)} 
        />
      )}
    </>
  );
}
