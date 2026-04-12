"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft, CheckCircle2, XCircle, Save, Loader2, ListChecks } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ReviewQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [questions, setQuestions] = useState<any[]>([]);
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchQuestions() {
       const { data, error } = await supabase
         .from('questions')
         .select(`
           id,
           question_text,
           explanation,
           question_options (id, option_label, option_text, is_correct)
         `)
         .eq('quiz_id', id);
       
       if (data) {
         setQuestions(data);
       }
       setLoading(false);
    }
    fetchQuestions();
  }, [id, supabase]);

  const toggleReject = (id: string) => {
    const newSet = new Set(rejectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setRejectedIds(newSet);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (rejectedIds.size > 0) {
        const idsToDelete = Array.from(rejectedIds);
        await supabase.from('questions').delete().in('id', idsToDelete);
        
        // Update quiz total_questions count
        const newTotal = questions.length - rejectedIds.size;
        await supabase.from('quizzes').update({ total_questions: newTotal, status: 'published' }).eq('id', id);
      } else {
        await supabase.from('quizzes').update({ status: 'published' }).eq('id', id);
      }
      router.push(`/quizzes/${id}`);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="animate-slide-in-right max-w-4xl mx-auto mt-4 px-4 pb-20">
      <div className="mb-6">
        <Link href={`/quizzes`} className="text-gray-500 hover:text-gray-800 flex items-center gap-2 w-fit font-medium">
          <ArrowLeft size={16} /> Bỏ qua
        </Link>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between sticky top-0 z-10 gap-4">
         <div>
            <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3">
               <ListChecks className="text-blue-600" /> Duyệt câu hỏi AI
            </h1>
            <p className="text-gray-500 mt-1 text-sm">Loại bỏ những câu hỏi không có nghĩa trước khi đưa vào ngân hàng đề</p>
         </div>
         <button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-md flex items-center gap-2 shrink-0">
            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 
            Lưu đề thi ({questions.length - rejectedIds.size} câu)
         </button>
      </div>

      {questions.length === 0 && (
         <div className="text-center p-12 bg-white rounded-2xl border border-gray-100 text-gray-500 font-medium">
           Chưa có câu hỏi nào được tạo. Có thể do AI không thể phân tích văn bản này.
         </div>
      )}

      <div className="space-y-6">
         {questions.map((q, index) => {
           const isRejected = rejectedIds.has(q.id);
           return (
             <div key={q.id} className={`p-6 rounded-2xl border-2 transition-all ${isRejected ? 'border-red-200 bg-red-50 opacity-70' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                <div className="flex justify-between items-start gap-4 mb-4">
                   <h3 className={`text-lg font-bold ${isRejected ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                      Câu {index + 1}: {q.question_text}
                   </h3>
                   <button 
                     onClick={() => toggleReject(q.id)}
                     className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-sm transition-colors ${isRejected ? 'bg-red-200 text-red-800' : 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700 group'}`}
                   >
                     {isRejected ? (
                        <><CheckCircle2 size={16} /> Phục hồi</>
                     ) : (
                        <><XCircle size={16} className="text-red-500 group-hover:text-red-700" /> <span className="text-red-600 group-hover:text-red-700">Loại bỏ</span></>
                     )}
                   </button>
                </div>

                <div className="space-y-2 mb-4">
                  {q.question_options?.sort((a: any, b: any) => a.option_label.localeCompare(b.option_label)).map((opt: any) => (
                    <div key={opt.id} className={`p-3 rounded-xl text-sm ${opt.is_correct ? 'bg-green-100 border border-green-300 font-medium text-green-900' : 'bg-gray-50 border border-gray-100 text-gray-700'}`}>
                       <span className="font-bold mr-2">{opt.option_label}.</span> {opt.option_text}
                    </div>
                  ))}
                </div>

                {q.explanation && (
                  <div className="text-sm bg-blue-50 p-3 rounded-lg text-blue-800 border border-blue-100">
                    <span className="font-bold">Giải thích:</span> {q.explanation}
                  </div>
                )}
             </div>
           );
         })}
      </div>
    </div>
  );
}
