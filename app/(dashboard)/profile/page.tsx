"use client";

import { User, Mail, Shield, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function ProfilePage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [initial, setInitial] = useState("U");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || "");
        const { data: dbUser } = await supabase.from('users').select('full_name').eq('id', user.id).single();
        if (dbUser?.full_name) {
          setFullName(dbUser.full_name);
          setInitial(dbUser.full_name.charAt(0).toUpperCase());
        } else {
          setInitial(user.email ? user.email.charAt(0).toUpperCase() : "U");
        }
      }
      setLoading(false);
    }
    loadProfile();
  }, [supabase]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Chưa đăng nhập");

      // Cập nhật tên vào bảng users
      if (fullName.trim()) {
        await supabase.from('users').update({ full_name: fullName.trim() }).eq('id', user.id);
        setInitial(fullName.trim().charAt(0).toUpperCase());
      }
      
      // Cập nhật email trong Supabase Auth
      if (email.trim() && email !== user.email) {
        const { error } = await supabase.auth.updateUser({ email: email.trim() });
        if (error) throw error;
        setMessage("Cập nhật thành công! (Vui lòng kiểm tra hòm thư email mới để xác nhận nếu được yêu cầu)");
      } else {
        setMessage("Lưu thông tin cá nhân thành công.");
      }
    } catch (e: any) {
      setMessage("Lỗi: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
  }

  return (
    <div className="animate-slide-in-left max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold text-gray-800 mb-6 border-b pb-4">Hồ sơ cá nhân</h1>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8 items-start mb-8">
        <div className="flex flex-col items-center gap-3 w-full md:w-1/3">
          <div className="w-32 h-32 bg-blue-100 text-blue-600 rounded-full flex justify-center items-center text-5xl font-black">
            {initial}
          </div>
          <button className="text-sm text-blue-600 font-semibold hover:underline">Thay đổi ảnh đại diện</button>
        </div>

        <div className="flex-1 w-full space-y-5">
          {message && (
             <div className={`p-3 rounded-lg text-sm font-medium ${message.startsWith("Lỗi") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
               {message}
             </div>
          )}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <User size={16} /> Họ và Tên
            </label>
            <input 
              type="text" 
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Nhập họ và tên..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <Mail size={16} /> Địa chỉ Email
            </label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Nhập địa chỉ email..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>

          <div>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 disabled:bg-gray-400"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Lưu thay đổi
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Shield size={20} className="text-orange-500" /> Đổi mật khẩu
        </h2>
        
        <div className="space-y-4 max-w-sm">
          <input type="password" placeholder="Mật khẩu hiện tại" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
          <input type="password" placeholder="Mật khẩu mới" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
          <input type="password" placeholder="Xác nhận mật khẩu mới" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
          <button className="bg-gray-800 hover:bg-black text-white px-5 py-2 mt-2 rounded-lg font-bold">Cập nhật mật khẩu</button>
        </div>
      </div>
    </div>
  );
}
