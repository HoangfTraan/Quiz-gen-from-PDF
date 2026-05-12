"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Loader2, ShieldAlert } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function RoleRequestTable({ requests: initialRequests }: { requests: any[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const supabase = createClient();

  const handleAction = async (requestId: string, userId: string, requestedRole: string, action: 'approve' | 'reject') => {
    setProcessingId(requestId);
    try {
      if (action === 'approve') {
        // 1. Get role id from roles table
        const { data: roleData } = await supabase.from('roles').select('id').eq('name', requestedRole).single();
        if (!roleData) throw new Error("Role không tồn tại trong hệ thống");

        // 2. Delete any existing roles for this user in user_roles
        await supabase.from('user_roles').delete().eq('user_id', userId);

        // 3. Assign new role
        const { data: { user: adminUser } } = await supabase.auth.getUser();
        await supabase.from('user_roles').insert({
          user_id: userId,
          role_id: roleData.id,
          assigned_by: adminUser?.id
        });

        // 4. Update request status
        await supabase.from('role_requests').update({ status: 'approved' }).eq('id', requestId);
      } else {
        // Just update request status to rejected
        await supabase.from('role_requests').update({ status: 'rejected' }).eq('id', requestId);
      }

      // Remove from list
      setRequests(requests.filter(r => r.id !== requestId));
      
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (requests.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50/50 border-b border-gray-100">
            <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest w-1/3">Người dùng</th>
            <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest">Quyền yêu cầu</th>
            <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest">Thời gian</th>
            <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {requests.map((req) => (
            <tr key={req.id} className="hover:bg-blue-50/30 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0 border border-blue-200 shadow-sm overflow-hidden">
                    {req.user?.avatar ? (
                      <img src={req.user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      req.user?.full_name?.charAt(0).toUpperCase() || req.user?.email?.charAt(0).toUpperCase() || "U"
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{req.user?.full_name || "Chưa có tên"}</div>
                    <div className="text-xs text-gray-500">{req.user?.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border shadow-sm ${
                  req.requested_role === 'teacher' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  <ShieldAlert size={14} />
                  {req.requested_role === 'teacher' ? 'Giáo viên' : 'Người học'}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-gray-600">
                  {new Date(req.created_at).toLocaleDateString("vi-VN", {
                    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
                  })}
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleAction(req.id, req.user_id, req.requested_role, 'reject')}
                    disabled={processingId !== null}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                    title="Từ chối"
                  >
                    {processingId === req.id ? <Loader2 size={20} className="animate-spin" /> : <XCircle size={20} />}
                  </button>
                  <button
                    onClick={() => handleAction(req.id, req.user_id, req.requested_role, 'approve')}
                    disabled={processingId !== null}
                    className="p-2 text-green-600 hover:text-white hover:bg-green-600 rounded-xl transition-all disabled:opacity-50"
                    title="Phê duyệt"
                  >
                    {processingId === req.id ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
