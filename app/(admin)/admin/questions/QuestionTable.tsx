"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, FileText, Loader2, Info, Flag, AlertTriangle, User, Cpu } from "lucide-react";
import { moderateQuestionAction } from "./actions";

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
                      onClick={() => handleModerate(q.id, "error")}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Báo lỗi nội dung"
                    >
                      <AlertTriangle size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </>
  );
}
