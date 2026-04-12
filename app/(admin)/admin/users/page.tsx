import { Search } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  let users: any[] = [];
  
  const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
  if (data) users = data;

  return (
    <div className="animate-slide-in-left">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Quản lý Người dùng</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
           <div className="relative max-w-sm">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input type="text" placeholder="Tìm người dùng..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
           </div>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tên KH</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vai trò</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Thao tác</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
             {users.map(u => (
               <tr key={u.id}>
                 <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{u.full_name || "Không rõ"}</td>
                 <td className="px-6 py-4 whitespace-nowrap text-gray-600">{u.email}</td>
                 <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 py-1 text-xs rounded-full font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>{String(u.role).toUpperCase()}</span></td>
                 <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 py-1 text-xs rounded-full font-bold bg-green-100 text-green-700`}>Hoạt động</span></td>
                 <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                   <button className="text-blue-600 hover:underline">Sửa</button>
                 </td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
