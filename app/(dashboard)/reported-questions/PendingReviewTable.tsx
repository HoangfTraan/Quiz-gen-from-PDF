"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, XCircle, AlertTriangle, Loader2, Flag, Eye, Undo2 } from "lucide-react";
import { approveReportAction, rejectReportAction, undoReportAction } from "./actions";
import Link from "next/link";

interface QuestionData {
  id: string;
  question_text: string;
  explanation: string | null;
  moderation_status: string | null;
  question_type?: string | null;
  difficulty?: string | null;
  image_url?: string | null;
  question_options?: {
    id: string;
    option_label: string;
    option_text: string;
    is_correct: boolean;
  }[];
  quizzes: {
    id: string;
    title: string;
  } | null;
}

export default function PendingReviewTable({ questions }: { questions: QuestionData[] }) {
  const [isPending, startTransition] = useTransition();
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleApprove = (id: string) => {
    startTransition(async () => {
      try {
        await approveReportAction(id);
      } catch (err: any) {
        alert("Lỗi: " + err.message);
      }
    });
  };

  const handleReject = (id: string) => {
    startTransition(async () => {
      try {
        await rejectReportAction(id);
      } catch (err: any) {
        alert("Lỗi: " + err.message);
      }
    });
  };

  const handleUndo = (id: string) => {
    startTransition(async () => {
      try {
        await undoReportAction(id);
      } catch (err: any) {
        alert("Lỗi: " + err.message);
      }
    });
  };

  if (questions.length === 0) {
    return (
      <div className="p-12 text-center bg-gray-50 text-gray-500 font-medium rounded-xl border border-gray-100">
        Hiện không có câu hỏi nào chờ duyệt.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nội dung câu hỏi</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Bộ đề</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái</th>
            <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {questions.map((q) => (
            <tr key={q.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4">
                <p className="text-sm font-bold text-gray-900 line-clamp-2">{q.question_text}</p>
                {q.explanation && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">Giải thích: {q.explanation}</p>
                )}
              </td>
              <td className="px-6 py-4 text-sm font-medium text-gray-700">
                {q.quizzes?.title || "Không rõ"}
              </td>
              <td className="px-6 py-4">
                {q.moderation_status === 'pending_review' ? (
                  <span className="inline-flex items-center gap-1 py-1 px-2.5 text-[10px] font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 uppercase whitespace-nowrap">
                    <AlertTriangle size={12} /> Chờ duyệt
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 py-1 px-2.5 text-[10px] font-bold rounded-lg bg-red-50 text-red-700 border border-red-200 uppercase whitespace-nowrap">
                    <Flag size={12} /> Đã lỗi
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-center">
                {q.moderation_status === 'pending_review' ? (
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => setSelectedQuestion(q)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Xem chi tiết câu hỏi"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => handleApprove(q.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Duyệt (Xác nhận lỗi)"
                    >
                      {isPending ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => handleReject(q.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Từ chối (Bỏ qua báo cáo)"
                    >
                      {isPending ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => setSelectedQuestion(q)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Xem chi tiết câu hỏi"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => handleUndo(q.id)}
                      className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Hoàn tác (Đưa về trạng thái chờ duyệt)"
                    >
                      {isPending ? <Loader2 size={18} className="animate-spin" /> : <Undo2 size={18} />}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedQuestion && mounted && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              onClick={() => setSelectedQuestion(null)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
            >
              <XCircle size={24} />
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-4 pr-12">{selectedQuestion.question_text}</h3>
            
            {selectedQuestion.image_url && (
              <div className="mb-6">
                <img src={selectedQuestion.image_url} alt="Minh họa câu hỏi" className="max-h-[300px] object-contain rounded-lg border border-gray-200" />
              </div>
            )}

            <div className="flex gap-2 mb-6">
              <span className="px-2.5 py-1 text-xs font-black rounded-lg uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                {selectedQuestion.difficulty || "Chưa phân loại"}
              </span>
              <span className="px-2.5 py-1 text-xs font-black rounded-lg uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                {selectedQuestion.question_type || "mcq"}
              </span>
            </div>

            <div className="space-y-3 mb-6">
              {(selectedQuestion.question_options || []).map((opt) => (
                <div key={opt.id} className={`p-4 rounded-xl border ${opt.is_correct ? 'bg-green-50 border-green-200 text-green-900' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`font-bold min-w-[24px] px-2 h-6 shrink-0 flex items-center justify-center rounded-md ${opt.is_correct ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {opt.option_label}
                    </span>
                    <span className="flex-1 mt-0.5">{opt.option_text}</span>
                  </div>
                </div>
              ))}
            </div>

            {selectedQuestion.explanation && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <h4 className="text-sm font-bold text-blue-900 mb-1">Giải thích:</h4>
                <p className="text-sm text-blue-800 leading-relaxed">{selectedQuestion.explanation}</p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
