"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, User, Shield, Check, BookMarked, GraduationCap } from "lucide-react";
import { updateUserAction } from "./actions";
import { createClient } from "@/utils/supabase/client";
import type { AppRole } from "@/utils/rbac";
import { getRoleLabel } from "@/utils/rbac";

interface UserData {
  id: string;
  full_name: string | null;
  email: string;
  role: string;           // cột users.role (admin | user)
  app_role: AppRole;      // role thực tế đã merge
}

const ROLES: {
  value: AppRole;
  label: string;
  icon: React.ElementType;
  color: string;
  activeColor: string;
  description: string;
}[] = [
  {
    value: "user",
    label: "Người dùng",
    icon: User,
    color: "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200",
    activeColor: "border-blue-500 bg-blue-50 text-blue-700 font-bold",
    description: "Tạo & xem bộ đề của mình",
  },
  {
    value: "teacher",
    label: "Giáo viên",
    icon: BookMarked,
    color: "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200",
    activeColor: "border-teal-500 bg-teal-50 text-teal-700 font-bold",
    description: "Tạo, xem & kiểm duyệt bộ đề",
  },
  {
    value: "learner",
    label: "Người học",
    icon: GraduationCap,
    color: "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200",
    activeColor: "border-sky-500 bg-sky-50 text-sky-700 font-bold",
    description: "Làm bài & xem điểm",
  },
  {
    value: "admin",
    label: "Admin",
    icon: Shield,
    color: "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200",
    activeColor: "border-purple-500 bg-purple-50 text-purple-700 font-bold",
    description: "Toàn quyền quản trị",
  },
];

export default function EditUserModal({
  user,
  onClose,
}: {
  user: UserData;
  onClose: () => void;
}) {
  const [fullName, setFullName] = useState(user.full_name || "");
  const [selectedRole, setSelectedRole] = useState<AppRole>(user.app_role);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.append("id", user.id);
    formData.append("full_name", fullName);
    formData.append("role", selectedRole);

    startTransition(async () => {
      try {
        const result = await updateUserAction(formData);
        if (result && result.error) {
          setError(result.error);
        } else {
          // Phát tín hiệu Broadcast để trình duyệt của người dùng tự động cập nhật Role
          const supabase = createClient();
          const channel = supabase.channel(`layout_user_${user.id}`);
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              channel.send({
                type: 'broadcast',
                event: 'role_updated',
                payload: { userId: user.id }
              }).then(() => {
                supabase.removeChannel(channel);
                onClose();
              });
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
               onClose();
            }
          });
          
          // Trả phòng trường hợp websocket bị chậm
          setTimeout(onClose, 500);
        }
      } catch (err: any) {
        setError(err.message || "Đã xảy ra lỗi khi cập nhật");
      }
    });
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-gray-900/40 transition-opacity"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-pop-in">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Chỉnh sửa người dùng</h2>
            <p className="text-sm text-gray-400 mt-0.5 truncate">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
              {error}
            </div>
          )}

          {/* Họ tên */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Họ và tên
            </label>
            <div className="relative">
              <User
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>
          </div>

          {/* Chọn role */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Vai trò
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => {
                const isSelected = selectedRole === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setSelectedRole(r.value)}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected ? r.activeColor : r.color
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <r.icon size={16} />
                      {r.label}
                      {isSelected && <Check size={14} className="ml-auto" />}
                    </div>
                    <span className="text-xs opacity-70 leading-tight">
                      {r.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex gap-3">
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
