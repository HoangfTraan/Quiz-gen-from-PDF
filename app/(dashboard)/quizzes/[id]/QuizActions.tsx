"use client";

import { Trash2, CheckCircle, Save, Loader2, Send, FileEdit } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";

interface QuizActionsProps {
  quizId: string;
  initialStatus: string;
  questionCount: number;
}

export default function QuizActions({ quizId, initialStatus, questionCount }: QuizActionsProps) {
  const [status, setStatus] = useState(initialStatus);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const router = useRouter();

  const updateStatus = async (newStatus: "draft" | "published") => {
    const res = await fetch(`/api/quizzes/${quizId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Lỗi không xác định");
    }
    return res.json();
  };

  const handleSaveDraft = async () => {
    if (status === "draft") return;
    setIsSaving(true);
    try {
      await updateStatus("draft");
      setStatus("draft");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Không thể chuyển về bản nháp!");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (status === "published") return;
    setIsPublishing(true);
    try {
      await updateStatus("published");
      setStatus("published");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Không thể xuất bản bộ đề!");
    } finally {
      setIsPublishing(false);
    }
  };

  const executeDelete = async () => {
    setIsDeleting(true);
    try {
      // Import supabase client for delete (cascade sẽ tự xóa questions/options)
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
      if (error) throw error;
      
      router.push("/quizzes");
    } catch (err) {
      console.error(err);
      alert("Không thể xóa bộ đề!");
      setIsDeleting(false);
    }
  };

  const isDraft = status === "draft";
  const isPublished = status === "published";
  const hasQuestions = questionCount > 0;

  return (
    <>
      {/* Nút Xóa bộ đề */}
      <button 
        onClick={() => setShowDeleteModal(true)}
        disabled={isDeleting}
        className="px-4 py-2 text-sm font-medium border border-red-200 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 flex items-center gap-2 transition-colors disabled:opacity-50"
      >
        {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Xóa bộ đề
      </button>

      {/* Nút Lưu nháp — active khi đang published, cho phép unpublish */}
      <button 
        onClick={handleSaveDraft}
        disabled={isDraft || isSaving}
        className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 ${
          isDraft
            ? "bg-gray-100 text-gray-500 border border-gray-200 cursor-default"
            : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer"
        }`}
        title={isDraft ? "Bộ đề đang ở trạng thái bản nháp" : "Thu hồi bộ đề về bản nháp"}
      >
        {isSaving ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isDraft ? (
          <FileEdit size={16} />
        ) : (
          <Save size={16} />
        )}
        {isDraft ? "Bản nháp" : "Lưu nháp"}
      </button>

      {/* Nút Xuất bản — active khi đang draft, disabled nếu không có câu hỏi */}
      <button 
        onClick={handlePublish}
        disabled={isPublished || isPublishing || !hasQuestions}
        className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 ${
          isPublished
            ? "bg-green-100 text-green-800 border border-green-200 cursor-default shadow-none"
            : hasQuestions
              ? "bg-green-600 hover:bg-green-700 text-white cursor-pointer shadow-lg shadow-green-200"
              : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
        }`}
        title={
          isPublished
            ? "Bộ đề đã được xuất bản"
            : !hasQuestions
              ? "Không thể xuất bản bộ đề chưa có câu hỏi"
              : "Xuất bản bộ đề cho người học"
        }
      >
        {isPublished ? (
          <><CheckCircle size={16} /> Đã xuất bản</>
        ) : (
          <>{isPublishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Xuất bản</>
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
