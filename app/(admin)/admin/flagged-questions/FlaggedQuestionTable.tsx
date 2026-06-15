"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, FileText, Loader2, Flag, AlertTriangle, User, Cpu, Trash2, CheckCircle, RefreshCw } from "lucide-react";
import { moderateQuestionAction, deleteQuestionAction } from "../questions/actions";

interface QuestionData {
  id: string;
  question_text: string;
  explanation: string | null;
  question_type: string | null;
  moderation_status: string | null;
  ai_generated: boolean;
  created_at: string;
  quizzes: {
    title: string;
    documents: {
      title: string;
      users: {
        full_name: string | null;
      } | null;
    } | null;
  } | null;
}

export default function FlaggedQuestionTable({ questions }: { questions: QuestionData[] }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleModerate = (id: string, status: string | null) => {
    startTransition(async () => {
      try {
        await moderateQuestionAction(id, status as any); // actually status can be 'approved' to restore
      } catch (err: any) {
        alert("Lỗi: " + (err?.message || "Không thể cập nhật trạng thái."));
      }
    });
  };

  const handleDelete = () => {
    if (!deletingId) return;
    startTransition(async () => {
      try {
        await deleteQuestionAction(deletingId);
        setDeletingId(null);
      } catch (err) {
        alert("Lỗi khi xóa câu hỏi");
      }
    });
  };

  if (questions.length === 0) {
    return (
      <div className="p-12 text-center bg-gray-50 text-gray-500 font-medium border-t border-gray-200">
        Không có câu hỏi nào bị đánh dấu lỗi.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nội dung câu hỏi</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tài liệu / Người tạo</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái lỗi</th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Thao tác</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {questions.map((q) => (
              <tr key={q.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${q.moderation_status === 'error' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                      {q.moderation_status === 'error' ? <AlertTriangle size={18} /> : <Flag size={18} />}
                    </div>
                    <div className="max-w-md lg:max-w-xl">
                      <p className="text-sm font-bold text-gray-900 leading-relaxed line-clamp-2" title={q.question_text}>
                        {q.question_text}
                      </p>
                      {q.explanation && (
                         <p className="text-xs text-gray-400 mt-1 italic line-clamp-1">Giải thích: {q.explanation}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 font-bold text-gray-700 text-sm">
                      <FileText size={14} className="text-blue-400" />
                      <span className="truncate max-w-[150px]" title={q.quizzes?.documents?.title}>
                        {q.quizzes?.documents?.title || "Tài liệu tự do"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400 text-[10px] font-medium leading-none">
                      <User size={10} />
                      <span className="truncate max-w-[120px]">{q.quizzes?.documents?.users?.full_name || "Admin"}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                   {q.moderation_status === "flagged" ? (
                      <span className="flex items-center gap-1 py-1 px-2.5 text-[10px] font-bold rounded-lg bg-orange-100 text-orange-700 border border-orange-200 uppercase w-max"><Flag size={12}/> Kém chất lượng</span>
                   ) : (
                      <span className="flex items-center gap-1 py-1 px-2.5 text-[10px] font-bold rounded-lg bg-red-100 text-red-700 border border-red-200 uppercase w-max"><AlertTriangle size={12}/> Lỗi nội dung</span>
                   )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                  <div className="flex justify-center gap-2">
                    <button
                      disabled={isPending}
                      onClick={() => handleModerate(q.id, "approved")}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Khôi phục (Đánh dấu an toàn)"
                    >
                      <RefreshCw size={18} />
                    </button>
                    <button
                      onClick={() => setDeletingId(q.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Xóa vĩnh viễn"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Modal using Portal */}
      {mounted && deletingId && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-gray-900/40" onClick={() => !isPending && setDeletingId(null)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-pop-in text-center">
             <div className="flex items-center justify-center w-16 h-16 bg-red-100 text-red-600 rounded-2xl mb-6 mx-auto">
               <Trash2 size={32} />
             </div>
             <h3 className="text-xl font-bold text-gray-900 mb-2">Xóa vĩnh viễn?</h3>
             <p className="text-gray-500 mb-8 font-medium">Câu hỏi này sẽ bị xóa khỏi cơ sở dữ liệu và không thể dùng để AI học được nữa.</p>
             <div className="flex gap-4">
               <button
                 disabled={isPending}
                 onClick={() => setDeletingId(null)}
                 className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
               >
                 Hủy
               </button>
               <button
                 disabled={isPending}
                 onClick={handleDelete}
                 className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
               >
                 {isPending ? <Loader2 size={18} className="animate-spin" /> : "Xóa luôn"}
               </button>
             </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
