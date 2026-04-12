import Link from "next/link";
import { BookOpen, PlusCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function QuizzesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let quizzes: any[] = [];
  if (user) {
    const { data } = await supabase
      .from("quizzes")
      .select("*, questions(count)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    
    if (data) quizzes = data;
  }

  return (
    <div className="animate-slide-in-left">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-extrabold text-gray-800">Danh sách Bộ Câu hỏi</h1>
        <Link 
          href="/quizzes/create"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
        >
          <PlusCircle size={18} />
          Tạo Quiz tự do
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quizzes.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 font-medium">
             Bạn chưa tạo Bộ câu hỏi nào. <Link href="/quizzes/create" className="text-blue-600 hover:underline">Tạo ngay</Link>
          </div>
        ) : quizzes.map(quiz => (
          <div key={quiz.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <BookOpen size={20} />
              </div>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                quiz.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {quiz.status === 'published' ? 'Đã lưu' : 'Bản nháp'}
              </span>
            </div>
            
            <h3 className="font-bold text-lg text-gray-800 mb-1 line-clamp-2">{quiz.title}</h3>
            <p className="text-sm text-gray-500 mb-4">{quiz.total_questions || quiz.questions?.[0]?.count || 0} câu hỏi</p>
            
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
              <Link href={`/quizzes/${quiz.id}`} className="flex-1 text-center bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors">
                Chỉnh sửa
              </Link>
              <Link href={`/quizzes/${quiz.id}/start`} className="flex-1 text-center bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-medium transition-colors">
                Làm bài ngay
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
