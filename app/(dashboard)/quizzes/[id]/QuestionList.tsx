"use client";

import { useState } from "react";
import { Edit3, CheckCircle, ListChecks, Plus, Trash2, X, Save, Loader2, AlertTriangle, Flag, ShieldAlert } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";

const normalizeBloomLevel = (level?: string | null) => {
  if (!level) return null;
  const clean = level.trim().toLowerCase();
  if (clean === "nhớ" || clean === "remember") return "Nhớ";
  if (clean === "hiểu" || clean === "understand") return "Hiểu";
  if (clean === "vận dụng" || clean === "apply") return "Vận dụng";
  if (clean === "phân tích" || clean === "analyze") return "Phân tích";
  if (clean === "đánh giá" || clean === "evaluate") return "Đánh giá";
  if (clean === "sáng tạo" || clean === "create") return "Sáng tạo";
  return null;
};

const getTypeBadge = (qType: string) => {
  const badges: Record<string, { text: string; css: string }> = {
    mcq: { text: "Trắc nghiệm A/B/C/D", css: "bg-blue-50 text-blue-700 border-blue-200" },
    true_false: { text: "Yes/No (True/False)", css: "bg-green-50 text-green-700 border-green-200" },
    fill_blank: { text: "Điền vào chỗ trống", css: "bg-cyan-50 text-cyan-700 border-cyan-200" },
    short_answer: { text: "Trả lời ngắn", css: "bg-purple-50 text-purple-700 border-purple-200" },
    multi_select: { text: "Chọn nhiều đáp án đúng", css: "bg-amber-50 text-amber-700 border-amber-200" },
    matching: { text: "Ghép đôi", css: "bg-emerald-50 text-emerald-700 border-emerald-200" }
  };
  return badges[qType] || badges.mcq;
};

const renderTeacherQuestionOptions = (q: any) => {
  const qType = q.question_type || 'mcq';
  const sortedOptions = [...(q.question_options || [])].sort((a: any, b: any) => (a.option_label || '').localeCompare(b.option_label || ''));

  if (qType === 'fill_blank' || qType === 'short_answer') {
    const correctOpt = sortedOptions.find((o: any) => o.is_correct);
    return (
      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
        <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
          <CheckCircle size={16} /> Đáp án đúng:
        </p>
        <p className="text-sm font-semibold text-emerald-900 mt-1.5">{correctOpt?.option_text || 'Chưa cấu hình'}</p>
      </div>
    );
  }

  if (qType === 'matching') {
    const pairs = sortedOptions.filter((o: any) => o.option_label?.startsWith('pair_'));
    return (
      <div className="space-y-3">
        <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5 mb-2">
          <ListChecks size={16} /> Các cặp ghép đôi chính xác:
        </p>
        <div className="grid grid-cols-1 gap-3">
          {pairs.map((opt: any) => {
            let left = '';
            let right = '';
            try {
              const parsed = JSON.parse(opt.option_text);
              left = parsed.left;
              right = parsed.right;
            } catch {
              return (
                <div key={opt.id} className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 font-medium">
                  Lỗi giải mã cặp ghép: {opt.option_text}
                </div>
              );
            }
            return (
              <div key={opt.id} className="p-4 bg-emerald-50/40 border border-emerald-100/50 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-4 text-sm">
                <div className="font-extrabold text-emerald-900 bg-white px-3 py-2.5 rounded-lg border border-emerald-100 shadow-sm sm:w-[45%] shrink-0">
                  {left}
                </div>
                <div className="text-emerald-500 font-bold shrink-0 flex justify-center rotate-90 sm:rotate-0">
                  ➔
                </div>
                <div className="font-medium text-emerald-800 bg-white px-3 py-2.5 rounded-lg border border-emerald-100 shadow-sm flex-1">
                  {right}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // mcq, true_false, multi_select
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {sortedOptions?.map((opt: any) => (
        <div key={opt.id} className={`p-3 rounded-lg border flex items-start gap-2 ${opt.is_correct ? 'bg-green-50 border-green-200 text-green-900 font-medium shadow-sm' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
          <span className="font-bold flex-shrink-0">{opt.option_label}.</span>
          <span>{opt.option_text}</span>
          {opt.is_correct && <CheckCircle className="ml-auto flex-shrink-0 text-green-500" size={18} />}
        </div>
      ))}
    </div>
  );
};

const detectRealType = (q: any): string => {
  const currentType = q.question_type || 'mcq';
  const sortedOptions = q.question_options || [];

  // 1. Kiểm tra matching: Có bất kỳ option_label nào bắt đầu bằng 'pair_'
  const hasMatchingPairs = sortedOptions.some((o: any) => o.option_label?.startsWith('pair_'));
  if (hasMatchingPairs) return 'matching';

  // 2. Kiểm tra true_false: Có đúng 2 đáp án và nhãn/nội dung chứa Đúng/Sai (True/False)
  if (sortedOptions.length === 2) {
    const hasTrueFalseLabel = sortedOptions.some((o: any) => {
      const text = (o.option_text || '').toLowerCase();
      return text === 'đúng' || text === 'sai' || text === 'true' || text === 'false';
    });
    if (hasTrueFalseLabel) return 'true_false';
  }

  // 3. Kiểm tra multi_select: Có nhiều hơn 1 đáp án được đánh dấu is_correct
  const correctCount = sortedOptions.filter((o: any) => o.is_correct).length;
  if (correctCount > 1) return 'multi_select';

  // 4. Kiểm tra fill_blank: Câu hỏi chứa ký tự điền trống ___
  if (q.question_text?.includes('___')) return 'fill_blank';

  // 5. Nếu cơ sở dữ liệu đã phân loại rõ ràng (ví dụ: short_answer) thì giữ nguyên
  if (currentType === 'short_answer') return 'short_answer';
  if (currentType === 'fill_blank') return 'fill_blank';

  return currentType;
};

export default function QuestionList({ initialQuestions, quizId, canEdit = true }: { initialQuestions: any[], quizId: string, canEdit?: boolean }) {
  const [questions, setQuestions] = useState(() => {
    return (initialQuestions || []).map(q => ({
      ...q,
      question_type: detectRealType(q)
    }));
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const typeLabels: Record<string, string> = {
    mcq: "Trắc nghiệm A/B/C/D",
    true_false: "Yes/No (True/False)",
    fill_blank: "Điền vào chỗ trống",
    short_answer: "Trả lời ngắn",
    multi_select: "Chọn nhiều đáp án đúng",
    matching: "Ghép đôi"
  };

  const supabase = createClient();
  const router = useRouter();

  const parseExplanation = (text?: string, dbDiff?: string) => {
    if (!text) return { diff: normalizeBloomLevel(dbDiff), text: '' };
    const tagMatch = text.match(/^\[MỨC ĐỘ:\s*(.*?)\]\s*(.*)/is);
    if (tagMatch) return { diff: normalizeBloomLevel(tagMatch[1]), text: tagMatch[2] };
    const aiMatch = text.match(/^(?:Đây là )?(?:câu hỏi )?(?:ở )?(?:mức độ|cấp độ)\s+([^.]*?)\.\s*(.*)/is);
    if (aiMatch) return { diff: normalizeBloomLevel(aiMatch[1]), text: aiMatch[2] };
    return { diff: normalizeBloomLevel(dbDiff), text };
  };

  const handleEdit = (q: any) => {
    const qType = q.question_type || 'mcq';
    let options = [...(q.question_options || [])].sort((a: any, b: any) => (a.option_label || '').localeCompare(b.option_label || ''));

    // Bỏ cái chặn ép về A, B, C, D. Cứ giữ nguyên mảng options từ DB, 
    // TRỪ KHI là mcq mà ko có options thì mới khởi tạo mặc định.
    if (options.length === 0 && qType === 'mcq') {
      options = ['A', 'B', 'C', 'D'].map(label => ({ option_label: label, option_text: "", is_correct: false }));
    } else if (options.length === 0 && qType === 'true_false') {
      options = [
        { option_label: "A", option_text: "Đúng", is_correct: true },
        { option_label: "B", option_text: "Sai", is_correct: false }
      ];
    } else if (options.length === 0 && (qType === 'fill_blank' || qType === 'short_answer')) {
      options = [{ option_label: "A", option_text: "", is_correct: true }];
    } else if (options.length === 0 && qType === 'matching') {
      options = [
        { option_label: "pair_1", option_text: JSON.stringify({left: "", right: ""}), is_correct: true },
        { option_label: "pair_2", option_text: JSON.stringify({left: "", right: ""}), is_correct: true }
      ];
    }

    const parsed = parseExplanation(q.explanation || "", q.difficulty);
    setEditForm({
      id: q.id,
      question_type: qType,
      question_text: q.question_text || "",
      explanation: parsed.text || "",
      bloom_level: parsed.diff || "",
      image_url: q.image_url || null,
      options,
    });
    setEditingId(q.id);
  };

  const handleAdd = () => {
    setEditForm({
      id: "new",
      question_type: "mcq",
      question_text: "",
      explanation: "",
      bloom_level: "",
      image_url: null,
      options: [
        { option_label: "A", option_text: "", is_correct: true },
        { option_label: "B", option_text: "", is_correct: false },
        { option_label: "C", option_text: "", is_correct: false },
        { option_label: "D", option_text: "", is_correct: false },
      ],
    });
    setEditingId("new");
  };


  const renderEditFormInner = (editForm: any, setEditForm: any) => {
    const qType = editForm.question_type || 'mcq';

    return (
      <div className="space-y-8">
        {/* Question Type and Question Text */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Nội dung câu hỏi chính</label>
            <textarea
              value={editForm.question_text}
              onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all font-bold text-lg text-gray-800 min-h-[120px] shadow-inner"
              placeholder="Ví dụ: Thủ đô của Việt Nam là gì?"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Loại câu hỏi</label>
            <div className="relative">
              <select 
                value={qType} 
                onChange={(e) => {
                  const newType = e.target.value;
                  let newOpts = editForm.options;
                  if (newType === 'true_false') {
                    newOpts = [{option_label: "A", option_text: "Đúng", is_correct: true}, {option_label: "B", option_text: "Sai", is_correct: false}];
                  } else if (newType === 'fill_blank' || newType === 'short_answer') {
                    newOpts = [{option_label: "A", option_text: "", is_correct: true}];
                  } else if (newType === 'matching') {
                    newOpts = [{option_label: "pair_1", option_text: JSON.stringify({left:"",right:""}), is_correct: true}, {option_label: "pair_2", option_text: JSON.stringify({left:"",right:""}), is_correct: true}];
                  } else if (newType === 'mcq' || newType === 'multi_select') {
                    newOpts = [
                      {option_label: "A", option_text: "", is_correct: true},
                      {option_label: "B", option_text: "", is_correct: false},
                      {option_label: "C", option_text: "", is_correct: false},
                      {option_label: "D", option_text: "", is_correct: false},
                    ];
                  }
                  setEditForm({...editForm, question_type: newType, options: newOpts});
                }} 
                className="w-full bg-white border-2 border-gray-100 rounded-2xl p-4 outline-none focus:border-blue-500 font-bold text-gray-700 shadow-sm appearance-none cursor-pointer"
              >
                <option value="mcq">Trắc nghiệm A/B/C/D</option>
                <option value="multi_select">Chọn nhiều đáp án</option>
                <option value="true_false">Yes/No (Đúng/Sai)</option>
                <option value="fill_blank">Điền vào chỗ trống</option>
                <option value="short_answer">Trả lời ngắn</option>
                <option value="matching">Ghép đôi</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <Plus size={18} className="rotate-45" />
              </div>
            </div>
          </div>
        </div>

        
        {/* Image Attachment */}
        <div className="mt-6">
          <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">
             Hình ảnh/Dẫn chứng đính kèm
          </label>
          {editForm.image_url ? (
            <div className="relative inline-block border-2 border-gray-200 rounded-xl overflow-hidden group">
              <img src={editForm.image_url} alt="Dẫn chứng" className="max-w-xs max-h-48 object-contain bg-gray-50" />
              <button 
                onClick={() => setEditForm({...editForm, image_url: null})}
                className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                title="Xoá ảnh"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input 
                type="file" 
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    alert("Kích thước file vượt quá 5MB!");
                    return;
                  }
                  setIsSaving(true);
                  try {
                    const { data: user } = await supabase.auth.getUser();
                    if (!user.user) throw new Error("Vui lòng đăng nhập");
                    
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${user.user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                    
                    const { error: uploadError } = await supabase.storage
                      .from('question_images')
                      .upload(fileName, file);
                      
                    if (uploadError) throw uploadError;
                    
                    const { data } = supabase.storage
                      .from('question_images')
                      .getPublicUrl(fileName);
                      
                    setEditForm({...editForm, image_url: data.publicUrl});
                  } catch (err: any) {
                    console.error(err);
                    alert("Lỗi khi tải ảnh lên: " + err.message);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2.5 file:px-4
                  file:rounded-xl file:border-0
                  file:text-sm file:font-bold
                  file:bg-indigo-50 file:text-indigo-700
                  hover:file:bg-indigo-100 cursor-pointer
                  border-2 border-dashed border-gray-200 rounded-2xl p-4 bg-gray-50/50 transition-all"
              />
            </div>
          )}
        </div>

        {/* Options */}
        <div>
          {qType === 'true_false' && (
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">Chọn đáp án đúng (True/False)</label>
              <div className="grid grid-cols-2 gap-4">
                {editForm.options.map((opt: any, optIdx: number) => (
                  <div key={optIdx} onClick={() => {
                    const newOpts = editForm.options.map((o: any, i: number) => ({...o, is_correct: i === optIdx}));
                    setEditForm({...editForm, options: newOpts});
                  }} className={`cursor-pointer group flex items-center justify-center p-6 rounded-2xl border-2 transition-all ${opt.is_correct ? 'bg-emerald-50 border-emerald-500 shadow-md scale-[1.02]' : 'bg-gray-50 border-gray-100 hover:border-emerald-200'}`}>
                    <span className={`font-black text-2xl ${opt.is_correct ? 'text-emerald-700' : 'text-gray-400 group-hover:text-emerald-500'}`}>{opt.option_text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(qType === 'fill_blank' || qType === 'short_answer') && (
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">Đáp án đúng</label>
              <input 
                type="text" 
                value={editForm.options[0]?.option_text || ''} 
                onChange={(e) => {
                  setEditForm({...editForm, options: [{option_label: 'A', option_text: e.target.value, is_correct: true}]})
                }} 
                className="w-full bg-white border-2 border-emerald-200 focus:border-emerald-500 rounded-2xl p-4 outline-none transition-all font-bold text-lg text-gray-800 shadow-inner" 
                placeholder="Nhập đáp án chính xác..." 
              />
            </div>
          )}

          {qType === 'matching' && (
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">Các cặp ghép đôi</label>
              <div className="space-y-3">
                {editForm.options.map((opt: any, optIdx: number) => {
                  let left = '', right = '';
                  try {
                    const parsed = JSON.parse(opt.option_text);
                    left = parsed.left; right = parsed.right;
                  } catch(e) {}
                  return (
                    <div key={optIdx} className="flex flex-col sm:flex-row items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                      <input type="text" value={left} onChange={(e) => {
                        const newOpts = [...editForm.options];
                        newOpts[optIdx] = { ...newOpts[optIdx], option_text: JSON.stringify({ left: e.target.value, right }) };
                        setEditForm({ ...editForm, options: newOpts });
                      }} placeholder="Vế trái" className="flex-1 w-full p-3 border-2 border-gray-200 focus:border-blue-400 rounded-xl outline-none font-bold" />
                      <span className="hidden sm:block text-gray-400">➔</span>
                      <input type="text" value={right} onChange={(e) => {
                        const newOpts = [...editForm.options];
                        newOpts[optIdx] = { ...newOpts[optIdx], option_text: JSON.stringify({ left, right: e.target.value }) };
                        setEditForm({ ...editForm, options: newOpts });
                      }} placeholder="Vế phải (đáp án ghép đúng)" className="flex-1 w-full p-3 border-2 border-gray-200 focus:border-emerald-400 rounded-xl outline-none font-bold text-emerald-700" />
                      <button onClick={() => {
                        const newOpts = editForm.options.filter((_: any, i: number) => i !== optIdx);
                        setEditForm({ ...editForm, options: newOpts });
                      }} className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={20}/></button>
                    </div>
                  )
                })}
                <button onClick={() => {
                  const newOpts = [...editForm.options, { option_label: `pair_${editForm.options.length + 1}`, option_text: JSON.stringify({left: "", right: ""}), is_correct: true }];
                  setEditForm({ ...editForm, options: newOpts });
                }} className="px-4 py-2 mt-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-2 transition-colors">
                  <Plus size={16}/> Thêm cặp mới
                </button>
              </div>
            </div>
          )}

          {(qType === 'mcq' || qType === 'multi_select') && (
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">Các lựa chọn đáp án ({qType === 'multi_select' ? 'Chọn nhiều' : 'Chọn 1 đáp án đúng'})</label>
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
                        const newOpts = editForm.options.map((o: any, i: number) => {
                          if (qType === 'mcq') {
                            return { ...o, is_correct: i === optIdx };
                          } else {
                            if (i === optIdx) return { ...o, is_correct: !o.is_correct };
                            return o;
                          }
                        });
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
                    <div className="flex-1 flex items-center">
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
                      <button onClick={() => {
                          const newOpts = editForm.options.filter((_: any, i: number) => i !== optIdx);
                          setEditForm({ ...editForm, options: newOpts });
                        }} 
                        className="opacity-0 group-hover:opacity-100 p-2 text-red-300 hover:text-red-500 transition-all ml-1"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                    {opt.is_correct && <CheckCircle className="text-emerald-600 mr-2 animate-in zoom-in duration-300 shrink-0" size={20} />}
                  </div>
                ))}
              </div>
              <button onClick={() => {
                const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                const nextLabel = labels[editForm.options.length] || `Opt${editForm.options.length}`;
                setEditForm({...editForm, options: [...editForm.options, {option_label: nextLabel, option_text: "", is_correct: false}]});
              }} className="px-4 py-2 mt-4 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-2 transition-colors">
                <Plus size={16}/> Thêm lựa chọn
              </button>
            </div>
          )}
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
      </div>
    );
  };

          const handleSave = async () => {
    if (!editForm.question_text.trim()) {
      alert("Vui lòng nhập nội dung câu hỏi!");
      return;
    }

    if (editForm.question_type === 'fill_blank' || editForm.question_type === 'short_answer') {
       if (!editForm.options[0]?.option_text.trim()) {
         alert("Vui lòng nhập đáp án đúng!");
         return;
       }
    } else if (editForm.question_type === 'matching') {
       if (editForm.options.length < 2) {
         alert("Vui lòng thêm ít nhất 2 cặp ghép đôi!");
         return;
       }
       for (const opt of editForm.options) {
         try {
           const parsed = JSON.parse(opt.option_text);
           if (!parsed.left.trim() || !parsed.right.trim()) {
             alert("Vui lòng điền đầy đủ nội dung các vế ghép đôi!");
             return;
           }
         } catch(e) {}
       }
    } else {
      const hasCorrect = editForm.options.some((o: any) => o.is_correct);
      if (!hasCorrect) {
        alert("Vui lòng chọn ít nhất 1 đáp án đúng!");
        return;
      }
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
            difficulty: editForm.bloom_level || null,
            question_type: editForm.question_type || "mcq",
            image_url: editForm.image_url || null,
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
            difficulty: editForm.bloom_level || null,
            question_type: editForm.question_type || "mcq",
            image_url: editForm.image_url || null,
          })
          .eq("id", editForm.id);

        if (qErr) throw qErr;

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
            ? { ...q, question_text: editForm.question_text, explanation: fullExplanation, difficulty: editForm.bloom_level || null, question_type: editForm.question_type || "mcq", image_url: editForm.image_url || null, question_options: optsData }
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
  const uniqueTypes = Array.from(new Set(questions.map((q: any) => q.question_type || 'mcq')));

  const activeQuestions = questions.filter(q => !['flagged', 'error'].includes(q.moderation_status));
  const hiddenQuestions = questions.filter(q => ['flagged', 'error'].includes(q.moderation_status));

  return (
    <div className="space-y-6">
      {questions.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          {/* Bloom Filter Row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest mr-2 w-28 shrink-0">BỘ LỌC BLOOM:</span>
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all uppercase tracking-wider ${filter === "all" ? "bg-indigo-600 text-white shadow-md scale-105" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"}`}
            >
              TẤT CẢ
            </button>
            {uniqueDifficulties.map((diff: any) => (
              <button
                key={diff}
                onClick={() => setFilter(diff.toLowerCase())}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all uppercase tracking-wider ${filter === diff.toLowerCase() ? "bg-indigo-600 text-white shadow-md scale-105" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"}`}
              >
                {diff.toUpperCase()}
              </button>
            ))}
            {questions.some((q: any) => !parseExplanation(q.explanation).diff) && (
              <button
                onClick={() => setFilter("none")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all uppercase tracking-wider ${filter === "none" ? "bg-gray-600 text-white shadow-md scale-105" : "bg-white text-gray-400 border border-gray-200 hover:bg-gray-100"}`}
              >
                CHƯA PHÂN LOẠI
              </button>
            )}
          </div>

          <div className="h-[1px] bg-gray-100" />

          {/* Question Type Filter Row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest mr-2 w-28 shrink-0">LOẠI CÂU HỎI:</span>
            <button
              onClick={() => setTypeFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all uppercase tracking-wider ${typeFilter === "all" ? "bg-blue-600 text-white shadow-md scale-105" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"}`}
            >
              TẤT CẢ LOẠI
            </button>
            {uniqueTypes.map((type: any) => {
              const label = typeLabels[type] || type;
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all uppercase tracking-wider ${typeFilter === type ? "bg-blue-600 text-white shadow-md scale-105" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"}`}
                >
                  {label.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeQuestions.map((q: any, index: number) => {
        const qDiff = parseExplanation(q.explanation, q.difficulty).diff?.toLowerCase() || "none";
        const qType = q.question_type || "mcq";

        if (filter !== "all" && qDiff !== filter) return null;
        if (typeFilter !== "all" && qType !== typeFilter) return null;

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
                {renderEditFormInner(editForm, setEditForm)}

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
            {/* Nút sửa/xóa: chỉ hiện cho teacher/admin */}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              {canEdit && (
                <>
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
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5 pr-20">
              <h3 className="font-bold text-lg text-gray-800 leading-relaxed m-0">Câu {index + 1}: {q.question_text}</h3>
              <div className="flex flex-wrap gap-2 shrink-0">
                <span className={`inline-flex items-center px-2.5 py-1 text-xs font-black rounded-lg uppercase tracking-wider border shadow-sm ${parseExplanation(q.explanation, q.difficulty).diff ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-gray-50 text-gray-400 border-gray-200 italic"}`}>
                  {parseExplanation(q.explanation, q.difficulty).diff || "Chưa phân loại"}
                </span>
                <span className={`inline-flex items-center px-2.5 py-1 text-xs font-black rounded-lg uppercase tracking-wider border shadow-sm ${getTypeBadge(q.question_type || 'mcq').css}`}>
                  {getTypeBadge(q.question_type || 'mcq').text}
                </span>
              </div>
            </div>

            
            {q.image_url && (
              <div className="mb-5 bg-gray-50/80 p-4 rounded-xl border border-gray-100/80 inline-block">
                <img src={q.image_url} alt="Dẫn chứng" className="max-w-full max-h-[500px] object-contain rounded-lg shadow-sm" />
              </div>
            )}

            <div className="mb-5">
              {renderTeacherQuestionOptions(q)}
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
            {renderEditFormInner(editForm, setEditForm)}

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

      {/* Nút thêm câu hỏi: chỉ teacher/admin */}
      {canEdit && editingId !== "new" && (
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
