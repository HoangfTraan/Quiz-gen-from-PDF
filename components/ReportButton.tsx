"use client";

import { useState } from "react";
import { Flag, Loader2, CheckCircle } from "lucide-react";
import { reportQuestionAction } from "@/app/actions/report";
import ConfirmModal from "@/components/ConfirmModal";

export default function ReportButton({ questionId, onReported }: { questionId: string, onReported?: () => void }) {
  const [isReporting, setIsReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const executeReport = async () => {
    setIsReporting(true);
    try {
      await reportQuestionAction(questionId);
      setReported(true);
      if (onReported) onReported();
    } catch (error: any) {
      alert("Đã xảy ra lỗi khi báo cáo: " + error.message);
    } finally {
      setIsReporting(false);
    }
  };

  if (reported) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 animate-fade-in">
        <CheckCircle size={14} className="text-amber-600" /> Đã báo cáo lỗi
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={isReporting}
        className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-amber-200 transition-all disabled:opacity-50"
        title="Báo lỗi nội dung câu hỏi này"
      >
        {isReporting ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
        Báo lỗi
      </button>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={executeReport}
        title="Báo lỗi câu hỏi"
        message="Bạn có chắc chắn câu hỏi này bị lỗi nội dung và muốn báo cáo không? AI sẽ ghi nhận và học hỏi từ lỗi này để cải thiện trong tương lai."
        confirmText="Xác nhận báo lỗi"
        cancelText="Hủy"
        isDestructive={true}
      />
    </>
  );
}
