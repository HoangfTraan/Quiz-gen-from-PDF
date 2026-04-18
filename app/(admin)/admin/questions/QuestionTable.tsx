"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { Trash2, Edit2, HelpCircle, FileText, X, Loader2, Save, Info, CheckCircle, Flag, AlertTriangle, User, Cpu } from "lucide-react";
import { updateQuestionAction, deleteQuestionAction, moderateQuestionAction } from "./actions";

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

export default function QuestionTable({ questions }: { questions: QuestionData[] }) {
  const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleModerate = (id: string, status: string) => {
    startTransition(async () => {
      try {
        await moderateQuestionAction(id, status);
      } catch (err: any) {
        alert("Lỗi: " + (err?.message || "Không thể cập nhật trạng thái. Hãy đảm bảo bạn đã chạy câu lệnh SQL thêm cột moderation_status vào bảng questions."));
      }
    });
  };

  const getModerationBadge = (status: string | null) => {
    switch (status) {
      case "approved":
        return <span className="flex items-center gap-1 py-1 px-2.5 text-[10px] font-bold rounded-lg bg-green-100 text-green-700 border border-green-200 uppercase"><CheckCircle size={12}/> Đã duyệt</span>;
      case "flagged":
        return <span className="flex items-center gap-1 py-1 px-2.5 text-[10px] font-bold rounded-lg bg-orange-100 text-orange-700 border border-orange-200 uppercase"><Flag size={12}/> Kém</span>;
      case "error":
        return <span className="flex items-center gap-1 py-1 px-2.5 text-[10px] font-bold rounded-lg bg-red-100 text-red-700 border border-red-200 uppercase"><AlertTriangle size={12}/> Lỗi</span>;
      default:
        return <span className="flex items-center gap-1 py-1 px-2.5 text-[10px] font-bold rounded-lg bg-gray-100 text-gray-500 border border-gray-200 uppercase">Chờ duyệt</span>;
    }
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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;

    const formData = new FormData();
    formData.append("id", editingQuestion.id);
    formData.append("question_text", editingQuestion.question_text);
    formData.append("explanation", editingQuestion.explanation || "");

    startTransition(async () => {
      try {
        await updateQuestionAction(formData);
        setEditingQuestion(null);
      } catch (err) {
        alert("Lỗi khi cập nhật câu hỏi");
      }
    });
  };

  if (questions.length === 0) {
    return (
      <div className="p-12 text-center bg-gray-50 text-gray-500 font-medium border-t border-gray-200">
        Không tìm thấy câu hỏi nào phù hợp.
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
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái</th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Nguồn</th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Thao tác</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {questions.map((q) => (
              <tr key={q.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-lg shrink-0 mt-0.5">
                      <HelpCircle size={18} />
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
                   {getModerationBadge(q.moderation_status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                   {q.ai_generated ? (
                     <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 text-[10px] font-black border border-purple-100">
                       <Cpu size={12} /> AI
                     </span>
                   ) : (
                     <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[10px] font-black border border-amber-100">
                       <User size={12} /> USER
                     </span>
                   )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                  <div className="flex justify-center gap-2">
                    <button
                      disabled={isPending}
                      onClick={() => handleModerate(q.id, "approved")}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Duyệt câu hỏi"
                    >
                      <CheckCircle size={18} />
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => handleModerate(q.id, "flagged")}
                      className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Gắn cờ chất lượng kém"
                    >
                      <Flag size={18} />
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => handleModerate(q.id, "error")}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Báo lỗi nội dung"
                    >
                      <AlertTriangle size={18} />
                    </button>
                    <button
                      onClick={() => setEditingQuestion(q)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Sửa câu hỏi"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => setDeletingId(q.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Xóa câu hỏi"
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

      {/* Edit Modal using Portal */}
      {mounted && editingQuestion && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-gray-900/40" onClick={() => !isPending && setEditingQuestion(null)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden animate-pop-in">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Chỉnh sửa câu hỏi</h2>
              <button 
                onClick={() => setEditingQuestion(null)} 
                className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nội dung câu hỏi</label>
                <textarea
                  value={editingQuestion.question_text}
                  onChange={(e) => setEditingQuestion({...editingQuestion, question_text: e.target.value})}
                  className="w-full p-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[120px] text-sm font-medium leading-relaxed"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Giải thích (Explanation)</label>
                <textarea
                  value={editingQuestion.explanation || ""}
                  onChange={(e) => setEditingQuestion({...editingQuestion, explanation: e.target.value})}
                  className="w-full p-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[80px] text-sm font-medium leading-relaxed"
                  placeholder="Nhập giải thích cho câu trả lời đúng..."
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {isPending ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Modal using Portal */}
      {mounted && deletingId && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-gray-900/40" onClick={() => !isPending && setDeletingId(null)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-pop-in text-center">
             <div className="flex items-center justify-center w-16 h-16 bg-red-100 text-red-600 rounded-2xl mb-6 mx-auto">
               <Trash2 size={32} />
             </div>
             <h3 className="text-xl font-bold text-gray-900 mb-2">Xóa câu hỏi?</h3>
             <p className="text-gray-500 mb-8 font-medium">Bạn có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng không?</p>
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
                 {isPending ? <Loader2 size={18} className="animate-spin" /> : "Xác nhận xóa"}
               </button>
             </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
