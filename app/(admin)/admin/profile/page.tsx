"use client";

import { User, Mail, Shield, Save, Loader2, Trash2, Camera } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import ConfirmModal from "@/components/ConfirmModal";

export default function AdminProfilePage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initial, setInitial] = useState("A");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || "");
        const { data: dbUser } = await supabase
          .from('users')
          .select('full_name, avatar')
          .eq('id', user.id)
          .single();
        
        if (dbUser) {
          if (dbUser.full_name) {
            setFullName(dbUser.full_name);
            setInitial(dbUser.full_name.charAt(0).toUpperCase());
          } else {
            setInitial(user.email ? user.email.charAt(0).toUpperCase() : "A");
          }
          if (dbUser.avatar) {
            setAvatarUrl(dbUser.avatar);
          }
        }
      }
      setLoading(false);
    }
    loadProfile();
  }, [supabase]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Lỗi: Vui lòng chọn tệp hình ảnh.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage("Lỗi: Kích thước ảnh không được vượt quá 2MB.");
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Chưa đăng nhập");

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar_${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        if (uploadError.message.includes("not found")) {
          throw new Error("Cần tạo bucket 'avatars' trong Supabase Storage.");
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      await saveAvatarUrl(user.id, publicUrl);
      
      setMessage("Cập nhật ảnh đại diện thành công!");
    } catch (err: any) {
      console.error("Lỗi upload avatar:", err);
      let errorMessage = "Lỗi tải ảnh. ";
      if (err.message.includes("bucket")) {
        errorMessage += "Vui lòng yêu cầu Admin tạo bucket 'avatars' trong Supabase.";
      } else if (err.message.includes("mime type")) {
        errorMessage += "Định dạng ảnh này không được hỗ trợ bởi Bucket.";
      } else {
        errorMessage += err.message;
      }
      setMessage("Lỗi: " + errorMessage);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveAvatarUrl = async (userId: string, url: string) => {
    const { error } = await supabase
      .from('users')
      .update({ avatar: url })
      .eq('id', userId);
    
    if (error) throw error;
    setAvatarUrl(url);
  };

  const handleRemoveAvatar = async () => {
    if (!avatarUrl) return;
    
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Chưa đăng nhập");

      try {
        const urlParts = avatarUrl.split('/avatars/');
        if (urlParts.length > 1) {
          const storagePath = urlParts[1];
          await supabase.storage.from('avatars').remove([storagePath]);
        }
      } catch (storageErr) {
        console.warn("Could not delete file from storage:", storageErr);
      }

      await supabase.from('users').update({ avatar: null }).eq('id', user.id);
      setAvatarUrl(null);
      setMessage("Đã xóa ảnh đại diện.");
    } catch (err: any) {
      setMessage("Lỗi: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Chưa đăng nhập");

      if (fullName.trim()) {
        await supabase.from('users').update({ full_name: fullName.trim() }).eq('id', user.id);
        setInitial(fullName.trim().charAt(0).toUpperCase());
      }
      
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
    return (
      <div className="flex justify-center mt-20">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Hồ sơ Admin</h1>
        <p className="text-sm text-gray-400 mt-1">Cập nhật thông tin cá nhân và quản lý bảo mật tài khoản quản trị</p>
      </div>

      <div className="bg-white p-8 md:p-10 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-10 items-start mt-8">
        <div className="flex flex-col items-center gap-4 w-full md:w-1/3 group">
          <div className="relative">
            <div className="w-40 h-40 bg-gradient-to-br from-blue-50 to-indigo-50 border-4 border-white shadow-xl rounded-full flex justify-center items-center overflow-hidden transition-transform group-hover:scale-105 duration-500">
              {uploading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
                  <Loader2 className="animate-spin text-blue-600" size={32} />
                </div>
              )}
              
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-6xl font-black text-blue-600/30 select-none">{initial}</span>
              )}
            </div>
            
            <button 
              onClick={handleAvatarClick}
              disabled={uploading}
              className="absolute bottom-1 right-1 p-3 bg-blue-600 text-white rounded-2xl shadow-lg hover:bg-blue-700 transition-all active:scale-90 flex items-center justify-center border-4 border-white"
              title="Thay đổi ảnh"
            >
              <Camera size={20} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-1 mt-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleAvatarChange} 
              className="hidden" 
              accept="image/*" 
            />
            <button 
              onClick={handleAvatarClick}
              disabled={uploading}
              className="text-sm text-blue-600 font-extrabold uppercase tracking-wider hover:text-blue-800 transition-colors"
            >
              Cập nhật ảnh
            </button>
            {avatarUrl && (
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                disabled={uploading || saving}
                className="text-xs text-red-500 font-extrabold uppercase tracking-wider hover:text-red-700 flex items-center gap-1.5 mt-2 transition-all hover:scale-105 active:scale-95 bg-red-50 px-3 py-2 rounded-xl border border-red-100 shadow-sm"
              >
                <Trash2 size={12} /> Xóa ảnh hiện tại
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 w-full space-y-6 pt-2">
          {message && (
            <div className={`p-4 rounded-xl text-sm font-bold animate-in fade-in slide-in-from-top-2 ${message.startsWith("Lỗi") ? "bg-red-50 text-red-700 border border-red-100" : "bg-green-50 text-green-700 border border-green-100"}`}>
              {message}
            </div>
          )}
          
          <div className="grid grid-cols-1 gap-6">
            <div className="relative group">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1 transition-colors group-focus-within:text-blue-500">
                <User size={14} /> Họ và Tên
              </label>
              <input 
                type="text" 
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Nhập họ và tên của bạn..."
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 focus:bg-white outline-none transition-all font-semibold text-gray-800" 
              />
            </div>

            <div className="relative group">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1 transition-colors group-focus-within:text-blue-500">
                <Mail size={14} /> Địa chỉ Email
              </label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 focus:bg-white outline-none transition-all font-semibold text-gray-800" 
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 active:scale-95 disabled:bg-gray-300 disabled:shadow-none"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} LƯU THÔNG TIN
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 md:p-10 rounded-2xl border border-gray-100 shadow-sm mt-8">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
          <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
            <Shield size={20} />
          </div>
          Bảo mật & Mật khẩu
        </h2>
        
        <div className="space-y-5 max-w-md">
          <div className="space-y-4">
            <input type="password" placeholder="Mật khẩu hiện tại" className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-4 focus:ring-orange-50/50 focus:border-orange-500 focus:bg-white outline-none transition-all font-medium text-gray-800" />
            <input type="password" placeholder="Mật khẩu mới" className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-4 focus:ring-orange-50/50 focus:border-orange-500 focus:bg-white outline-none transition-all font-medium text-gray-800" />
            <input type="password" placeholder="Xác nhận mật khẩu mới" className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-4 focus:ring-orange-50/50 focus:border-orange-500 focus:bg-white outline-none transition-all font-medium text-gray-800" />
          </div>
          <button className="w-full bg-gray-900 hover:bg-black text-white px-6 py-4 rounded-xl font-bold text-sm tracking-wider transition-all hover:shadow-lg active:scale-95">
            CẬP NHẬT MẬT KHẨU
          </button>
        </div>
      </div>

      <ConfirmModal 
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleRemoveAvatar}
        title="Xóa ảnh đại diện"
        message="Bạn có chắc chắn muốn gỡ bỏ ảnh đại diện hiện tại không? Hành động này không thể hoàn tác."
        confirmText="XÓA NGAY"
        cancelText="Để tôi xem lại"
        isDestructive={true}
      />
    </div>
  );
}
