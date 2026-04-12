"use client";

import { Trash2, CheckCircle, Save, Loader2 } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function QuizActions({ quizId, initialStatus }: { quizId: string, initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handlePublish = async () => {
    if (status === 'published') return;
    setIsPublishing(true);
    try {
      await supabase.from('quizzes').update({ status: 'published' }).eq('id', quizId);
      setStatus('published');
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Không thể lưu bộ đề!');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ bộ đề này? Thao tác này không thể hoàn tác.')) return;
    setIsDeleting(true);
    try {
      // Bảng questions và options sẽ tự động xóa nếu thiết lập CASCADE
      await supabase.from('quizzes').delete().eq('id', quizId);
      router.push('/quizzes');
    } catch (err) {
      console.error(err);
      alert('Không thể xóa bộ đề!');
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button 
        onClick={handleDelete}
        disabled={isDeleting}
        className="px-4 py-2 text-sm font-medium border border-red-300 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 flex items-center gap-2 transition-colors disabled:opacity-50"
      >
        {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Xóa bộ đề
      </button>
      
      <button 
        onClick={handlePublish}
        disabled={status === 'published' || isPublishing}
        className={`${status === 'published' ? 'bg-green-100 text-green-800 cursor-default' : 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'} px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50`}
      >
        {status === 'published' ? (
          <><CheckCircle size={16} /> Đã lưu</>
        ) : (
          <>{isPublishing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu</>
        )}
      </button>
    </>
  );
}
