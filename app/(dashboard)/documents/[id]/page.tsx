import Link from "next/link";
import { FileText, ArrowLeft, RefreshCw, Play } from "lucide-react";
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
  const [role, docResult, contentResult, latestQuizResult] = await Promise.all([
    getUserRole(user.id),
    supabase.from('documents').select('*, subjects(name)').eq('id', id).single(),
    supabase.from('document_contents').select('summary, keywords').eq('document_id', id).single(),
    supabase
      .from('quizzes')
      .select('id')
      .eq('document_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const doc = docResult.data;
  if (!doc) return notFound();

  const canTake = canTakeQuiz(role);
  const content = contentResult.data;
  const latestQuiz = latestQuizResult.data;

  const learnerHref = latestQuiz ? `/quizzes/${latestQuiz.id}/start` : `/documents/${id}/analysis`;
  const teacherHref = latestQuiz ? `/quizzes/${latestQuiz.id}` : `/documents/${id}/analysis`;

  return (
    <div className="animate-slide-in-left max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href="/documents" className="text-gray-500 hover:text-gray-800 flex items-center gap-2 w-fit font-medium">
          <ArrowLeft size={16} /> Quay lại danh sách
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-800 flex items-center gap-3">
            <FileText className="text-blue-600" /> {doc.title}
          </h1>
          <p className="text-gray-500 mt-2 font-medium">
            Môn học: {doc.subjects?.name || "Không phân loại"} • Trạng thái:
            <span className={`inline-block ml-2 px-2 py-0.5 rounded text-sm ${doc.status === 'completed' ? 'bg-green-100 text-green-700' :
                doc.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
              }`}>
              {doc.status === 'completed' ? 'Hoàn thành' :
                doc.status === 'failed' ? 'Thất bại' : 'Đang xử lý...'}
            </span>
          </p>
        </div>
        {doc.status === 'completed' && (
          canTake ? (
            <LearnerQuizButton quizId={latestQuiz?.id} />
          ) : (
            <Link
              href={teacherHref}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/30 flex items-center gap-2 transform transition hover:scale-105"
            >
              <RefreshCw size={18} /> Xem câu hỏi
            </Link>
          )
        )}
      </div>

      <div className="space-y-6">
        <SummaryEditor documentId={id} initialSummary={content?.summary} status={doc.status} />

        <KeywordEditor documentId={id} initialKeywords={content?.keywords} />
      </div>
    </div>
  );
}
