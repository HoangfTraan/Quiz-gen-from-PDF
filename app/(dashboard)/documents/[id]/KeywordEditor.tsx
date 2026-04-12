"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { X, Plus, Edit2, Check } from "lucide-react";

export default function KeywordEditor({ 
  documentId, 
  initialKeywords = [] 
}: { 
  documentId: string, 
  initialKeywords: string[] | null
}) {
  const [keywords, setKeywords] = useState<string[]>(initialKeywords || []);
  const [isEditing, setIsEditing] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const supabase = createClient();

  // Đồng bộ lên database ngầm phía dưới
  const syncToDb = async (updated: string[]) => {
    await supabase.from('document_contents').update({ keywords: updated }).eq('document_id', documentId);
  };

  const handleRemove = (kwToRemove: string) => {
    const updated = keywords.filter(k => k !== kwToRemove);
    setKeywords(updated);
    syncToDb(updated);
  };

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = newKeyword.trim().replace(/^#/, ''); // Bỏ dấu # nếu người dùng lỡ nhập
    if (!val || keywords.includes(val)) return;
    const updated = [...keywords, val];
    setKeywords(updated);
    setNewKeyword("");
    syncToDb(updated);
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative transition-all duration-300">
      <div className="flex justify-between items-center mb-4 border-b pb-4">
        <h2 className="text-xl font-bold text-gray-800">Từ khóa quan trọng</h2>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium transition-colors bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg shadow-sm"
        >
          {isEditing ? <><Check size={16} /> Hoàn tất</> : <><Edit2 size={16} /> Chỉnh sửa</>}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 transition-all duration-300 min-h-[30px]">
        {keywords.length > 0 ? (
          keywords.map((kw: string, i: number) => (
            <span key={i} className="flex items-center gap-1.5 bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-lg font-medium transition-transform animate-pop-in shadow-sm">
              <span className="opacity-80">#</span>{kw}
              {isEditing && (
                <button 
                  onClick={() => handleRemove(kw)} 
                  className="hover:bg-orange-200/80 rounded-full p-0.5 ml-1 transition-colors group"
                  aria-label="Xóa từ khóa"
                >
                  <X size={14} className="text-orange-500 group-hover:text-red-500" />
                </button>
              )}
            </span>
          ))
        ) : (
          !isEditing && <p className="text-gray-400 italic">Chưa có từ khóa nào được rút trích.</p>
        )}
      </div>

      {isEditing && (
        <form onSubmit={handleAdd} className="mt-5 flex gap-2 animate-fade-in-blur">
          <input 
            type="text" 
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Gõ từ khóa mới và Enter..." 
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm shadow-inner bg-gray-50/50"
            autoFocus
          />
          <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg transition-transform hover:scale-105 flex items-center justify-center shadow-lg shadow-orange-500/30 font-bold gap-1">
            <Plus size={18} /> Thêm
          </button>
        </form>
      )}
    </div>
  );
}
