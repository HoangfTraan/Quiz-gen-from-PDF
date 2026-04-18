"use client";

import { useState } from "react";
import { Edit3, CheckCircle, ListChecks, Plus, Trash2, X, Save, Loader2, AlertTriangle, Flag, ShieldAlert } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";

export default function QuestionList({ initialQuestions, quizId }: { initialQuestions: any[], quizId: string }) {
  const [questions, setQuestions] = useState(initialQuestions || []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [filter, setFilter] = useState("all");

  const supabase = createClient();
  const router = useRouter();

  const parseExplanation = (text?: string, dbDiff?: string) => {
    if (!text) return { diff: dbDiff || null, text: '' };
    const tagMatch = text.match(/^\[MỨC ĐỘ:\s*(.*?)\]\s*(.*)/is);
    if (tagMatch) return { diff: tagMatch[1].trim(), text: tagMatch[2] };
    const aiMatch = text.match(/^(?:Đây là )?(?:câu hỏi )?(?:ở )?(?:mức độ|cấp độ)\s+([^.]*?)\.\s*(.*)/is);
    if (aiMatch) return { diff: aiMatch[1].trim(), text: aiMatch[2] };
    return { diff: dbDiff || null, text };
  };

  const handleEdit = (q: any) => {
    const sortedOptions = [...(q.question_options || [])].sort((a: any, b: any) => a.option_label.localeCompare(b.option_label));

    // Ensure we always have exactly 4 options A, B, C, D
    const options = ['A', 'B', 'C', 'D'].map(label => {
      const existing = sortedOptions.find((o: any) => o.option_label === label);
      return existing || { option_label: label, option_text: "", is_correct: false };
    });

    const parsed = parseExplanation(q.explanation || "", q.difficulty);
    setEditForm({
      id: q.id,
      question_text: q.question_text || "",
      explanation: parsed.text || "",
      bloom_level: parsed.diff || "",
      options,
    });
    setEditingId(q.id);
  };

  const handleAdd = () => {
    setEditForm({
      id: "new",
      question_text: "",
      explanation: "",
      bloom_level: "",
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
      const difficultyTag = editForm.bloom_level ? `[MỨC ĐỘ: ${editForm.bloom_level.toUpperCase()}] ` : '';
      const fullExplanation = difficultyTag + editForm.explanation;

      if (editingId === "new") {
        // Create new question
        const { data: qData, error: qErr } = await supabase
          .from("questions")
          .insert({
            quiz_id: quizId,
            question_text: editForm.question_text,
            explanation: fullExplanation,
            difficulty: editForm.bloom_level, // LƯU VÀO CỘT RIÊNG
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
            explanation: fullExplanation,
            difficulty: editForm.bloom_level, // LƯU VÀO CỘT RIÊNG
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
            ? { ...q, question_text: editForm.question_text, explanation: fullExplanation, difficulty: editForm.bloom_level, question_options: optsData }
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

  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuestionToDelete(id);
  };

  const executeDeleteQuestion = async () => {
    if (!questionToDelete) return;
    try {
      await supabase.from("questions").delete().eq("id", questionToDelete);
      const newQuestions = questions.filter(q => q.id !== questionToDelete);
      setQuestions(newQuestions);
      await supabase.from("quizzes").update({ total_questions: newQuestions.length }).eq("id", quizId);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Lỗi khi xóa câu hỏi");
    } finally {
      setQuestionToDelete(null);
    }
  };

  const uniqueDifficulties = Array.from(new Set(questions.map((q: any) => parseExplanation(q.explanation, q.difficulty).diff).filter(Boolean)));

  const activeQuestions = questions.filter(q => !['flagged', 'error'].includes(q.moderation_status));
  const hiddenQuestions = questions.filter(q => ['flagged', 'error'].includes(q.moderation_status));

  return (
    <div className="space-y-6">
      {questions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6 bg-gray-50 p-3 rounded-xl border border-gray-200">
          <span className="text-sm font-bold text-gray-500 mr-2 uppercase tracking-tight">Bộ lọc Bloom:</span>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all uppercase tracking-wider ${filter === "all" ? "bg-indigo-600 text-white shadow-md scale-105" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"}`}
          >
            Tất cả
          </button>
          {uniqueDifficulties.map((diff: any) => (
            <button
              key={diff}
              onClick={() => setFilter(diff.toLowerCase())}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all uppercase tracking-wider ${filter === diff.toLowerCase() ? "bg-indigo-600 text-white shadow-md scale-105" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"}`}
            >
              {diff}
            </button>
          ))}
          {questions.some((q: any) => !parseExplanation(q.explanation).diff) && (
            <button
              onClick={() => setFilter("none")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all uppercase tracking-wider ${filter === "none" ? "bg-gray-600 text-white shadow-md scale-105" : "bg-white text-gray-400 border border-gray-200 hover:bg-gray-100"}`}
            >
              Chưa phân loại
            </button>
          )}
        </div>
      )}

      {activeQuestions.map((q: any, index: number) => {
        const qDiff = parseExplanation(q.explanation, q.difficulty).diff?.toLowerCase() || "none";
        if (filter !== "all" && qDiff !== filter) return null;

        if (editingId === q.id) {
          return (
            <div key={q.id} className="bg-white p-8 rounded-3xl shadow-2xl border-2 border-blue-500/20 relative animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                    <Edit3 size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-xl text-gray-900 leading-none">Chỉnh sửa câu hỏi</h3>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Thay đổi nội dung và các tùy chọn đáp án</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setEditingId(null); setEditForm(null); }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-8">
                {/* Question Section */}
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Nội dung câu hỏi chính</label>
                  <textarea
                    value={editForm.question_text}
                    onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all font-bold text-lg text-gray-800 min-h-[120px] shadow-inner"
                    placeholder="Ví dụ: Thủ đô của Việt Nam là gì?"
                  />
                </div>

                {/* Options Grid */}
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">Các lựa chọn đáp án (Chọn 1 đáp án đúng)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {editForm.options.map((opt: any, optIdx: number) => (
                      <div 
                        key={optIdx} 
                        className={`group flex items-center gap-3 p-3 rounded-2xl border-2 transition-all cursor-default ${
                          opt.is_correct 
                          ? "bg-emerald-50 border-emerald-500 shadow-sm" 
                          : "bg-white border-gray-100 hover:border-blue-200 focus-within:border-blue-500"
                        }`}
                      >
                        <button
                          onClick={() => {
                            const newOpts = editForm.options.map((o: any, i: number) => ({
                              ...o,
                              is_correct: i === optIdx
                            }));
                            setEditForm({ ...editForm, options: newOpts });
                          }}
                          className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-xl font-black text-lg transition-all transform active:scale-90 ${
                            opt.is_correct 
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200 rotate-3" 
                            : "bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600"
                          }`}
                        >
                          {opt.option_label}
                        </button>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={opt.option_text}
                            onChange={(e) => {
                              const newOpts = [...editForm.options];
                              newOpts[optIdx].option_text = e.target.value;
                              setEditForm({ ...editForm, options: newOpts });
                            }}
                            className="w-full bg-transparent border-none outline-none font-bold text-gray-700 placeholder:text-gray-300 placeholder:font-medium"
                            placeholder={`Nội dung đáp án ${opt.option_label}...`}
                          />
                        </div>
                        {opt.is_correct && <CheckCircle className="text-emerald-600 mr-2 animate-in zoom-in duration-300" size={20} />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metadata Section */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <label className="flex items-center gap-2 text-xs font-black text-indigo-400 uppercase tracking-widest mb-2 px-1">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> Phân loại Bloom
                    </label>
                    <div className="relative">
                      <select
                        value={editForm.bloom_level}
                        onChange={(e) => setEditForm({ ...editForm, bloom_level: e.target.value })}
                        className="w-full bg-white border-2 border-white rounded-xl p-3 outline-none focus:border-indigo-500 shadow-sm transition-all text-sm font-black text-indigo-700 appearance-none cursor-pointer"
                      >
                        <option value="">Chưa phân loại</option>
                        <option value="Nhớ">NHỚ (Remember)</option>
                        <option value="Hiểu">HIỂU (Understand)</option>
                        <option value="Vận dụng">VẬN DỤNG (Apply)</option>
                        <option value="Phân tích">PHÂN TÍCH (Analyze)</option>
                        <option value="Đánh giá">ĐÁNH GIÁ (Evaluate)</option>
                        <option value="Sáng tạo">SÁNG TẠO (Create)</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-300">
                        <Plus size={16} className="rotate-45" />
                      </div>
                    </div>
                  </div>
                  <div className="flex-[2]">
                    <label className="flex items-center gap-2 text-xs font-black text-blue-400 uppercase tracking-widest mb-2 px-1">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> Giải thích chi tiết
                    </label>
                    <textarea
                      value={editForm.explanation}
                      onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                      className="w-full bg-white border-2 border-white rounded-xl p-3 outline-none focus:border-blue-500 shadow-sm transition-all text-sm font-medium text-gray-700 min-h-[60px]"
                      placeholder="Giải thích lý do tại sao đáp án này đúng để học sinh dễ hiểu hơn..."
                    />
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-6 mt-4 border-t border-gray-100">
                  <button
                    onClick={() => { setEditingId(null); setEditForm(null); }}
                    className="px-6 py-3 text-gray-400 hover:text-gray-600 font-bold text-sm transition-colors flex items-center gap-2 underline-offset-4 hover:underline"
                  >
                    Hủy bỏ và quay lại
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl shadow-blue-200 hover:shadow-blue-300 transform hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} CẬP NHẬT CÂU HỎI
                    </button>
                  </div>
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

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-5 pr-20">
              <h3 className="font-bold text-lg text-gray-800 leading-relaxed m-0">Câu {index + 1}: {q.question_text}</h3>
              <span className={`shrink-0 inline-flex items-center px-2.5 py-1 text-xs font-black rounded-lg uppercase tracking-wider border shadow-sm ${parseExplanation(q.explanation, q.difficulty).diff ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-gray-50 text-gray-400 border-gray-200 italic"}`}>
                {parseExplanation(q.explanation, q.difficulty).diff || "Chưa phân loại"}
              </span>
            </div>

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
                <p className="text-sm text-blue-900/80 leading-relaxed">{parseExplanation(q.explanation).text}</p>
              </div>
            )}
          </div>
        );
      })}

      {editingId === "new" && (
        <div className="bg-white p-8 rounded-3xl shadow-2xl border-2 border-green-500/20 relative animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                <Plus size={24} />
              </div>
              <div>
                <h3 className="font-black text-xl text-gray-900 leading-none">Thêm câu hỏi mới</h3>
                <p className="text-sm text-gray-500 mt-1 font-medium">Nhập thủ công câu hỏi cho bộ đề này</p>
              </div>
            </div>
            <button 
              onClick={() => { setEditingId(null); setEditForm(null); }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-8">
            {/* Question Section */}
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Nội dung câu hỏi chính</label>
              <textarea
                value={editForm.question_text}
                onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 outline-none focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-50 transition-all font-bold text-lg text-gray-800 min-h-[120px] shadow-inner"
                placeholder="Ví dụ: Ai là người phát minh hành bóng đèn dây tóc?"
              />
            </div>

            {/* Options Grid */}
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">Các lựa chọn đáp án (Chọn 1 đáp án đúng)</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editForm.options.map((opt: any, optIdx: number) => (
                  <div 
                    key={optIdx} 
                    className={`group flex items-center gap-3 p-3 rounded-2xl border-2 transition-all cursor-default ${
                      opt.is_correct 
                      ? "bg-emerald-50 border-emerald-500 shadow-sm" 
                      : "bg-white border-gray-100 hover:border-blue-200 focus-within:border-blue-500"
                    }`}
                  >
                    <button
                      onClick={() => {
                        const newOpts = editForm.options.map((o: any, i: number) => ({
                          ...o,
                          is_correct: i === optIdx
                        }));
                        setEditForm({ ...editForm, options: newOpts });
                      }}
                      className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-xl font-black text-lg transition-all transform active:scale-90 ${
                        opt.is_correct 
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200 rotate-3" 
                        : "bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600"
                      }`}
                    >
                      {opt.option_label}
                    </button>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={opt.option_text}
                        onChange={(e) => {
                          const newOpts = [...editForm.options];
                          newOpts[optIdx].option_text = e.target.value;
                          setEditForm({ ...editForm, options: newOpts });
                        }}
                        className="w-full bg-transparent border-none outline-none font-bold text-gray-700 placeholder:text-gray-300 placeholder:font-medium"
                        placeholder={`Nội dung đáp án ${opt.option_label}...`}
                      />
                    </div>
                    {opt.is_correct && <CheckCircle className="text-emerald-600 mr-2 animate-in zoom-in duration-300" size={20} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Metadata Section */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <label className="flex items-center gap-2 text-xs font-black text-indigo-400 uppercase tracking-widest mb-2 px-1">
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> Phân loại Bloom
                </label>
                <div className="relative">
                  <select
                    value={editForm.bloom_level}
                    onChange={(e) => setEditForm({ ...editForm, bloom_level: e.target.value })}
                    className="w-full bg-white border-2 border-white rounded-xl p-3 outline-none focus:border-indigo-500 shadow-sm transition-all text-sm font-black text-indigo-700 appearance-none cursor-pointer"
                  >
                    <option value="">Chưa phân loại</option>
                    <option value="Nhớ">NHỚ (Remember)</option>
                    <option value="Hiểu">HIỂU (Understand)</option>
                    <option value="Vận dụng">VẬN DỤNG (Apply)</option>
                    <option value="Phân tích">PHÂN TÍCH (Analyze)</option>
                    <option value="Đánh giá">ĐÁNH GIÁ (Evaluate)</option>
                    <option value="Sáng tạo">SÁNG TẠO (Create)</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-300">
                    <Plus size={16} className="rotate-45" />
                  </div>
                </div>
              </div>
              <div className="flex-[2]">
                <label className="flex items-center gap-2 text-xs font-black text-blue-400 uppercase tracking-widest mb-2 px-1">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> Giải thích chi tiết
                </label>
                <textarea
                  value={editForm.explanation}
                  onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                  className="w-full bg-white border-2 border-white rounded-xl p-3 outline-none focus:border-blue-500 shadow-sm transition-all text-sm font-medium text-gray-700 min-h-[60px]"
                  placeholder="Giải thích lý do..."
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-6 mt-4 border-t border-gray-100">
              <button
                onClick={() => { setEditingId(null); setEditForm(null); }}
                className="px-6 py-3 text-gray-400 hover:text-gray-600 font-bold text-sm transition-colors flex items-center gap-2 underline-offset-4 hover:underline"
              >
                Hủy bỏ
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-8 py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl shadow-green-200 hover:shadow-green-300 transform hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} THÊM CÂU HỎI MỚI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {hiddenQuestions.length > 0 && (
        <div className="mt-16 pt-12 border-t-2 border-dashed border-gray-100 space-y-8">
          <div className="flex items-center gap-3 px-5 py-3 bg-amber-50 rounded-2xl border border-amber-100 w-fit">
            <ShieldAlert className="text-amber-600" size={24} />
            <div>
              <h3 className="text-lg font-black text-amber-900 leading-none">Câu hỏi bị ẩn ({hiddenQuestions.length})</h3>
              <p className="text-xs text-amber-600 mt-1 font-bold uppercase tracking-tight">Đang chờ AI học lại hoặc Admin chỉnh sửa</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 opacity-40 grayscale-[0.5] pointer-events-none select-none">
            {hiddenQuestions.map((q: any) => {
              const sortedOptions = [...(q.question_options || [])].sort((a: any, b: any) => a.option_label.localeCompare(b.option_label));
              return (
                <div key={q.id} className="bg-white p-6 rounded-xl border-2 border-gray-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 bg-amber-100 text-amber-700 font-black text-[10px] uppercase tracking-widest rounded-bl-xl flex items-center gap-1.5 border-b border-l border-amber-200">
                    {q.moderation_status === 'flagged' ? <Flag size={12} /> : <ShieldAlert size={12} />}
                    {q.moderation_status === 'flagged' ? "Chất lượng kém" : "Lỗi nội dung"}
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
                       {q.moderation_status === 'flagged' ? "🚩" : "⚠️"} Lý do ẩn: 
                       <span className="font-medium italic">
                          {q.moderation_status === 'flagged' 
                            ? "AI tạo nội dung chưa rõ nghĩa hoặc quá đơn giản." 
                            : "Phát hiện sai sót về kiến thức thực tế hoặc lỗi định dạng."}
                       </span>
                    </p>
                    <h4 className="font-bold text-gray-400 italic leading-relaxed">Câu hỏi: {q.question_text}</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {sortedOptions.map((opt: any) => (
                      <div key={opt.id} className="p-2 border border-gray-100 rounded text-xs text-gray-300 font-medium">
                        {opt.option_label}. {opt.option_text}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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

      <ConfirmModal 
        isOpen={!!questionToDelete}
        onClose={() => setQuestionToDelete(null)}
        onConfirm={executeDeleteQuestion}
        title="Xóa câu hỏi?"
        message="Bạn có chắc chắn muốn xóa câu hỏi này khỏi bộ đề? Hành động này không thể hoàn tác."
        confirmText="Xác nhận xóa"
        cancelText="Để mình xem lại"
        isDestructive={true}
      />
    </div>
  );
}
