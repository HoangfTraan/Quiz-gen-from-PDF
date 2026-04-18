"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { Trash2, ExternalLink, FileText, AlertCircle, Clock, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { deleteDocumentAction } from "./actions";

interface DocumentData {
  id: string;
  title: string;
  file_type: string | null;
  status: string | null;
  created_at: string;
  users: {
    email: string;
    full_name: string | null;
  } | null;
}

export default function DocumentTable({ documents }: { documents: DocumentData[] }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDelete = () => {
    if (!deletingId) return;
    startTransition(async () => {
      try {
        await deleteDocumentAction(deletingId);
        setDeletingId(null);
      } catch (err) {
        alert("Lỗi khi xóa tài liệu");
      }
    });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700"><CheckCircle2 size={14}/> Hoàn thành</span>;
      case "failed":
        return <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700"><AlertCircle size={14}/> Lỗi xử lý</span>;
      case "processing":
        return <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-700"><Loader2 size={14} className="animate-spin"/> Đang xử lý</span>;
      default:
        return <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-700"><Clock size={14}/> Chờ xử lý</span>;
    }
  };

  if (documents.length === 0) {
    return (
      <div className="p-12 text-center bg-gray-50 text-gray-500 font-medium border-t border-gray-200">
        Không tìm thấy tài liệu nào phù hợp.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tài liệu</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Chủ sở hữu</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ngày tạo</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Thao tác</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                      <FileText size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 truncate max-w-[200px]" title={doc.title}>
                        {doc.title}
                      </div>
                      <div className="text-xs text-gray-400 font-medium uppercase">{doc.file_type || "PDF"}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-700">{doc.users?.full_name || "Người dùng"}</span>
                    <span className="text-xs text-gray-400">{doc.users?.email}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(doc.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-500 font-medium">{new Date(doc.created_at).toLocaleDateString("vi-VN")}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setDeletingId(doc.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Xóa tài liệu"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal using Portal */}
      {mounted && deletingId && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px]" onClick={() => !isDeleting && setDeletingId(null)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-pop-in">
             <div className="flex items-center justify-center w-16 h-16 bg-red-100 text-red-600 rounded-2xl mb-6 mx-auto">
               <Trash2 size={32} />
             </div>
             <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Xóa tài liệu?</h3>
             <p className="text-gray-500 text-center mb-8 font-medium">Hành động này không thể hoàn tác. Mọi câu hỏi và kết quả thi liên quan cũng sẽ bị xóa bỏ.</p>
             <div className="flex gap-4">
               <button
                 disabled={isDeleting}
                 onClick={() => setDeletingId(null)}
                 className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
               >
                 Hủy
               </button>
               <button
                 disabled={isDeleting}
                 onClick={handleDelete}
                 className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
               >
                 {isDeleting ? <Loader2 size={18} className="animate-spin" /> : "Xác nhận xóa"}
               </button>
             </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
