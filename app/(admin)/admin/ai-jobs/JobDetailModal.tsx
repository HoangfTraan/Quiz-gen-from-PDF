"use client";

import { X, Copy, CheckCircle2, Terminal, Database, AlertCircle } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

export default function JobDetailModal({ job, onClose }: { job: any; onClose: () => void }) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const renderJson = (data: any) => {
    if (!data) return <span className="text-gray-400 italic">Trống</span>;
    return (
      <pre className="text-xs font-mono text-gray-700 bg-gray-50 p-4 rounded-xl overflow-auto max-h-[300px] border border-gray-100 leading-relaxed shadow-inner">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 transition-opacity animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Modal Content */}
      <div className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col shrink-0 animate-in zoom-in-95 duration-300 border border-white/20">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
              <Terminal size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 leading-none">Chi tiết xử lý AI</h2>
              <p className="text-xs text-gray-500 mt-2 font-mono uppercase tracking-widest">Job ID: {job.id}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          
          {/* Error Message if failed */}
          {job.status === 'failed' && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-5 flex items-start gap-4">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                <AlertCircle size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-red-900 uppercase tracking-tight mb-1">Thông tin lỗi (Error)</h4>
                <p className="text-sm text-red-700/80 leading-relaxed font-medium">{job.error_message || "Đã xảy ra lỗi không xác định trong quá trình xử lý."}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Payload */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 text-xs font-black text-indigo-500 uppercase tracking-widest">
                  <Database size={14} /> Dữ liệu đầu vào (Input)
                </label>
                <button 
                  onClick={() => handleCopy(JSON.stringify(job.input_payload, null, 2), 'input')}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-indigo-600 transition-colors"
                >
                  {copiedSection === 'input' ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  {copiedSection === 'input' ? 'Đã chép' : 'Sao chép'}
                </button>
              </div>
              {renderJson(job.input_payload)}
              <p className="text-[10px] text-gray-400 font-medium italic border-l-2 border-gray-100 pl-3">Dữ liệu thô gửi đến mô hình AI để xử lý tác vụ.</p>
            </div>

            {/* Output Payload */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 text-xs font-black text-emerald-500 uppercase tracking-widest">
                  <CheckCircle2 size={14} /> Kết quả trả về (Output)
                </label>
                <button 
                  onClick={() => handleCopy(JSON.stringify(job.output_payload, null, 2), 'output')}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-emerald-600 transition-colors"
                >
                  {copiedSection === 'output' ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  {copiedSection === 'output' ? 'Đã chép' : 'Sao chép'}
                </button>
              </div>
              {renderJson(job.output_payload)}
              <p className="text-[10px] text-gray-400 font-medium italic border-l-2 border-gray-100 pl-3">Phản hồi thô nhận được từ AI trước khi lưu vào DB.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-black text-sm shadow-xl shadow-gray-200 hover:bg-black transition-all active:scale-95"
          >
            ĐÓNG CỬA SỔ
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
