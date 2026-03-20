'use client';

import { useState, useEffect } from 'react';
import { Upload, Loader2, BookOpen, PenTool, CheckCircle, XCircle, RefreshCw, Clock, History, PlusCircle, PanelLeftClose, Menu, Edit2, Trash2, Download, Check, X } from 'lucide-react';

// Định nghĩa kiểu dữ liệu
interface Quiz {
  question: string;
  options: string[];
  answer: string | string[]; // Hỗ trợ mảng cho nhiều đáp án
  bloom_level: string;
  explanation: string;
}

interface HistoryItem {
  id: string;
  title: string;
  time: string;
  quizzes: Quiz[];
}

// Thêm helper function đưa đáp án về dạng mảng chuẩn
const getAnswersArray = (answer: string | string[]): string[] => {
  if (Array.isArray(answer)) return answer;
  if (!answer) return [];

  if (typeof answer === 'string') {
    let str = answer.trim();
    // Nếu JSON bị escape thành chuỗi: "[\"A\", \"B\"]"
    if (str.startsWith('[') && str.endsWith(']')) {
      try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) return parsed.map(s => String(s).trim());
        // eslint-disable-next-line no-empty
      } catch (e) { }
    }
    // Nếu có các dấu hiệu phân cách
    if (/,|;| và | and |&/.test(str)) {
      return str.split(/,|;| và | and |&/).map(s => s.trim()).filter(Boolean);
    }
    return [str];
  }

  return [String(answer)];
};

// Hàm Helper kiểm tra 1 tuỳ chọn có đúng so với 1 đáp án hay không
const checkAnswerCorrect = (selected?: string, expected?: string) => {
  if (!selected || !expected) return false;
  const s = selected.trim();
  const e = expected.trim();

  // So sánh chính xác hoàn toàn
  if (s === e || s.toLowerCase() === e.toLowerCase()) return true;

  // Xử lý trường hợp AI trả về dạng chữ cái đơn giản "A", "B", "C", "D"
  const eClean = e.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (eClean.length === 1 && /^[A-E]$/.test(eClean)) {
    // Nếu tuỳ chọn từ UI có dạng "A. xxx", "A) xxx"
    if (
      s.toUpperCase().startsWith(eClean + ".") ||
      s.toUpperCase().startsWith(eClean + ")") ||
      s.toUpperCase().startsWith(eClean + ":") ||
      s.toUpperCase().startsWith(eClean + " ")
    ) {
      return true;
    }
    // Tránh bị nhầm chuỗi chứa chữ cái đó (vd: "Con" chứa "C")
    return false;
  }

  // Loại bỏ prefix "A. ", "B. " để so sánh nội dung cốt lõi
  const sText = s.replace(/^[A-E][.\:)]\s*/i, "").trim().toLowerCase();
  const eText = e.replace(/^[A-E][.\:)]\s*/i, "").trim().toLowerCase();

  if (sText && eText && sText === eText) return true;

  // Chỉ dùng includes khi chuỗi đủ dài để tránh bắt nhầm từ vựng ngắn
  if (sText.length > 5 && eText.length > 5) {
    if (sText.includes(eText) || eText.includes(sText)) return true;
  }

  return false;
};

export default function Home() {
  // --- STATE QUẢN LÝ DỮ LIỆU ---
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isClosingEdit, setIsClosingEdit] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);

  // --- STATE QUẢN LÝ GIAO DIỆN (MODE) ---
  // 'upload': Màn hình chọn file
  // 'selection': Màn hình chọn "Xem ngay" hoặc "Thi thử"
  // 'review': Chế độ xem đáp án ngay
  // 'exam': Chế độ thi thử
  const [mode, setMode] = useState<'upload' | 'selection' | 'review' | 'exam'>('upload');

  // --- STATE CHO CHẾ ĐỘ THI THỬ ---
  const [userAnswers, setUserAnswers] = useState<Record<number, string[]>>({}); // Lưu mảng đáp án người dùng chọn
  const [isSubmitted, setIsSubmitted] = useState(false); // Đã nộp bài chưa
  const [score, setScore] = useState(0); // Điểm số

  const [isDragging, setIsDragging] = useState(false);
  const [isRetaking, setIsRetaking] = useState(false); // Trạng thái màn hình loading thi lại

  useEffect(() => {
    const handleWindowDragEnter = (e: DragEvent) => {
      // Chỉ hiện overlay khi kéo file, không hiện khi kéo chữ hay element khác
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        setIsDragging(true);
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault(); // Cần thiết để cho phép drop
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragover', handleWindowDragOver);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragover', handleWindowDragOver);
    };
  }, []);

  // 1. Xử lý Upload file (Click chọn)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleGenerate = async () => {
    if (!file) return;
    setLoading(true);
    setQuizzes([]);
    setUserAnswers({});
    setIsSubmitted(false);
    setScore(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/generate', { method: 'POST', body: formData });
      const data = await res.json();

      // Nếu API trả về nguồn dự phòng (Gemini) hoặc chính (OpenAI)
      const quizList = data.quizzes || data.source?.quizzes || [];
      const generatedTitle = data.title || data.source?.title || file?.name || "Đề thi không tên";

      if (quizList.length > 0) {
        setQuizzes(quizList);
        setMode('selection'); // Chuyển sang màn hình chọn chế độ

        // Lưu vào lịch sử
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          title: generatedTitle,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
          quizzes: quizList
        };
        setHistory(prev => [newItem, ...prev]);
        setActiveHistoryId(newItem.id);
      } else {
        alert("Không tạo được câu hỏi. Vui lòng thử lại.");
      }
    } catch (error) {
      console.error("Lỗi:", error);
      alert("Có lỗi xảy ra khi kết nối server.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Xử lý chọn đáp án khi thi
  const handleSelectAnswer = (questionIndex: number, option: string) => {
    if (isSubmitted) return; // Đã nộp bài thì không được chọn lại

    setUserAnswers(prev => {
      const currentSelection = prev[questionIndex] || [];
      const expectedArray = getAnswersArray(quizzes[questionIndex].answer);
      const isMultiple = expectedArray.length > 1;

      if (isMultiple) {
        // Nếu là phần thi nhiều đáp án thì cho phép toggle item
        if (currentSelection.includes(option)) {
          return { ...prev, [questionIndex]: currentSelection.filter(opt => opt !== option) };
        } else {
          return { ...prev, [questionIndex]: [...currentSelection, option] };
        }
      } else {
        // Còn nguyên bản thì chỉ chọn 1
        return { ...prev, [questionIndex]: [option] };
      }
    });
  };

  // 3. Xử lý Nộp bài & Chấm điểm
  const handleSubmitExam = () => {
    let currentScore = 0;
    quizzes.forEach((quiz, index) => {
      const userSelection = userAnswers[index] || [];
      const expectedArray = getAnswersArray(quiz.answer);

      // Câu hỏi chỉ đúng khi số lượng chọn bằng số lượng đúng và mọi đáp án đều match
      const isQuestionCorrect = userSelection.length === expectedArray.length &&
        expectedArray.every(exp => userSelection.some(sel => checkAnswerCorrect(sel, exp)));

      if (isQuestionCorrect) {
        currentScore++;
      }
    });
    setScore(currentScore);
    setIsSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 4. Reset về màn hình upload
  const handleReset = () => {
    setFile(null);
    setQuizzes([]);
    setMode('upload');
    setUserAnswers({});
    setIsSubmitted(false);
    setActiveHistoryId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 5. Tính năng chỉnh sửa, xóa, tải đề thi
  const closeEditMode = () => {
    setIsClosingEdit(true);
    setTimeout(() => {
      setEditingHistoryId(null);
      setIsClosingEdit(false);
    }, 200);
  };

  const handleEditTitleSave = (e: React.MouseEvent | React.FormEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (editingTitle.trim()) {
      setHistory(prev => prev.map(item => item.id === id ? { ...item, title: editingTitle.trim() } : item));
    }
    closeEditMode();
  };

  const handleDeleteHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setIsClosingModal(false);
    setDeleteConfirmId(id);
  };

  const closeDeleteModal = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setDeleteConfirmId(null);
      setIsClosingModal(false);
    }, 200);
  };

  const confirmDeleteHistory = () => {
    if (deleteConfirmId) {
      const idToRemove = deleteConfirmId;
      setDeletingIds(prev => [...prev, idToRemove]);

      closeDeleteModal();

      setTimeout(() => {
        setHistory(prev => prev.filter(item => item.id !== idToRemove));
        setDeletingIds(prev => prev.filter(id => id !== idToRemove));
        if (activeHistoryId === idToRemove) {
          handleReset();
        }
      }, 400); // Đợi CSS animation slideUpOut chạy xong
    }
  };

  const handleDownloadQuizzes = (e: React.MouseEvent, item: HistoryItem) => {
    e.stopPropagation();
    let content = `ĐỀ THI: ${item.title}\nThời gian: ${item.time}\n\n`;
    item.quizzes.forEach((q, i) => {
      content += `Câu ${i + 1}: ${q.question}\n`;
      q.options.forEach(opt => {
        content += `- ${opt}\n`;
      });
      content += `\nĐÁP ÁN: ${getAnswersArray(q.answer).join(', ')}\n`;
      content += `GIẢI THÍCH: ${q.explanation}\n`;
      if (q.bloom_level) content += `MỨC ĐỘ: ${q.bloom_level}\n`;
      content += `\n------------------------\n\n`;
    });

    // Fallback: remove non-alphanumeric chars
    const safeTitle = item.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans text-gray-800">

      {/* SIDEBAR LỊCH SỬ TẢI LÊN */}
      <aside
        className={`bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10 hidden md:flex shrink-0 transition-all duration-500 ease-in-out relative overflow-hidden ${isSidebarOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 border-r-0'
          }`}
      >
        <div className="w-80 min-w-[20rem] flex flex-col h-full relative">
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="absolute top-4 right-4 p-2 bg-white text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl transition-all hover:scale-105 hover:shadow-md z-20 shadow-sm"
            title="Thu gọn Sidebar"
          >
            <PanelLeftClose size={20} />
          </button>

          <div className="p-5 border-b border-gray-100 pr-14">
            <h1 className="text-xl font-extrabold text-blue-700 mb-6 leading-snug">AI Quiz Generator</h1>
            <button
              onClick={handleReset}
              className={`w-full py-3 mb-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-sm ${mode === 'upload'
                ? 'bg-gray-100 text-gray-400 cursor-default'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30 hover:shadow-lg transform hover:-translate-y-0.5'
                }`}
              disabled={mode === 'upload'}
            >
              <PlusCircle size={20} /> TẠO ĐỀ MỚI
            </button>

            <h2 className="font-bold text-gray-700 flex items-center gap-2 text-sm uppercase px-1">
              <History size={16} className="text-blue-500" /> Đề thi gần đây
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 ? (
              <div className="text-gray-400 text-sm text-center mt-10">Chưa có đề thi nào được tạo.</div>
            ) : (
              history.map(item => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-all cursor-pointer group relative overflow-hidden
                    ${deletingIds.includes(item.id) ? 'animate-slide-up-out pointer-events-none' : 'animate-drop-in'}
                    ${activeHistoryId === item.id
                      ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                      : 'bg-white border-gray-100 hover:border-blue-300 hover:shadow-md'
                    }`}
                  onClick={() => {
                    if (editingHistoryId === item.id) return;
                    setQuizzes(item.quizzes);
                    setFile(new File([], item.title));
                    setMode('selection');
                    setUserAnswers({});
                    setIsSubmitted(false);
                    setScore(0);
                    setActiveHistoryId(item.id);
                  }}
                >
                  {editingHistoryId === item.id ? (
                    <div className={`flex flex-col gap-2 origin-top ${isClosingEdit ? 'animate-pop-out' : 'animate-pop-in'}`}>
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="w-full text-sm p-1.5 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-800"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditTitleSave(e, item.id);
                          if (e.key === 'Escape') {
                            e.stopPropagation();
                            closeEditMode();
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <button onClick={(e) => handleEditTitleSave(e, item.id)} className="flex-1 bg-green-500 hover:bg-green-600 text-white p-1 rounded flex justify-center items-center h-7" title="Lưu">
                          <Check size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); closeEditMode(); }} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 p-1 rounded flex justify-center items-center h-7" title="Hủy">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="pr-10">
                        <p className={`font-bold text-sm line-clamp-2 transition-colors ${activeHistoryId === item.id ? 'text-blue-800' : 'text-gray-800 group-hover:text-blue-700'
                          }`} title={item.title}>{item.title}</p>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Clock size={12} /> {item.time}
                        </p>
                      </div>

                      <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTitle(item.title);
                            setIsClosingEdit(false);
                            setEditingHistoryId(item.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                          title="Sửa tên"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => handleDownloadQuizzes(e, item)}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-100 rounded-md transition-colors"
                          title="Tải về (TXT)"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteHistory(e, item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-md transition-colors"
                          title="Xóa"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="mt-2 text-xs font-semibold text-blue-600 bg-blue-50 w-max px-2 py-1 rounded-md">
                        {item.quizzes.length} câu hỏi
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-6 relative overflow-y-auto h-full">

        {/* Nút Hamburger Mở Sidebar (Nổi góc trái) */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="hidden md:flex absolute top-6 left-6 z-40 p-2.5 bg-white shadow-md text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 rounded-xl transition-all hover:scale-105 hover:shadow-lg"
            title="Mở Sidebar"
          >
            <Menu size={24} />
          </button>
        )}

        {/* 🌟 OVERLAY KÉO THẢ TOÀN TRANG */}
        <div
          className={`fixed inset-0 z-[110] flex items-center justify-center bg-blue-700/95 transition-opacity duration-300 ease-out will-change-opacity ${isDragging ? 'opacity-100 visible' : 'opacity-0 invisible'
            }`}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              const droppedFile = e.dataTransfer.files[0];
              if (droppedFile.type === 'application/pdf' || droppedFile.name.toLowerCase().endsWith('.pdf')) {
                setFile(droppedFile);
                setMode('upload');
              } else {
                alert("Vui lòng chọn file PDF.");
              }
            }
          }}
        >
          <div className={`pointer-events-none text-white flex flex-col items-center justify-center p-12 border-4 border-white/80 border-dashed rounded-3xl w-[calc(100%-4rem)] h-[calc(100%-4rem)] shadow-2xl bg-white/5 transform-gpu transition-transform duration-300 ease-out will-change-transform ${isDragging ? 'scale-100' : 'scale-95'
            }`}>
            <Upload size={100} className="mb-6 animate-bounce" />
            <h2 className="text-5xl font-extrabold mb-4 tracking-tight">Thả file PDF của bạn vào đây</h2>
            <p className="text-xl text-blue-100 font-medium">Hệ thống sẽ tự động tải file và thiết lập tạo đề thi</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">

          {/* HEADER */}
          <header className="flex justify-between items-center mb-8 pb-4 border-b">
            <div className="flex items-start gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-blue-700 md:hidden mb-1">AI Quiz Generator</h1>
                <h2 className="text-xl font-bold text-gray-800 mt-1">
                  {activeHistoryId
                    ? history.find(h => h.id === activeHistoryId)?.title
                    : 'Thiết lập đề thi mới'}
                </h2>
              </div>
            </div>
            {mode !== 'upload' && (
              <button onClick={handleReset} className="md:hidden flex items-center gap-2 text-sm font-semibold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors">
                <PlusCircle size={18} /> Tạo đề mới
              </button>
            )}
          </header>

          {/* 1. MÀN HÌNH UPLOAD */}
          {mode === 'upload' && (
            <div className="bg-white p-10 rounded-xl shadow-lg text-center animate-slide-in-left">
              <div className="flex flex-col items-center gap-4">
                <div className="w-full max-w-md p-8 border-2 border-dashed border-blue-200 bg-blue-50 rounded-lg hover:border-blue-400 hover:bg-blue-100 transition-all group">
                  <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center text-blue-600 hover:text-blue-800 w-full h-full">
                    <Upload size={48} className="mb-2 transition-transform group-hover:-translate-y-1" />
                    <span className="font-semibold text-center">{file ? file.name : "Tải lên file PDF"}</span>
                  </label>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={!file || loading}
                  className={`px-8 py-3 rounded-lg font-bold text-white shadow transition-all ${!file || loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                  {loading ? <span className="flex items-center gap-2"><Loader2 className="animate-spin" /> Đang xử lý AI...</span> : "Tạo Đề Thi"}
                </button>
              </div>
            </div>
          )}

          {/* 2. MÀN HÌNH LỰA CHỌN CHẾ ĐỘ */}
          {mode === 'selection' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-in-left">
              <button
                onClick={() => setMode('review')}
                className="p-8 bg-white rounded-xl shadow hover:shadow-lg border border-transparent hover:border-blue-500 transition-all flex flex-col items-center gap-4 group"
              >
                <div className="p-4 bg-blue-100 text-blue-600 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <BookOpen size={40} />
                </div>
                <h3 className="text-xl font-bold">Ôn tập (Xem đáp án)</h3>
                <p className="text-gray-500 text-center">Xem câu hỏi kèm đáp án đúng được đánh dấu ngay lập tức.</p>
              </button>

              <button
                onClick={() => setMode('exam')}
                className="p-8 bg-white rounded-xl shadow hover:shadow-lg border border-transparent hover:border-purple-500 transition-all flex flex-col items-center gap-4 group"
              >
                <div className="p-4 bg-purple-100 text-purple-600 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <PenTool size={40} />
                </div>
                <h3 className="text-xl font-bold">Thi thử (Chấm điểm)</h3>
                <p className="text-gray-500 text-center">Làm bài trắc nghiệm, ẩn đáp án và tự động chấm điểm sau khi nộp.</p>
              </button>
            </div>
          )}

          {/* 3. CHẾ ĐỘ: ÔN TẬP (REVIEW) */}
          {mode === 'review' && (
            <div className="space-y-6 animate-slide-in-right">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => { setMode('selection'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-blue-600 hover:underline">← Quay lại</button>
                <h2 className="text-xl font-bold ml-auto bg-blue-100 text-blue-800 px-4 py-1 rounded-full">Chế độ Ôn tập</h2>
              </div>

              {quizzes.map((quiz, idx) => {
                const expectedArray = getAnswersArray(quiz.answer);
                const isMultiple = expectedArray.length > 1;

                return (
                  <div key={idx} className="bg-white p-6 rounded-xl shadow border border-gray-100">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2 flex-wrap">
                      Câu {idx + 1}: {quiz.question}
                      {isMultiple && <span className="text-xs font-medium px-2 py-1 bg-purple-100 text-purple-700 rounded-full border border-purple-200">Nhiều đáp án</span>}
                    </h3>
                    <div className="space-y-2">
                      {quiz.options.map((opt, i) => {
                        const isCorrect = expectedArray.some(ans => checkAnswerCorrect(opt, ans));

                        return (
                          <div
                            key={i}
                            className={`p-3 rounded-lg border text-sm font-medium
                          ${isCorrect
                                ? 'bg-green-100 border-green-500 text-green-900' // Đáp án đúng tô xanh
                                : 'bg-gray-50 border-gray-200 text-gray-600'
                              }`}
                          >
                            {opt} {isCorrect && "✅"}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 p-4 rounded-lg bg-green-50 border border-green-200 text-sm">
                      <p className="font-bold text-green-800 mb-1">Đáp án đúng: <span className="font-semibold text-green-900">{expectedArray.join(', ')}</span></p>
                      <p className="text-gray-700 italic">💡 Giải thích: {quiz.explanation}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 4. CHẾ ĐỘ: THI THỬ (EXAM) */}
          {mode === 'exam' && (
            <>
              <div className="space-y-8 animate-slide-in-right">
                <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow sticky top-4 z-10">
                  <button onClick={() => { setMode('selection'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-gray-500 hover:text-black">← Thoát</button>
                  {isSubmitted ? (
                    <div className="text-2xl font-bold text-blue-600">
                      Kết quả: {score} / {quizzes.length} câu đúng
                    </div>
                  ) : (
                    <div className="font-semibold text-gray-700">Đang làm bài thi...</div>
                  )}
                </div>

                {quizzes.map((quiz, qIdx) => {
                  const userSelection = userAnswers[qIdx] || [];
                  const expectedArray = getAnswersArray(quiz.answer);
                  const isMultiple = expectedArray.length > 1;

                  const isQuestionCorrect = userSelection.length === expectedArray.length &&
                    expectedArray.every(exp => userSelection.some(sel => checkAnswerCorrect(sel, exp)));

                  return (
                    <div key={qIdx} className={`bg-white p-6 rounded-xl shadow border-l-4 ${!isSubmitted ? 'border-gray-200' : isQuestionCorrect ? 'border-green-500' : 'border-red-500'
                      }`}>
                      <h3 className="font-bold text-lg mb-4 flex items-center gap-2 flex-wrap">
                        Câu {qIdx + 1}: {quiz.question}
                        {isMultiple && <span className="text-xs font-medium px-2 py-1 bg-purple-100 text-purple-700 rounded-full border border-purple-200">Chọn nhiều đáp án</span>}
                      </h3>

                      <div className="space-y-3">
                        {quiz.options.map((opt, oIdx) => {
                          let optionClass = "border-gray-200 hover:bg-gray-50 cursor-pointer";

                          const isOptSelected = userSelection.includes(opt);
                          const isOptCorrect = expectedArray.some(ans => checkAnswerCorrect(opt, ans));

                          if (isSubmitted) {
                            if (isOptCorrect) {
                              optionClass = "bg-green-100 border-green-500 text-green-900 font-bold";
                            } else if (isOptSelected && !isOptCorrect) {
                              optionClass = "bg-red-100 border-red-500 text-red-900";
                            } else {
                              optionClass = "opacity-50";
                            }
                          } else {
                            if (isOptSelected) optionClass = "bg-blue-100 border-blue-500 text-blue-900 ring-1 ring-blue-500";
                          }

                          return (
                            <div
                              key={oIdx}
                              onClick={() => handleSelectAnswer(qIdx, opt)}
                              className={`p-4 rounded-lg border transition-all flex items-start gap-3 ${optionClass}`}
                            >
                              {/* Icon trạng thái (cố định kích thước không co rút) */}
                              <div className="shrink-0 mt-0.5">
                                {isSubmitted ? (
                                  isOptCorrect ? <CheckCircle size={20} className="text-green-600" /> :
                                    (isOptSelected ? <XCircle size={20} className="text-red-600" /> : <div className="w-5" />)
                                ) : (
                                  <div className={`w-5 h-5 border flex items-center justify-center ${isMultiple ? 'rounded-md' : 'rounded-full'} ${isOptSelected ? 'border-blue-600' : 'border-gray-400'}`}>
                                    {isOptSelected && <div className={`w-3 h-3 bg-blue-600 ${isMultiple ? 'rounded-sm' : 'rounded-full'}`} />}
                                  </div>
                                )}
                              </div>
                              <span className="leading-relaxed block">{opt}</span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Hiện giải thích sau khi nộp bài */}
                      {isSubmitted && (
                        <div className={`mt-4 p-3 rounded text-sm ${isQuestionCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                          <strong>{isQuestionCorrect ? "Chính xác!" : "Chưa chính xác!"}</strong>
                          <p className="mt-1">Đáp án đúng là: <strong>{expectedArray.join(', ')}</strong></p>
                          <p className="mt-1 italic text-gray-600">Giải thích: {quiz.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Nút nộp bài */}
                {!isSubmitted && (
                  <div className="flex justify-center pt-6 pb-12">
                    <button
                      onClick={handleSubmitExam}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-12 rounded-full shadow-xl text-lg transform hover:scale-105 transition-all"
                    >
                      Nộp Bài Thi
                    </button>
                  </div>
                )}

              </div>

              {/* Các nút tác vụ nổi nằm NGOÀI thuộc tính animation để fixed với viewport */}
              {isSubmitted && (
                <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
                  <button
                    onClick={() => {
                      setIsRetaking(true);
                      setTimeout(() => {
                        setUserAnswers({});
                        setIsSubmitted(false);
                        setScore(0);
                        window.scrollTo({ top: 0, behavior: 'auto' });
                        setIsRetaking(false);
                      }, 800);
                    }}
                    disabled={isRetaking}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full shadow-2xl text-base transform hover:scale-105 transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={20} className={isRetaking ? "animate-spin" : ""} /> Thi Lại Ngay
                  </button>
                  <button
                    onClick={() => { setMode('selection'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="bg-white hover:bg-gray-50 border-2 border-gray-200 text-gray-800 font-bold py-3 px-6 rounded-full shadow-2xl text-base transform hover:scale-105 transition-all"
                  >
                    Trở Về Menu
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 🌟 OVERLAY LOADING KHI THI LẠI */}
        {isRetaking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-100/80 animate-fade-in-blur">
            <div className="flex flex-col items-center bg-white p-10 rounded-3xl shadow-2xl border border-gray-100 animate-slide-in-left">
              <Loader2 size={64} className="animate-spin text-purple-600 mb-6" />
              <h2 className="text-2xl font-bold text-gray-800">Đang chuẩn bị đề thi...</h2>
              <p className="text-gray-500 mt-2">Sẵn sàng để thử sức lại!</p>
            </div>
          </div>
        )}

        {/* 🌟 OVERLAY XÁC NHẬN XÓA */}
        {deleteConfirmId && (
          <div className={`fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 ${isClosingModal ? 'animate-fade-out-blur' : 'animate-fade-in-blur'}`}>
            <div className={`bg-white p-6 rounded-3xl shadow-2xl border border-gray-100 w-full max-w-sm mx-4 origin-center ${isClosingModal ? 'animate-pop-out' : 'animate-pop-in'}`}>
              <div className="flex items-center gap-4 mb-3">
                <div className="p-3 bg-red-100 text-red-600 rounded-full shrink-0">
                  <Trash2 size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Xác nhận xóa</h3>
              </div>
              <p className="text-gray-600 mb-6 font-medium leading-relaxed">
                Bạn có chắc chắn muốn xóa đề thi này không? Hành động này không thể hoàn tác.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeDeleteModal}
                  className="px-5 py-2.5 font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={confirmDeleteHistory}
                  className="px-5 py-2.5 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-md shadow-red-500/30 transform hover:-translate-y-0.5"
                >
                  Xóa đề thi
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}