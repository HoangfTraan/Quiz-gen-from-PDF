"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}

export default function Pagination({ currentPage, totalPages, totalItems, pageSize }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    if (newPage === 1) {
      params.delete("page");
    } else {
      params.set("page", newPage.toString());
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-8 py-6 border-t border-gray-100">
      <div className="flex-1 flex justify-between sm:hidden">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="relative inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-all shadow-sm"
        >
          Trang trước
        </button>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-all shadow-sm"
        >
          Trang sau
        </button>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium tracking-tight">
            Hiển thị <span className="font-black text-gray-900">{(currentPage - 1) * pageSize + 1}</span> -{" "}
            <span className="font-black text-gray-900">{Math.min(currentPage * pageSize, totalItems)}</span> trong số{" "}
            <span className="font-black text-gray-900">{totalItems}</span> bài thi
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-xl shadow-sm -space-x-px overflow-hidden border border-gray-200" aria-label="Pagination">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="relative inline-flex items-center px-3 py-2 bg-white text-sm font-medium text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-all border-r border-gray-100"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="px-6 py-2 bg-white text-sm font-black text-blue-600 flex items-center">
              Trang {currentPage} / {totalPages}
            </div>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="relative inline-flex items-center px-3 py-2 bg-white text-sm font-medium text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-all border-l border-gray-100"
            >
              <ChevronRight size={20} />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
