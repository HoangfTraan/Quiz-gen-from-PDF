"use client";

import { Trash2, CheckCircle, Save, Loader2 } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";

export default function QuizActions({ quizId, initialStatus }: { quizId: string, initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
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

  const executeDelete = async () => {
    setIsDeleting(true);
    try {
      // Bảng questions và options sẽ tự động xóa nếu thiết lập CASCADE
      const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
      if (error) throw error;
      
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
        onClick={() => setShowDeleteModal(true)}
        disabled={isDeleting}
        className="px-4 py-2 text-sm font-medium border border-red-200 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 flex items-center gap-2 transition-colors disabled:opacity-50"
      >
        {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Xóa bộ đề
      </button>
      
      <button 
        onClick={handlePublish}
        disabled={status === 'published' || isPublishing}
        className={`${status === 'published' ? 'bg-green-100 text-green-800 cursor-default shadow-none border border-green-200' : 'bg-green-600 hover:bg-green-700 text-white cursor-pointer shadow-lg shadow-green-200'} px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50`}
      >
        {status === 'published' ? (
          <><CheckCircle size={16} /> Đã lưu</>
        ) : (
          <>{isPublishing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu</>
        )}
      </button>

      <ConfirmModal 
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={executeDelete}
        title="Xóa bộ đề trắc nghiệm?"
        message="Bạn có chắc chắn muốn xóa toàn bộ bộ đề này? Tất cả câu hỏi và dữ liệu liên quan sẽ bị mất vĩnh viễn. Thao tác này không thể hoàn tác."
        confirmText="Vẫn xóa"
        cancelText="Để mình xem lại"
        isDestructive={true}
      />
    </>
  );
}
