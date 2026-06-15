import { Users, Files, FileText, Activity } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  
  const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
  const { count: docsCount } = await supabase.from('documents').select('*', { count: 'exact', head: true });
  const { count: quizzesCount } = await supabase.from('quizzes').select('*', { count: 'exact', head: true });
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count: quizzesToday } = await supabase
    .from('quizzes')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString());
  

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Tổng quan Hệ thống</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-semibold">Tổng User</h3>
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Users size={20}/></div>
          </div>
          <p className="text-3xl font-black text-gray-800">{usersCount || 0}</p>
          <p className="text-sm text-gray-500 font-medium mt-2">Toàn hệ thống</p>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-semibold">Tài liệu</h3>
            <div className="p-3 bg-purple-100 text-purple-600 rounded-xl"><Files size={20}/></div>
          </div>
          <p className="text-3xl font-black text-gray-800">{docsCount || 0}</p>
          <p className="text-sm text-gray-500 font-medium mt-2">Toàn hệ thống</p>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-semibold">Total Quiz</h3>
            <div className="p-3 bg-orange-100 text-orange-600 rounded-xl"><FileText size={20}/></div>
          </div>
          <p className="text-3xl font-black text-gray-800">{quizzesCount || 0}</p>
          <p className="text-sm text-green-600 font-semibold mt-2">
            +{quizzesToday || 0} bộ đề mới hôm nay
          </p>
        </div>
      </div>

    </div>
  );
}
