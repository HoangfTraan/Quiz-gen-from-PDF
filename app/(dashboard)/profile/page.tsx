"use client";

import { User, Mail, Shield, Save, Loader2, Image as ImageIcon, Trash2, Camera } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import ConfirmModal from "@/components/ConfirmModal";

export default function ProfilePage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initial, setInitial] = useState("U");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [message, setMessage] = useState("");
  
  // States for Role Requests
  const [currentRole, setCurrentRole] = useState("Người dùng");
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [requestedRole, setRequestedRole] = useState("teacher");
  const [requestingRole, setRequestingRole] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || "");
        const { data: dbUser } = await supabase
          .from('users')
          .select('full_name, avatar, role')
          .eq('id', user.id)
          .single();
        
        if (dbUser) {
          if (dbUser.full_name) {
            setFullName(dbUser.full_name);
            setInitial(dbUser.full_name.charAt(0).toUpperCase());
          } else {
            setInitial(user.email ? user.email.charAt(0).toUpperCase() : "U");
          }
          if (dbUser.avatar) {
            setAvatarUrl(dbUser.avatar);
          }

          // Fetch current user roles
          const { data: userRoles } = await supabase
            .from('user_roles')
            .select('roles(name)')
            .eq('user_id', user.id);
            
          let roleDisplay = "Người dùng";
          if (dbUser.role === 'admin') {
            roleDisplay = "Admin";
          } else if (userRoles && userRoles.length > 0) {
             const roles = userRoles.map(ur => Array.isArray(ur.roles) ? ur.roles[0]?.name : (ur.roles as any)?.name);
             if (roles.includes("teacher")) roleDisplay = "Giáo viên";
             else if (roles.includes("learner")) roleDisplay = "Người học";
          }
          setCurrentRole(roleDisplay);
        }

        // Fetch any pending role requests (wrap in try-catch to avoid errors if table doesn't exist yet)
        try {
          const { data: requests } = await supabase
            .from('role_requests')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (requests && requests.length > 0) {
            setPendingRequest(requests[0]);
          }
        } catch (e) {
          console.warn("role_requests table might not exist yet:", e);
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

    // 1. Validation
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

      // 2. Upload to Storage
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
      window.dispatchEvent(new Event("user_profile_updated"));
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

      // 1. Try to extract path from URL and delete from storage
      try {
        const urlParts = avatarUrl.split('/avatars/');
        if (urlParts.length > 1) {
          const storagePath = urlParts[1];
          await supabase.storage.from('avatars').remove([storagePath]);
        }
      } catch (storageErr) {
        console.warn("Could not delete file from storage:", storageErr);
      }

      // 2. Clear from DB
      await supabase.from('users').update({ avatar: null }).eq('id', user.id);
      setAvatarUrl(null);
      window.dispatchEvent(new Event("user_profile_updated"));
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

      // Cập nhật tên vào bảng users
      if (fullName.trim()) {
        await supabase.from('users').update({ full_name: fullName.trim() }).eq('id', user.id);
        setInitial(fullName.trim().charAt(0).toUpperCase());
      }
      // Bỏ qua cập nhật email do Supabase chặn các email giả (test@gmail.com)
      setMessage("Lưu thông tin cá nhân thành công.");
      
      // Kích hoạt event để layout tải lại thông tin ngay lập tức
      window.dispatchEvent(new Event("user_profile_updated"));
    } catch (e: any) {
      setMessage("Lỗi: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRoleRequest = async () => {
    setRequestingRole(true);
    setMessage("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Chưa đăng nhập");

      const { error } = await supabase.from('role_requests').insert({
        user_id: user.id,
        requested_role: requestedRole
      });

      if (error) throw error;
      
      setMessage("Yêu cầu đổi quyền đã được gửi thành công. Vui lòng chờ Admin phê duyệt.");
      setPendingRequest({ requested_role: requestedRole, status: 'pending' });
    } catch (e: any) {
      console.error(e);
      let errorMsg = e.message;
      if (errorMsg?.includes('role_requests')) {
        errorMsg = "Bảng dữ liệu yêu cầu quyền chưa được khởi tạo. Vui lòng liên hệ Admin.";
      }
      setMessage("Lỗi: " + errorMsg);
    } finally {
      setRequestingRole(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
  }

  return (
    <div className="animate-page-fade max-w-3xl mx-auto py-8">
      <h1 className="text-3xl font-black text-gray-900 mb-8 tracking-tight">Hồ sơ cá nhân</h1>

      <div className="bg-white p-10 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col md:flex-row gap-10 items-start mb-10 transition-all hover:shadow-2xl hover:shadow-gray-200/60">
        <div className="flex flex-col items-center gap-4 w-full md:w-1/3 group">
          <div className="relative">
            <div className="w-40 h-40 bg-gradient-to-br from-blue-50 to-indigo-50 border-4 border-white shadow-xl rounded-full flex justify-center items-center overflow-hidden transition-transform group-hover:scale-105 duration-500">
              {uploading ? (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
                  <Loader2 className="animate-spin text-blue-600" size={32} />
                </div>
              ) : null}
              
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
              className="text-sm text-blue-600 font-black uppercase tracking-widest hover:text-blue-800 transition-colors"
            >
              Cập nhật ảnh
            </button>
            {avatarUrl && (
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                disabled={uploading || saving}
                className="text-xs text-red-500 font-black uppercase tracking-widest hover:text-red-700 flex items-center gap-1.5 mt-2 transition-all hover:scale-105 active:scale-95 bg-red-50 px-3 py-2 rounded-xl border border-red-100 shadow-sm"
              >
                <Trash2 size={12} /> Xóa ảnh hiện tại
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 w-full space-y-6 pt-2">
          {message && (
             <div className={`p-4 rounded-2xl text-sm font-bold animate-in fade-in slide-in-from-top-2 ${message.startsWith("Lỗi") ? "bg-red-50 text-red-700 border border-red-100" : "bg-green-50 text-green-700 border border-green-100"}`}>
               {message}
             </div>
          )}
          
          <div className="grid grid-cols-1 gap-6">
            <div className="relative group">
              <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1 transition-colors group-focus-within:text-blue-500">
                <User size={14} /> Họ và Tên
              </label>
              <input 
                type="text" 
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Nhập họ và tên của bạn..."
                className="w-full px-5 py-3.5 bg-gray-50 border-2 border-gray-50 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 focus:bg-white outline-none transition-all font-bold text-gray-800 shadow-inner" 
              />
            </div>

            <div className="relative group">
              <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1 transition-colors group-focus-within:text-blue-500">
                <Mail size={14} /> Địa chỉ Email
              </label>
              <input 
                type="email" 
                value={email}
                readOnly
                title="Không thể thay đổi địa chỉ email đã đăng ký"
                className="w-full px-5 py-3.5 bg-gray-100 border-2 border-gray-100 rounded-2xl focus:outline-none text-gray-500 font-bold shadow-inner cursor-not-allowed opacity-70" 
              />
              <p className="mt-2 text-xs text-amber-600 font-medium flex items-center gap-1">
                * Email dùng để đăng nhập nên không thể tự thay đổi.
              </p>
            </div>
          </div>

          <div className="pt-4">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-200 transition-all hover:-translate-y-1 active:scale-95 disabled:bg-gray-300 disabled:shadow-none"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} LƯU THÔNG TIN
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 transition-all hover:shadow-2xl">
        <h2 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-3">
          <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
            <Shield size={20} />
          </div>
          Bảo mật & Mật khẩu
        </h2>
        
        <div className="space-y-5 max-w-md">
          <div className="space-y-4">
            <input type="password" placeholder="Mật khẩu hiện tại" className="w-full px-5 py-3.5 bg-gray-50 border-2 border-gray-50 rounded-xl focus:ring-4 focus:ring-orange-50 focus:border-orange-500 focus:bg-white outline-none transition-all font-medium text-gray-800" />
            <input type="password" placeholder="Mật khẩu mới" className="w-full px-5 py-3.5 bg-gray-50 border-2 border-gray-50 rounded-xl focus:ring-4 focus:ring-orange-50 focus:border-orange-500 focus:bg-white outline-none transition-all font-medium text-gray-800" />
            <input type="password" placeholder="Xác nhận mật khẩu mới" className="w-full px-5 py-3.5 bg-gray-50 border-2 border-gray-50 rounded-xl focus:ring-4 focus:ring-orange-50 focus:border-orange-500 focus:bg-white outline-none transition-all font-medium text-gray-800" />
          </div>
          <button className="w-full bg-gray-900 hover:bg-black text-white px-6 py-4 rounded-2xl font-black text-sm tracking-widest transition-all hover:shadow-xl active:scale-95">
            CẬP NHẬT MẬT KHẨU
          </button>
        </div>
      </div>

      <div className="bg-white p-10 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 transition-all hover:shadow-2xl mt-10">
        <h2 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-3">
          <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
            <Shield size={20} />
          </div>
          Phân quyền tài khoản
        </h2>
        
        <div className="space-y-5 max-w-md">
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
            <p className="text-sm text-gray-500 font-bold mb-1 uppercase tracking-wider text-[10px]">Quyền hiện tại</p>
            <p className="font-black text-lg text-purple-700">{currentRole}</p>
          </div>
          
          {pendingRequest ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-sm font-bold text-yellow-800">
                Đang chờ phê duyệt quyền: <span className="uppercase text-yellow-900 ml-1">{pendingRequest.requested_role === 'teacher' ? 'Giáo viên' : 'Người học'}</span>
              </p>
              <p className="text-xs text-yellow-700 mt-2 font-medium">Admin sẽ xem xét và phản hồi yêu cầu của bạn sớm nhất.</p>
            </div>
          ) : (
             <div className="space-y-4">
               <label className="block text-sm font-bold text-gray-700">Yêu cầu thay đổi quyền</label>
               <select 
                 value={requestedRole} 
                 onChange={e => setRequestedRole(e.target.value)}
                 className="w-full px-5 py-3.5 bg-gray-50 border-2 border-gray-50 rounded-xl focus:ring-4 focus:ring-purple-50 focus:border-purple-500 focus:bg-white outline-none transition-all font-bold text-gray-800 cursor-pointer"
               >
                 <option value="teacher">Giáo viên (Tạo, xem, kiểm duyệt đề)</option>
                 <option value="learner">Người học (Chỉ tạo đề, làm bài, xem điểm)</option>
               </select>
               
               {/* Disabled logic: disable if they are already that role */}
               <button 
                 onClick={handleRoleRequest}
                 disabled={requestingRole || (currentRole === "Giáo viên" && requestedRole === "teacher") || (currentRole === "Người học" && requestedRole === "learner") || currentRole === "Admin"}
                 className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-2xl font-black text-sm tracking-widest transition-all hover:shadow-xl hover:shadow-purple-200 active:scale-95 disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none flex items-center justify-center gap-2"
               >
                 {requestingRole ? <Loader2 size={18} className="animate-spin" /> : null}
                 {currentRole === "Admin" ? "BẠN ĐÃ LÀ ADMIN" : "GỬI YÊU CẦU ĐỔI QUYỀN"}
               </button>
             </div>
          )}
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
