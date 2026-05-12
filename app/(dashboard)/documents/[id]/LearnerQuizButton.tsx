"use client";

import { Play } from "lucide-react";
import Link from "next/link";

export default function LearnerQuizButton({ quizId }: { quizId?: string }) {
  if (!quizId) {
    return (
      <button 
        onClick={() => alert("Tài liệu này hiện chưa có bộ câu hỏi nào được tạo.")}
        className="bg-gray-400 hover:bg-gray-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-md flex items-center gap-2 transition"
      >
        <Play size={18} /> Làm bài thi
      </button>
    );
  }

  return (
    <Link 
      href={`/quizzes/${quizId}/start`} 
      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/30 flex items-center gap-2 transform transition hover:scale-105"
    >
      <Play size={18} /> Làm bài thi
    </Link>
  );
}
