"use client";

import { useState } from "react";
import { Edit3, CheckCircle, ListChecks, Plus, Trash2, X, Save, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function QuestionList({ initialQuestions, quizId }: { initialQuestions: any[], quizId: string }) {
  const [questions, setQuestions] = useState(initialQuestions || []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  
  const supabase = createClient();
  const router = useRouter();

  const handleEdit = (q: any) => {
    const sortedOptions = [...(q.question_options || [])].sort((a: any, b: any) => a.option_label.localeCompare(b.option_label));
    
    // Ensure we always have exactly 4 options A, B, C, D
    const options = ['A', 'B', 'C', 'D'].map(label => {
      const existing = sortedOptions.find((o: any) => o.option_label === label);
      return existing || { option_label: label, option_text: "", is_correct: false };
    });

    setEditForm({
      id: q.id,
      question_text: q.question_text || "",
      explanation: q.explanation || "",
      options,
    });
    setEditingId(q.id);
  };

  const handleAdd = () => {
    setEditForm({
      id: "new",
      question_text: "",
      explanation: "",
      options: [
        { option_label: "A", option_text: "", is_correct: true },
        { option_label: "B", option_text: "", is_correct: false },
        { option_label: "C", option_text: "", is_correct: false },
        { option_label: "D", option_text: "", is_correct: false },
      ],
    });
    setEditingId("new");
  };

  const handleSave = async () => {
    if (!editForm.question_text.trim()) {
      alert("Vui lòng nhập nội dung câu hỏi!");
      return;
    }
    
    const hasCorrect = editForm.options.some((o: any) => o.is_correct);
    if (!hasCorrect) {
      alert("Vui lòng chọn ít nhất 1 đáp án đúng!");
      return;
    }

    setIsSaving(true);
    try {
      if (editingId === "new") {
        // Create new question
        const { data: qData, error: qErr } = await supabase
          .from("questions")
          .insert({
            quiz_id: quizId,
            question_text: editForm.question_text,
            explanation: editForm.explanation,
            question_type: "mcq",
            ai_generated: false,
            quality_score: 100,
          })
          .select()
          .single();

        if (qErr) throw qErr;

        // Insert options
        const optionsToInsert = editForm.options.map((o: any) => ({
          question_id: qData.id,
          option_label: o.option_label,
          option_text: o.option_text,
          is_correct: o.is_correct,
        }));

        const { data: optsData, error: oErr } = await supabase
          .from("question_options")
          .insert(optionsToInsert)
          .select();

        if (oErr) throw oErr;

        // Update total_questions count
        await supabase
          .from("quizzes")
          .update({ total_questions: questions.length + 1 })
          .eq("id", quizId);

        setQuestions([...questions, { ...qData, question_options: optsData }]);
      } else {
        // Update existing question
        const { error: qErr } = await supabase
          .from("questions")
          .update({
            question_text: editForm.question_text,
            explanation: editForm.explanation,
          })
          .eq("id", editForm.id);

        if (qErr) throw qErr;

        // Instead of upserting manually parsing IDs, we can just delete old options and insert new
        // Wait, better to keep ids if we can. But since question_options has cascading delete:
        await supabase.from("question_options").delete().eq("question_id", editForm.id);
        
        const optionsToInsert = editForm.options.map((o: any) => ({
          question_id: editForm.id,
          option_label: o.option_label,
          option_text: o.option_text,
          is_correct: o.is_correct,
        }));

        const { data: optsData, error: oErr } = await supabase
          .from("question_options")
          .insert(optionsToInsert)
          .select();

        if (oErr) throw oErr;

        // Update local state
        setQuestions(questions.map(q => 
          q.id === editForm.id 
            ? { ...q, question_text: editForm.question_text, explanation: editForm.explanation, question_options: optsData }
            : q
        ));
      }
      setEditingId(null);
      setEditForm(null);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Đã xảy ra lỗi khi lưu câu hỏi.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Bạn có chắc muốn xóa câu hỏi này?")) return;
    try {
      await supabase.from("questions").delete().eq("id", id);
      const newQuestions = questions.filter(q => q.id !== id);
      setQuestions(newQuestions);
      await supabase.from("quizzes").update({ total_questions: newQuestions.length }).eq("id", quizId);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Lỗi khi xóa câu hỏi");
    }
  };

  return (
    <div className="space-y-6">
      {questions.map((q: any, index: number) => {
        if (editingId === q.id) {
          return (
            <div key={q.id} className="bg-blue-50/50 p-6 rounded-xl shadow-sm border border-blue-200">
              <h3 className="font-bold text-lg mb-4 text-blue-900">Chi tiết câu hỏi {index + 1}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung câu hỏi</label>
                  <textarea 
                    value={editForm.question_text}
                    onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium min-h-[100px]"
                    placeholder="Nhập câu hỏi..."
                  />
                </div>
                
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Các đáp án</label>
                  {editForm.options.map((opt: any, optIdx: number) => (
                    <div key={optIdx} className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          const newOpts = editForm.options.map((o: any, i: number) => ({
                            ...o,
                            is_correct: i === optIdx
                          }));
                          setEditForm({ ...editForm, options: newOpts });
                        }}
                        className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-bold transition-colors ${
                          opt.is_correct ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                        }`}
                        title={opt.is_correct ? "Đáp án đúng" : "Đánh dấu là đáp án đúng"}
                      >
                        {opt.option_label}
                      </button>
                      <input 
                        type="text"
                        value={opt.option_text}
                        onChange={(e) => {
                          const newOpts = [...editForm.options];
                          newOpts[optIdx].option_text = e.target.value;
                          setEditForm({ ...editForm, options: newOpts });
                        }}
                        className={`flex-1 bg-white border rounded-lg p-2.5 outline-none focus:ring-2 transition-all ${
                          opt.is_correct ? "border-green-300 focus:border-green-500 focus:ring-green-200 bg-green-50/30" : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                        }`}
                        placeholder={`Nhập đáp án ${opt.option_label}...`}
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giải thích (Tùy chọn)</label>
                  <textarea 
                    value={editForm.explanation}
                    onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm min-h-[80px]"
                    placeholder="Giải thích vì sao đáp án lại đúng..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-blue-100">
                  <button 
                    onClick={() => { setEditingId(null); setEditForm(null); }}
                    className="px-4 py-2 text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-colors"
                  >
                     Hủy bỏ
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 shadow-sm transition-colors"
                  >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Lưu thay đổi
                  </button>
                </div>
              </div>
            </div>
          );
        }

        const sortedOptions = [...(q.question_options || [])].sort((a: any, b: any) => a.option_label.localeCompare(b.option_label));
        
        return (
          <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative group transition-all hover:border-blue-200 hover:shadow-md">
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <button 
                onClick={() => handleEdit(q)}
                className="p-2 text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors"
                title="Sửa câu hỏi"
              >
                <Edit3 size={18} />
              </button>
              <button 
                onClick={(e) => handleDelete(q.id, e)}
                className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors"
                title="Xóa câu hỏi"
              >
                <Trash2 size={18} />
              </button>
            </div>
            
            <h3 className="font-bold text-lg mb-5 text-gray-800 pr-20 leading-relaxed">Câu {index + 1}: {q.question_text}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {sortedOptions?.map((opt: any) => (
                <div key={opt.id} className={`p-3 rounded-lg border flex items-start gap-2 ${opt.is_correct ? 'bg-green-50 border-green-200 text-green-900 font-medium shadow-sm' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
                  <span className="font-bold flex-shrink-0">{opt.option_label}.</span> 
                  <span>{opt.option_text}</span>
                  {opt.is_correct && <CheckCircle className="ml-auto flex-shrink-0 text-green-500" size={18} />}
                </div>
              ))}
            </div>

            {q.explanation && (
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 mt-2">
                <p className="text-sm font-bold text-blue-800 mb-1 flex items-center gap-1.5"><ListChecks size={16} /> Giải thích chi tiết:</p>
                <p className="text-sm text-blue-900/80 leading-relaxed">{q.explanation}</p>
              </div>
            )}
          </div>
        );
      })}
      
      {editingId === "new" && (
        <div className="bg-blue-50/50 p-6 rounded-xl shadow-sm border border-blue-200">
          <h3 className="font-bold text-lg mb-4 text-blue-900">Thêm câu hỏi mới</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung câu hỏi</label>
              <textarea 
                value={editForm.question_text}
                onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
                className="w-full bg-white border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium min-h-[100px]"
                placeholder="Nhập câu hỏi..."
              />
            </div>
            
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Các đáp án</label>
              {editForm.options.map((opt: any, optIdx: number) => (
                <div key={optIdx} className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const newOpts = editForm.options.map((o: any, i: number) => ({
                         ...o, is_correct: i === optIdx
                      }));
                      setEditForm({ ...editForm, options: newOpts });
                    }}
                    className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-bold transition-colors ${
                      opt.is_correct ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                    }`}
                    title={opt.is_correct ? "Đáp án đúng" : "Đánh dấu là đáp án đúng"}
                  >
                    {opt.option_label}
                  </button>
                  <input 
                    type="text"
                    value={opt.option_text}
                    onChange={(e) => {
                      const newOpts = [...editForm.options];
                      newOpts[optIdx].option_text = e.target.value;
                      setEditForm({ ...editForm, options: newOpts });
                    }}
                    className={`flex-1 bg-white border rounded-lg p-2.5 outline-none focus:ring-2 transition-all ${
                      opt.is_correct ? "border-green-300 focus:border-green-500 focus:ring-green-200 bg-green-50/30" : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                    }`}
                    placeholder={`Nhập đáp án ${opt.option_label}...`}
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giải thích (Tùy chọn)</label>
              <textarea 
                value={editForm.explanation}
                onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                className="w-full bg-white border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm min-h-[80px]"
                placeholder="Giải thích vì sao đáp án lại đúng..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-blue-100">
              <button 
                onClick={() => { setEditingId(null); setEditForm(null); }}
                className="px-4 py-2 text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-colors"
              >
                  Hủy bỏ
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 shadow-sm transition-colors"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Thêm câu hỏi
              </button>
            </div>
          </div>
        </div>
      )}

      {editingId !== "new" && (
        <button 
          onClick={handleAdd}
          className="w-full py-4 bg-gray-50 hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-300 rounded-xl font-medium text-gray-600 hover:text-blue-600 transition-colors flex justify-center items-center gap-2"
        >
          <Plus size={18} /> Nhập thủ công thêm 1 câu hỏi
        </button>
      )}
    </div>
  );
}
