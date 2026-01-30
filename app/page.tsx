'use client';

import { useState } from 'react';
import { Upload, Loader2, BookOpen, PenTool, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

// Định nghĩa kiểu dữ liệu
interface Quiz {
  question: string;
  options: string[];
  answer: string;
  bloom_level: string;
  explanation: string;
}

export default function Home() {
  // --- STATE QUẢN LÝ DỮ LIỆU ---
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  
  // --- STATE QUẢN LÝ GIAO DIỆN (MODE) ---
  // 'upload': Màn hình chọn file
  // 'selection': Màn hình chọn "Xem ngay" hoặc "Thi thử"
  // 'review': Chế độ xem đáp án ngay
  // 'exam': Chế độ thi thử
  const [mode, setMode] = useState<'upload' | 'selection' | 'review' | 'exam'>('upload');

  // --- STATE CHO CHẾ ĐỘ THI THỬ ---
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({}); // Lưu đáp án người dùng chọn
  const [isSubmitted, setIsSubmitted] = useState(false); // Đã nộp bài chưa
  const [score, setScore] = useState(0); // Điểm số

  // 1. Xử lý Upload file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFile(e.target.files[0]);
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
      
      if (quizList.length > 0) {
        setQuizzes(quizList);
        setMode('selection'); // Chuyển sang màn hình chọn chế độ
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
    setUserAnswers(prev => ({ ...prev, [questionIndex]: option }));
  };

  // 3. Xử lý Nộp bài & Chấm điểm
  const handleSubmitExam = () => {
    let currentScore = 0;
    quizzes.forEach((quiz, index) => {
      // So sánh đáp án người dùng chọn với đáp án đúng (cần làm sạch chuỗi để so sánh chính xác)
      if (userAnswers[index] === quiz.answer) {
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
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6 font-sans text-gray-800">
      <div className="max-w-4xl mx-auto">
        
        {/* HEADER */}
        <header className="flex justify-between items-center mb-8 pb-4 border-b">
          <h1 className="text-2xl font-bold text-blue-700">AI Quiz Generator</h1>
          {mode !== 'upload' && (
            <button onClick={handleReset} className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500">
              <RefreshCw size={16} /> Tạo đề mới
            </button>
          )}
        </header>

        {/* 1. MÀN HÌNH UPLOAD */}
        {mode === 'upload' && (
          <div className="bg-white p-10 rounded-xl shadow-lg text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-full max-w-md p-8 border-2 border-dashed border-blue-200 rounded-lg bg-blue-50">
                <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" id="file-upload" />
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center text-blue-600 hover:text-blue-800">
                  <Upload size={48} className="mb-2" />
                  <span className="font-semibold">{file ? file.name : "Chọn file PDF tài liệu"}</span>
                </label>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!file || loading}
                className={`px-8 py-3 rounded-lg font-bold text-white shadow transition-all ${
                  !file || loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {loading ? <span className="flex items-center gap-2"><Loader2 className="animate-spin"/> Đang xử lý AI...</span> : "Tạo Đề Thi"}
              </button>
            </div>
          </div>
        )}

        {/* 2. MÀN HÌNH LỰA CHỌN CHẾ ĐỘ */}
        {mode === 'selection' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
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
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setMode('selection')} className="text-blue-600 hover:underline">← Quay lại</button>
              <h2 className="text-xl font-bold ml-auto bg-blue-100 text-blue-800 px-4 py-1 rounded-full">Chế độ Ôn tập</h2>
            </div>
            
            {quizzes.map((quiz, idx) => (
              <div key={idx} className="bg-white p-6 rounded-xl shadow border border-gray-100">
                <h3 className="font-bold text-lg mb-3">Câu {idx + 1}: {quiz.question}</h3>
                <div className="space-y-2">
                  {quiz.options.map((opt, i) => (
                    <div 
                      key={i} 
                      className={`p-3 rounded-lg border text-sm font-medium
                        ${opt === quiz.answer 
                          ? 'bg-green-100 border-green-500 text-green-900' // Đáp án đúng tô xanh
                          : 'bg-gray-50 border-gray-200 text-gray-600'
                        }`}
                    >
                      {opt} {opt === quiz.answer && "✅"}
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-sm text-gray-500 bg-gray-50 p-3 rounded italic">
                  💡 Giải thích: {quiz.explanation}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 4. CHẾ ĐỘ: THI THỬ (EXAM) */}
        {mode === 'exam' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow sticky top-4 z-10">
              <button onClick={() => setMode('selection')} className="text-gray-500 hover:text-black">← Thoát</button>
              {isSubmitted ? (
                <div className="text-2xl font-bold text-blue-600">
                  Kết quả: {score} / {quizzes.length} câu đúng
                </div>
              ) : (
                <div className="font-semibold text-gray-700">Đang làm bài thi...</div>
              )}
            </div>

            {quizzes.map((quiz, qIdx) => {
              const userAnswer = userAnswers[qIdx];
              const isCorrect = userAnswer === quiz.answer;

              return (
                <div key={qIdx} className={`bg-white p-6 rounded-xl shadow border-l-4 ${
                  !isSubmitted ? 'border-gray-200' : isCorrect ? 'border-green-500' : 'border-red-500'
                }`}>
                  <h3 className="font-bold text-lg mb-4">Câu {qIdx + 1}: {quiz.question}</h3>
                  
                  <div className="space-y-3">
                    {quiz.options.map((opt, oIdx) => {
                      // Logic màu sắc sau khi nộp bài
                      let optionClass = "border-gray-200 hover:bg-gray-50 cursor-pointer"; // Mặc định
                      
                      if (isSubmitted) {
                         if (opt === quiz.answer) {
                           optionClass = "bg-green-100 border-green-500 text-green-900 font-bold"; // Đáp án đúng luôn xanh
                         } else if (opt === userAnswer && userAnswer !== quiz.answer) {
                           optionClass = "bg-red-100 border-red-500 text-red-900"; // Chọn sai thì đỏ
                         } else {
                           optionClass = "opacity-50"; // Các câu còn lại làm mờ
                         }
                      } else {
                        // Khi chưa nộp bài, chỉ highlight câu đang chọn
                        if (opt === userAnswer) optionClass = "bg-blue-100 border-blue-500 text-blue-900 ring-1 ring-blue-500";
                      }

                      return (
                        <div 
                          key={oIdx}
                          onClick={() => handleSelectAnswer(qIdx, opt)}
                          className={`p-4 rounded-lg border transition-all flex items-center gap-3 ${optionClass}`}
                        >
                          {/* Icon trạng thái */}
                          {isSubmitted ? (
                             opt === quiz.answer ? <CheckCircle size={20} className="text-green-600"/> :
                             (opt === userAnswer ? <XCircle size={20} className="text-red-600"/> : <div className="w-5"/>)
                          ) : (
                             <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${opt === userAnswer ? 'border-blue-600' : 'border-gray-400'}`}>
                               {opt === userAnswer && <div className="w-3 h-3 bg-blue-600 rounded-full"/>}
                             </div>
                          )}
                          {opt}
                        </div>
                      )
                    })}
                  </div>

                  {/* Hiện giải thích sau khi nộp bài */}
                  {isSubmitted && (
                    <div className={`mt-4 p-3 rounded text-sm ${isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                      <strong>{isCorrect ? "Chính xác!" : "Sai rồi!"}</strong> 
                      <p className="mt-1">Đáp án đúng là: <strong>{quiz.answer}</strong></p>
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
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-12 rounded-full shadow-lg text-lg transform hover:scale-105 transition-all"
                >
                  Nộp Bài Thi
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}