"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, User, Shield, Check } from "lucide-react";
import { updateUserAction } from "./actions";

interface UserData {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

export default function EditUserModal({ user, onClose }: { user: UserData; onClose: () => void }) {
  const [fullName, setFullName] = useState(user.full_name || "");
  const [role, setRole] = useState(user.role);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Prevent scrolling when modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.append("id", user.id);
    formData.append("full_name", fullName);
    formData.append("role", role);

    startTransition(async () => {
      try {
        await updateUserAction(formData);
        onClose();
      } catch (err: any) {
        setError(err.message || "Đã xảy ra lỗi khi cập nhật");
      }
    });
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 animate-fade-in">
      {/* Background overlay */}
      <div 
        className="absolute inset-0 bg-gray-900/40 transition-opacity" 
        onClick={onClose}
      ></div>
      
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-pop-in">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Chỉnh sửa người dùng</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Họ và tên</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Vai trò hệ thống</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("user")}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  role === "user"
                    ? "border-blue-500 bg-blue-50 text-blue-700 font-bold"
                    : "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200"
                }`}
              >
                <User size={18} />
                User
                {role === "user" && <Check size={16} className="ml-1" />}
              </button>
              <button
                type="button"
                onClick={() => setRole("admin")}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  role === "admin"
                    ? "border-purple-500 bg-purple-50 text-purple-700 font-bold"
                    : "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200"
                }`}
              >
                <Shield size={18} />
                Admin
                {role === "admin" && <Check size={16} className="ml-1" />}
              </button>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
            >
              {isPending ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
