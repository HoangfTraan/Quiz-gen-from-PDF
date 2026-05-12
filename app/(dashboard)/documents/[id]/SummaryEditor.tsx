"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Edit2, Check, X } from "lucide-react";
import Link from "next/link";

export default function SummaryEditor({ 
  documentId, 
  initialSummary,
  status
}: { 
  documentId: string, 
  initialSummary: string | null,
  status: string
}) {
  const [summary, setSummary] = useState(initialSummary || "");
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(initialSummary || "");
  const supabase = createClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto resize textarea khi đang gõ
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [tempValue, isEditing]);

  const handleSave = async () => {
    const val = tempValue.trim();
    setSummary(val);
    setIsEditing(false);
    await supabase.from('document_contents').update({ summary: val }).eq('document_id', documentId);
  };

  const handleCancel = () => {
    // Hoàn tác lại giá trị cũ
    setTempValue(summary);
    setIsEditing(false);
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative transition-all duration-300">
      <div className="flex justify-between items-center mb-4 border-b pb-4">
        <h2 className="text-xl font-bold text-gray-800">Tóm tắt nội dung (AI Generated)</h2>
        {/* Chỉ hiện nút sửa nếu AI đã từng tạo tóm tắt, nếu trống thì để khối Loading lo */}
        {summary && (
          <div className="flex gap-2 animate-fade-in-blur">
            {isEditing ? (
              <>
                <button 
                  onClick={handleCancel}
                  className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium transition-colors bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg"
                >
                  <X size={16} /> Hủy
                </button>
                <button 
                  onClick={handleSave}
                  className="text-green-600 hover:text-green-800 flex items-center gap-1 text-sm font-medium transition-colors bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg shadow-sm"
                >
                  <Check size={16} /> Lưu lại
                </button>
              </>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium transition-colors bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg shadow-sm"
              >
                <Edit2 size={16} /> Chỉnh sửa
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        {isEditing ? (
          <div className="animate-fade-in-blur">
             <textarea
               ref={textareaRef}
               value={tempValue}
               onChange={(e) => setTempValue(e.target.value)}
               className="w-full text-gray-700 leading-relaxed text-lg border border-blue-200 rounded-xl p-4 focus:outline-none focus:ring-4 focus:ring-blue-500/20 bg-blue-50/30 resize-none overflow-hidden min-h-[150px] transition-shadow shadow-inner"
               placeholder="Nhập nội dung tóm tắt..."
               autoFocus
             />
             <p className="text-xs text-blue-500 mt-2 text-right">Bạn có thể sửa đổi bản tóm tắt hoặc viết thêm tùy ý.</p>
          </div>
        ) : summary ? (
          <p className="text-gray-600 leading-relaxed text-lg whitespace-pre-line animate-fade-in-blur">{summary}</p>
        ) : (
          <div className="flex flex-col items-center py-8 text-gray-400">
            <p>Tài liệu chưa phân tích nội dung tóm tắt.</p>
          </div>
        )}
      </div>
    </div>
  );
}
