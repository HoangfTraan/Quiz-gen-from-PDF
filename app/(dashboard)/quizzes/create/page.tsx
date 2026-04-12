import Link from "next/link";
import { ArrowLeft, Settings2 } from "lucide-react";

export default function CreateQuizPage() {
  return (
    <div className="animate-slide-in-right max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/quizzes" className="text-gray-500 hover:text-gray-800 flex items-center gap-2 w-fit">
          <ArrowLeft size={16} /> Quay lại danh sách
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-3">
          <Settings2 className="text-blue-600" /> Tạo bộ câu hỏi mới
        </h1>
        <p className="text-gray-500 mt-1">Cấu hình tham số để AI sinh câu hỏi từ tài liệu</p>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Chọn tài liệu gốc</label>
            <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option>-- Chọn tài liệu --</option>
              <option value="1">Bài giảng Sinh học lớp 12</option>
              <option value="2">Lịch sử thế giới hiện đại</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Số lượng câu hỏi</label>
            <input type="number" defaultValue={10} min={1} max={100} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Độ khó (Tùy chọn)</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="difficulty" value="all" defaultChecked className="text-blue-600 focus:ring-blue-500" />
                <span>Trộn lẫn</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="difficulty" value="easy" className="text-blue-600 focus:ring-blue-500" />
                <span>Dễ (Nhận biết)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="difficulty" value="medium" className="text-blue-600 focus:ring-blue-500" />
                <span>Trung bình (Thông hiểu)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="difficulty" value="hard" className="text-blue-600 focus:ring-blue-500" />
                <span>Khó (Vận dụng)</span>
              </label>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
            <Link href="/quizzes" className="px-5 py-2.5 rounded-lg font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
              Hủy
            </Link>
            <button className="px-5 py-2.5 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30">
              Sinh câu hỏi (AI)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
