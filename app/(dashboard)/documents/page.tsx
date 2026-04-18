"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PlusCircle, Search, FileText, Trash2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import ConfirmModal from "@/components/ConfirmModal";

export default function DocumentsPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const supabase = createClient();

  const fetchDocs = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("documents")
        .select(`
          id, 
          title, 
          status, 
          created_at,
          subjects (name)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) setDocs(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDocs();
  }, [supabase]);

  const toggleSelectAll = () => {
    if (selectedIds.size === docs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(docs.map(d => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const openDeleteModal = (ids: string[]) => {
    setDeleteTargetIds(ids);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteTargetIds([]);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await supabase.from('documents').delete().in('id', deleteTargetIds);
      // Remove from UI
      setDocs(prev => prev.filter(d => !deleteTargetIds.includes(d.id)));
      setSelectedIds(new Set());
      closeDeleteModal();
    } catch (error) {
      console.error("Lỗi xóa:", error);
      alert("Đã xảy ra lỗi khi xóa tài liệu.");
    } finally {
      setDeleting(false);
    }
  };

  const filteredDocs = docs.filter(doc => doc.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalPages = Math.ceil(filteredDocs.length / itemsPerPage);
  const paginatedDocs = filteredDocs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-extrabold text-gray-800">Quản lý Tài liệu</h1>
          <div className="flex gap-3">
            <div className={`overflow-hidden transition-all duration-300 origin-right flex items-center ${selectedIds.size > 0 ? "max-w-[200px] opacity-100 scale-100" : "max-w-0 opacity-0 scale-50 pointer-events-none"}`}>
              <button
                onClick={() => openDeleteModal(Array.from(selectedIds))}
                disabled={deleting || selectedIds.size === 0}
                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap"
              >
                {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                Xóa ({selectedIds.size})
              </button>
            </div>
            <Link
              href="/documents/upload"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              <PlusCircle size={18} />
              Tải tài liệu lên
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Tìm kiếm tài liệu..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                autoFocus={true}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20 text-gray-400"><Loader2 className="animate-spin" size={32} /></div>
          ) : (
            <>
              <div className="min-w-full divide-y divide-gray-200 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 w-10 text-center">
                        <input type="checkbox" onChange={toggleSelectAll} checked={docs.length > 0 && selectedIds.size === docs.length} className="w-4 h-4 text-blue-600 rounded cursor-pointer" />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Tên tài liệu</th>
                      <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Môn học</th>
                      <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Trạng thái</th>
                      <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Ngày tải</th>
                      <th className="px-6 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody key={currentPage} className="bg-white divide-y divide-gray-200 animate-page-fade">
                    {filteredDocs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-medium">
                          Không tìm thấy tài liệu phù hợp. <Link href="/documents/upload" className="text-blue-600 hover:underline">Tải lên ngay</Link>
                        </td>
                      </tr>
                    ) : paginatedDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          <input type="checkbox" checked={selectedIds.has(doc.id)} onChange={() => toggleSelect(doc.id)} className="w-4 h-4 text-blue-600 rounded cursor-pointer" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link href={doc.status === 'processing' || doc.status === 'uploaded' ? `/documents/${doc.id}/analysis` : `/documents/${doc.id}`} className="flex items-center gap-2 font-bold text-gray-800 hover:text-blue-600 transition-colors">
                            <FileText size={18} className="text-blue-500" />
                            {doc.title}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                          {doc.subjects?.name || "Không có chủ đề"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-black rounded-lg uppercase tracking-wider ${doc.status === 'completed' ? 'bg-green-100 text-green-800' :
                              doc.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800 animate-pulse'
                            }`}>
                            {doc.status === 'completed' ? 'Hoàn thành' : doc.status === 'failed' ? 'Thất bại' : 'Đang xử lý'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                          {new Date(doc.created_at).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button onClick={() => openDeleteModal([doc.id])} className="text-gray-400 hover:text-red-500 p-2 transition-colors rounded-lg hover:bg-red-50">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50/50">
                  <span className="text-sm text-gray-500 font-medium">
                    Hiển thị <span className="font-bold text-gray-800">{(currentPage - 1) * itemsPerPage + 1}</span> đến <span className="font-bold text-gray-800">{Math.min(currentPage * itemsPerPage, filteredDocs.length)}</span> trong số <span className="font-bold text-gray-800">{filteredDocs.length}</span> tài liệu
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-600 bg-white shadow-sm"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${currentPage === i + 1 ? 'bg-blue-600 text-white shadow-md border-blue-600' : 'border border-gray-200 hover:bg-gray-100 text-gray-700 bg-white hover:border-gray-300'}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-600 bg-white shadow-sm"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmModal 
        isOpen={showDeleteModal}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title="Xóa tài liệu?"
        message={`Bạn có chắc chắn muốn xóa ${deleteTargetIds.length} tài liệu này? Hành động này sẽ xóa vĩnh viễn tài liệu và tất cả các câu hỏi liên quan. Thao tác này không thể hoàn tác.`}
        confirmText="Xác nhận xóa"
        cancelText="Để mình xem lại"
        isDestructive={true}
      />
    </>
  );
}
