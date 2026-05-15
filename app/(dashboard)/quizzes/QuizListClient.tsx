"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { BookOpen, Play, Eye, Edit3, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { AppRole } from "@/utils/rbac";
import { canAuthorQuiz, canTakePublishedQuiz } from "@/utils/rbac";

interface QuizListClientProps {
  role: AppRole;
  userId: string;
  teacherIds?: string[];
}

export default function QuizListClient({ role, userId, teacherIds = [] }: QuizListClientProps) {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<Record<string, string>>({}); // quiz_id -> attempt_id
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;
  const supabase = createClient();

  const isAuthor = canAuthorQuiz(role);
  const isLearner = canTakePublishedQuiz(role);

  const fetchQuizzes = useCallback(async () => {
    let query = supabase
      .from("quizzes")
      .select("*, questions(count), users(full_name)")
      .order("created_at", { ascending: false });

    if (isAuthor) {
      // Teacher: xem bộ đề của chính mình (cả draft và published)
      query = query.eq("user_id", userId);
    } else if (isLearner) {
      // Learner: xem bộ đề của mình + bộ đề published từ giáo viên (không thấy của learner khác)
      if (teacherIds.length > 0) {
        query = query.or(`user_id.eq.${userId},and(status.eq.published,user_id.in.(${teacherIds.join(',')}))`)
      } else {
        // Không có giáo viên nào -> chỉ hiện bộ đề của mình
        query = query.eq("user_id", userId);
      }
    }

    const { data } = await query;
    if (data) setQuizzes(data);

    // Fetch attempts cho learner (để đánh dấu bài đã làm)
    if (isLearner) {
      const { data: userAttempts } = await supabase
        .from('quiz_attempts')
        .select('id, quiz_id')
        .eq('user_id', userId);

      if (userAttempts) {
        const map: Record<string, string> = {};
        userAttempts.forEach((a: any) => {
          map[a.quiz_id] = a.id;
        });
        setAttempts(map);
      }
    }

    setLoading(false);
  }, [supabase, userId, isAuthor, isLearner, teacherIds]);

  useEffect(() => {
    fetchQuizzes();

    // Realtime subscription — tự cập nhật khi có thay đổi
    const channelName = `quiz_list_${userId}_${Math.random().toString(36).substring(2, 9)}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quizzes" },
        () => {
          // Refetch toàn bộ danh sách khi có thay đổi bất kỳ
          fetchQuizzes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQuizzes, supabase, userId]);

  // Pagination
  const totalItems = quizzes.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedQuizzes = quizzes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={36} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-extrabold text-gray-800">
          {isLearner ? "Bộ đề thi" : "Danh sách Bộ Câu hỏi"}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedQuizzes.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 font-medium pb-20">
            {isLearner
              ? "Chưa có bộ đề nào được xuất bản. Vui lòng chờ giáo viên xuất bản bộ đề."
              : "Bạn chưa có Bộ câu hỏi nào. Hãy tải tài liệu lên để AI tạo bộ đề."}
          </div>
        ) : (
          paginatedQuizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col"
            >
              {/* Header: icon + badge trạng thái */}
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <BookOpen size={20} />
                </div>

                {/* Badge trạng thái: chỉ hiện cho teacher */}
                {isAuthor && (
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      quiz.status === "published"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {quiz.status === "published" ? "Đã xuất bản" : "Bản nháp"}
                  </span>
                )}

                {isLearner && (() => {
                  const isOwnQuiz = quiz.user_id === userId;
                  const isCompleted = !isOwnQuiz && !!attempts[quiz.id];
                  
                  return (
                    <div className="flex items-center gap-2">
                      {!isOwnQuiz && isCompleted && (
                        <span className="px-2 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700 border border-green-200 flex items-center gap-1">
                          <CheckCircle2 size={10} /> Đã làm
                        </span>
                      )}
                      <span
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl text-right break-words leading-relaxed ${
                          isOwnQuiz
                            ? "bg-purple-100 text-purple-800"
                            : "bg-indigo-100 text-indigo-800"
                        }`}
                        title={!isOwnQuiz ? `Từ giáo viên: ${quiz.users?.full_name || 'Hệ thống'}` : 'Bộ đề do bạn tạo'}
                      >
                        {isOwnQuiz ? "Của tôi" : `Từ: ${quiz.users?.full_name || 'Giáo viên'}`}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <h3 className="font-bold text-lg text-gray-800 mb-1 line-clamp-2 min-h-[56px]">
                {quiz.title}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {quiz.total_questions || quiz.questions?.[0]?.count || 0} câu hỏi
              </p>

              {/* Footer actions — theo role */}
              <div className="flex gap-2 mt-auto pt-4 border-t border-gray-100">

                {isLearner && (() => {
                  const isOwnQuiz = quiz.user_id === userId;
                  const attemptId = attempts[quiz.id];

                  // Bộ đề published từ giáo viên → đã làm thì chỉ xem kết quả
                  if (!isOwnQuiz && attemptId) {
                    return (
                      <Link
                        href={`/attempts/${attemptId}/result`}
                        className="flex-1 text-center bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 size={15} /> Xem kết quả
                      </Link>
                    );
                  }

                  // Bộ đề của mình → luôn có nút Làm bài + thêm Xem kết quả nếu đã làm
                  return (
                    <>
                      <Link
                        href={`/quizzes/${quiz.id}/start`}
                        className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Play size={15} /> Làm bài ngay
                      </Link>
                      {isOwnQuiz && attemptId && (
                        <Link
                          href={`/attempts/${attemptId}/result`}
                          className="text-center bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 py-2 px-3 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Eye size={15} /> Kết quả
                        </Link>
                      )}
                    </>
                  );
                })()}

                {/* Teacher: "Chỉnh sửa" (draft) hoặc "Xem / Chỉnh sửa" (published) */}
                {isAuthor && (
                  <Link
                    href={`/quizzes/${quiz.id}`}
                    className="flex-1 text-center bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    {quiz.status === "published" ? (
                      <><Eye size={15} /> Xem</>
                    ) : (
                      <><Edit3 size={15} /> Chỉnh sửa</>
                    )}
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-12 py-6 border-t border-gray-100">
          <p className="text-sm text-gray-500 font-medium tracking-tight">
            Hiển thị <span className="font-black text-gray-900">{(currentPage - 1) * pageSize + 1}</span> -{" "}
            <span className="font-black text-gray-900">{Math.min(currentPage * pageSize, totalItems)}</span> trong số{" "}
            <span className="font-black text-gray-900">{totalItems}</span> bộ đề
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-all"
            >
              ← Trước
            </button>
            <div className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-black text-blue-600">
              {currentPage} / {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-all"
            >
              Sau →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
