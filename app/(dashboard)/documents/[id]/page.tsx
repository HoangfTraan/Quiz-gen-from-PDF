import Link from "next/link";
import { FileText, ArrowLeft, RefreshCw, Play, BookOpen } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import KeywordEditor from "./KeywordEditor";
import SummaryEditor from "./SummaryEditor";
import { getUserRole } from "@/utils/rbac-server";
import { canTakeQuiz } from "@/utils/rbac";
import LearnerQuizButton from "./LearnerQuizButton";

export default async function DocumentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  // Song song hóa toàn bộ truy vấn dữ liệu bằng Promise.all để tối ưu hóa thời gian phản hồi
  const [role, docResult, contentResult, latestQuizResult, chaptersResult] = await Promise.all([
    getUserRole(user.id),
    supabase.from('documents').select('*, subjects(name)').eq('id', id).single(),
    supabase.from('document_contents').select('summary, keywords').eq('document_id', id).single(),
    supabase
      .from('quizzes')
      .select('id')
      .eq('document_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('chapters')
      .select('id, chapter_index, title, detection_method, start_page, end_page')
      .eq('document_id', id)
      .order('chapter_index', { ascending: true })
  ]);

  const doc = docResult.data;
  if (!doc) return notFound();

  const canTake = canTakeQuiz(role);
  const content = contentResult.data;
  const latestQuiz = latestQuizResult.data;
  const chapters = chaptersResult.data || [];

  const learnerHref = latestQuiz ? `/quizzes/${latestQuiz.id}/start` : `/documents/${id}/analysis`;
  const teacherHref = latestQuiz ? `/quizzes/${latestQuiz.id}` : `/documents/${id}/analysis`;

  return (
    <div className="animate-slide-in-left max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href="/documents" className="text-gray-500 hover:text-gray-800 flex items-center gap-2 w-fit font-medium">
          <ArrowLeft size={16} /> Quay lại danh sách
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-extrabold text-gray-800 flex items-center gap-2 sm:gap-3">
            <FileText className="text-blue-600 shrink-0" size={24} /> <span className="break-words">{doc.title}</span>
          </h1>
          <div className="text-gray-500 mt-2 font-medium text-sm sm:text-base flex flex-wrap items-center gap-1">
            <span>Môn học: {doc.subjects?.name || "Không phân loại"}</span>
            <span>•</span>
            <span className="flex items-center gap-1">Trạng thái:
            <span className={`inline-block ml-1 px-2 py-0.5 rounded text-xs sm:text-sm ${doc.status === 'completed' ? 'bg-green-100 text-green-700' :
                doc.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
              }`}>
              {doc.status === 'completed' ? 'Hoàn thành' :
                doc.status === 'analyzed' ? 'Đã phân tích' :
                doc.status === 'failed' ? 'Thất bại' : 'Đang xử lý...'}
            </span>
            </span>
          </div>
        </div>
        {doc.status === 'completed' && (
          canTake ? (
            <LearnerQuizButton quizId={latestQuiz?.id} />
          ) : (
            <Link
              href={teacherHref}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transform transition hover:scale-105 shrink-0 w-full sm:w-auto text-sm sm:text-base"
            >
              <RefreshCw size={18} /> Xem câu hỏi
            </Link>
          )
        )}
      </div>

      <div className="space-y-6">
        <SummaryEditor documentId={id} initialSummary={content?.summary} status={doc.status} />

        <KeywordEditor documentId={id} initialKeywords={content?.keywords} />

        {/* Danh sách chương đã phát hiện */}
        {chapters.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-extrabold text-gray-800 flex items-center gap-2 mb-4">
              <BookOpen size={20} className="text-emerald-600" /> Cấu trúc chương ({chapters.length})
            </h2>
            <div className="space-y-2">
              {chapters.map((ch: any) => (
                <div key={ch.id} className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-sm font-bold text-gray-400 w-8">{ch.chapter_index}.</span>
                  <span className="flex-1 text-sm font-bold text-gray-800">{ch.title}</span>
                  {ch.start_page && (
                    <span className="text-xs text-gray-400">Trang {ch.start_page}{ch.end_page ? `-${ch.end_page}` : ''}</span>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    ch.detection_method === 'regex' ? 'bg-green-100 text-green-700' :
                    ch.detection_method === 'ai' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {ch.detection_method}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
