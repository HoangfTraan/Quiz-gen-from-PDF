"use client";

import { useState, useEffect } from "react";
import { Upload, Loader2, FileCheck, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function DocumentUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [questionCount, setQuestionCount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (e.clientX === 0 || e.clientY === 0) {
         setIsDragging(false);
      }
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
         setFile(e.dataTransfer.files[0]);
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      setErrorText("Vui lòng nhập tiêu đề và chọn file!");
      return;
    }
    setLoading(true);
    setErrorText("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Chưa đăng nhập");

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw new Error("Lỗi tải lên: " + uploadError.message);

      // Handle custom subject
      let finalSubjectId = null;
      if (subjectName.trim()) {
         const { data: found } = await supabase
           .from('subjects')
           .select('id')
           .ilike('name', subjectName.trim())
           .maybeSingle();
         if (found) {
            finalSubjectId = found.id;
         } else {
            const { data: newSub } = await supabase.from('subjects').insert({ name: subjectName.trim() }).select('id').single();
            if (newSub) finalSubjectId = newSub.id;
         }
      }

      // Insert record to database
      const { data: docData, error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          subject_id: finalSubjectId,
          title: title,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          status: 'processing'
        })
        .select()
        .single();

      if (dbError) throw new Error("Lỗi lưu DB: " + dbError.message);

      router.push(`/documents/${docData.id}/analysis?questionCount=${questionCount}`);
    } catch (err: any) {
      setErrorText(err.message || "Đã có lỗi xảy ra");
      setLoading(false);
    }
  };

  return (
    <>
      <div 
        className={`fixed inset-0 z-50 bg-blue-600/95 flex flex-col items-center justify-center text-white transition-opacity duration-300 ${
          isDragging ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className={`p-8 bg-white/20 rounded-full mb-8 transition-transform duration-500 delay-75 ${isDragging ? "scale-100" : "scale-50"}`}>
           <Upload size={80} className={`${isDragging ? 'animate-bounce' : ''} drop-shadow-md`} />
        </div>
        <h2 className={`text-4xl md:text-5xl font-extrabold mb-4 tracking-tight drop-shadow-md transition-transform duration-500 delay-100 ${isDragging ? "translate-y-0" : "translate-y-10"}`}>Thả tài liệu vào đây</h2>
        <p className={`text-xl md:text-2xl font-medium opacity-90 drop-shadow transition-transform duration-500 delay-150 ${isDragging ? "translate-y-0" : "translate-y-10"}`}>Hệ thống AI sẽ tự động phân tích và tạo đề thi</p>
      </div>
    
      <div className="animate-slide-in-right max-w-2xl mx-auto mt-10 relative">
        <h1 className="text-2xl font-extrabold text-gray-800 mb-6 text-center">Tải lên tài liệu mới</h1>

      <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        {errorText && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle size={16} /> {errorText}
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Tiêu đề tài liệu <span className="text-red-500">*</span></label>
          <input 
            type="text" 
            placeholder="Ví dụ: Bài giảng Sinh học kỳ 1" 
            autoFocus={true}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Môn học / Chủ đề</label>
          <input 
            type="text" 
            placeholder="Ví dụ: Toán cao cấp, Sinh học tế bào..." 
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Số câu hỏi muốn tạo</label>
          <div className="grid grid-cols-5 gap-2">
            {[10, 20, 30, 50, 100].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => setQuestionCount(num)}
                className={`py-2.5 rounded-lg font-bold text-sm border-2 transition-all ${
                  questionCount === num
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30 scale-105'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {num} câu
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Số lượng thực tế có thể chênh lệch nhẹ tùy vào độ dài tài liệu.</p>
        </div>

        <div className="w-full p-8 border-2 border-dashed border-blue-200 bg-blue-50 rounded-lg hover:border-blue-400 hover:bg-blue-100 transition-all group mb-8 flex flex-col items-center justify-center relative">
          <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" id="file-upload" />
          <div className="flex flex-col items-center justify-center text-blue-600 pointer-events-none">
            {file ? (
              <FileCheck size={48} className="mb-2 text-green-500" />
            ) : (
              <Upload size={48} className="mb-2 transition-transform group-hover:-translate-y-1" />
            )}
            <span className="font-semibold text-center mt-2 text-gray-800">
               {file ? <span className="text-green-600">{file.name}</span> : "Kéo thả hoặc click chọn file (PDF, DOCX)"}
            </span>
            {file && <span className="text-sm text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</span>}
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className={`w-full py-3 rounded-lg font-bold text-white shadow transition-all ${
            !file || loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" /> Đang tải và phân tích...</span> : "Tải lên & Xử lý AI"}
        </button>
      </div>
    </div>
    </>
  );
}
