import Link from "next/link";
import { BookOpen, Sparkles, BrainCircuit, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800 animate-slide-in-left">
      <header className="bg-white border-b border-gray-200 py-4 px-6 md:px-12 flex justify-between items-center z-10 relative">
         <div className="flex items-center gap-3">
           <BookOpen className="text-blue-600" size={28} />
           <span className="text-xl font-extrabold text-blue-800 tracking-tight">QuizGen AI</span>
         </div>
         <div className="flex items-center gap-4">
           <Link href="/login" className="font-semibold text-gray-600 hover:text-blue-600">Đăng nhập</Link>
           <Link href="/register" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full font-bold shadow-md shadow-blue-500/20 transition-all">Đăng ký ngay</Link>
         </div>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
         <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 font-bold text-sm mb-6 animate-fade-in-blur">
            <Sparkles size={16} /> Phiên bản Beta 1.0
         </div>
         <h1 className="text-5xl md:text-7xl font-black text-gray-900 tracking-tight leading-tight mb-6 max-w-4xl text-balance">
            Biến tài liệu của bạn thành <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Câu Hỏi Trắc Nghiệm</span>
         </h1>
         <p className="text-xl text-gray-500 font-medium mb-10 max-w-2xl text-balance">
            Tải lên báo cáo PDF, giáo trình hoặc tài liệu và AI của chúng tôi sẽ tự động phân tích và tạo bộ đề xuất sắc trong vòng vài giây.
         </p>
         
         <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <Link href="/documents/upload" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-bold shadow-xl shadow-blue-500/30 text-lg flex items-center justify-center gap-2 transition-transform hover:scale-105">
               Bắt đầu tạo Đề thi <ArrowRight size={20} />
            </Link>
            <Link href="/dashboard" className="bg-white hover:bg-gray-50 border-2 border-gray-200 text-gray-700 px-8 py-4 rounded-full font-bold shadow-sm text-lg flex items-center justify-center gap-2 transition-all">
               Trở về Dashboard
            </Link>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full text-left mt-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
               <div className="w-14 h-14 bg-blue-100 text-blue-600 flex items-center justify-center rounded-2xl mb-6">
                 <BrainCircuit size={28} />
               </div>
               <h3 className="text-xl font-bold text-gray-900 mb-3">AI Trích xuất Thông minh</h3>
               <p className="text-gray-500 leading-relaxed font-medium">Hệ thống phân tích cú pháp nâng cao từ các file PDF, DOCX với khả năng hiểu sâu văn cảnh.</p>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
               <div className="w-14 h-14 bg-green-100 text-green-600 flex items-center justify-center rounded-2xl mb-6">
                 <BookOpen size={28} />
               </div>
               <h3 className="text-xl font-bold text-gray-900 mb-3">Ôn tập hiệu quả</h3>
               <p className="text-gray-500 leading-relaxed font-medium">Cung cấp bộ đề trắc nghiệm chuẩn xác kèm theo lời giải thích cặn kẽ giúp bạn học nhanh hơn 5x.</p>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
               <div className="w-14 h-14 bg-orange-100 text-orange-600 flex items-center justify-center rounded-2xl mb-6">
                 <Sparkles size={28} />
               </div>
               <h3 className="text-xl font-bold text-gray-900 mb-3">Phân tích Lịch sử</h3>
               <p className="text-gray-500 leading-relaxed font-medium">Ghi lại toàn bộ lịch sử trả lời và thống kê điểm yếu để đưa ra lộ trình cần cải thiện.</p>
            </div>
         </div>
      </main>
    </div>
  );
}