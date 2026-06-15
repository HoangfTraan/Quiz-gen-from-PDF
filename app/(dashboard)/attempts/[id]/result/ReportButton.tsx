"use client";

import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { reportQuestionAction } from "@/app/actions/report";

export default function ReportButton({ questionId }: { questionId: string }) {
  const [isReporting, setIsReporting] = useState(false);
  const [reported, setReported] = useState(false);

  const handleReport = async () => {
    if (!confirm("Bạn có chắc chắn câu hỏi này bị lỗi nội dung và muốn báo cáo không?")) {
      return;
    }

    setIsReporting(true);
    try {
      await reportQuestionAction(questionId);
      setReported(true);
      alert("Cảm ơn bạn đã báo cáo. AI sẽ học từ lỗi này để cải thiện trong tương lai!");
    } catch (error: any) {
      alert("Đã xảy ra lỗi khi báo cáo: " + error.message);
    } finally {
      setIsReporting(false);
    }
  };

  if (reported) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
        <Flag size={14} className="fill-amber-600" /> Đã báo cáo lỗi
      </div>
    );
  }

  return (
    <button
      onClick={handleReport}
      disabled={isReporting}
      className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-amber-200 transition-all disabled:opacity-50"
      title="Báo lỗi nội dung câu hỏi này"
    >
      {isReporting ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
      Báo lỗi
    </button>
  );
}
