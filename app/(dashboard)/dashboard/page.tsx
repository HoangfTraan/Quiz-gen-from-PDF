import Link from "next/link";
import { BookOpen, FileText, CheckCircle, Clock } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Lấy dữ liệu thống kê
  const { count: docsCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: quizzesCount } = await supabase
    .from('quizzes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { data: attempts } = await supabase
    .from('quiz_attempts')
    .select('score, total_questions')
    .eq('user_id', user.id);

  const attemptsCount = attempts?.length || 0;
  
  let averageScore = 0;
  if (attempts && attempts.length > 0) {
    const totalScore = attempts.reduce((acc, attempt) => {
       const scale = attempt.total_questions > 0 ? (attempt.score / attempt.total_questions) * 10 : 0;
       return acc + scale;
    }, 0);
    averageScore = Number((totalScore / attempts.length).toFixed(1));
  }

  // Fetch Gợi ý học tiếp
  let recommendations: any[] = [];
  if (user) {
     const { data } = await supabase
       .from('study_recommendations')
       .select('id, recommendation_text, reason, created_at')
       .eq('user_id', user.id)
       .order('created_at', { ascending: false })
       .limit(3);
     if (data) recommendations = data;
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-gray-800 mb-6">Tổng quan (Dashboard)</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Tài liệu đã tải</p>
            <p className="text-2xl font-bold text-gray-800">{docsCount || 0}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Bộ câu hỏi</p>
            <p className="text-2xl font-bold text-gray-800">{quizzesCount || 0}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-lg">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Bài đã làm</p>
            <p className="text-2xl font-bold text-gray-800">{attemptsCount}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Điểm trung bình</p>
            <p className="text-2xl font-bold text-gray-800">{averageScore}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Gợi ý học tiếp</h2>
        {recommendations.length === 0 ? (
          <div className="p-6 bg-gray-50 text-gray-500 rounded-lg border border-dashed border-gray-200 text-center">
            Bạn chưa có gợi ý học tập nào. Hãy tải tài liệu và làm bài thi để AI có thể phân tích và đưa ra gợi ý nhé!
          </div>
        ) : (
          <div className="space-y-4">
            {recommendations.map(rec => (
              <div key={rec.id} className="p-4 bg-blue-50 text-blue-800 rounded-lg border border-blue-100">
                <p className="font-bold">{rec.recommendation_text}</p>
                {rec.reason && <p className="text-sm mt-1 text-blue-600">{rec.reason}</p>}
                <Link href="/documents" className="mt-3 inline-block text-sm font-bold underline hover:text-blue-900">
                  Xem tài liệu liên quan
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
