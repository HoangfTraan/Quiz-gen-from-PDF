"use client";

import { useState } from "react";
import EditUserModal from "./EditUserModal";
import type { AppRole } from "@/utils/rbac";
import { getRoleLabel, getRoleBadgeClass } from "@/utils/rbac";

interface UserData {
  id: string;
  full_name: string | null;
  email: string;
  role: string;        // cột users.role
  app_role: AppRole;   // role thực tế đã được merge
  avatar?: string | null;
}

export default function UserTable({ users }: { users: UserData[] }) {
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  if (users.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 text-gray-500 font-medium border-t border-gray-200">
        Không tìm thấy người dùng nào phù hợp với yêu cầu.
      </div>
    );
  }

  return (
    <>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">
              Người dùng
            </th>
            <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">
              Vai trò
            </th>
            <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">
              Trạng thái
            </th>
            <th className="px-6 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-wider">
              Thao tác
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-gray-50 transition-colors">
              {/* Avatar + tên */}
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold overflow-hidden border border-gray-100 text-[10px] shrink-0">
                    {u.avatar ? (
                      <img
                        src={u.avatar}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (u.full_name || u.email).charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="font-bold text-gray-900">
                    {u.full_name || "Không rõ"}
                  </span>
                </div>
              </td>

              {/* Email */}
              <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-sm font-medium">
                {u.email}
              </td>

              {/* Role badge — dùng app_role đã được tính */}
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2.5 py-1 text-[10px] rounded-lg font-black uppercase tracking-wider border ${getRoleBadgeClass(u.app_role)}`}
                >
                  {getRoleLabel(u.app_role)}
                </span>
              </td>

              {/* Trạng thái */}
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2.5 py-1 text-[10px] rounded-lg font-black uppercase tracking-wider bg-green-100 text-green-700 border border-green-200">
                  Hoạt động
                </span>
              </td>

              {/* Nút sửa */}
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                <button
                  onClick={() => setEditingUser(u)}
                  className="px-4 py-1.5 text-blue-600 hover:text-white hover:bg-blue-600 border-2 border-blue-600 rounded-xl font-black text-xs transition-all transform active:scale-95"
                >
                  SỬA
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
        />
      )}
    </>
  );
}
