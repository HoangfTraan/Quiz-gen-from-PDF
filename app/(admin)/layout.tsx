"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Users, 
  Files, 
  HelpCircle, 
  Activity, 
  PanelLeftClose, 
  Menu, 
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [userName, setUserName] = useState("Admin");
  const [userInitial, setUserInitial] = useState("A");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: dbUser } = await supabase
        .from("users")
        .select("full_name, avatar")
        .eq("id", user.id)
        .single();

      if (dbUser?.full_name) {
        setUserName(dbUser.full_name);
        setUserInitial(dbUser.full_name.charAt(0).toUpperCase());
      } else if (user.email) {
        setUserName(user.email);
        setUserInitial(user.email.charAt(0).toUpperCase());
      }
      if (dbUser?.avatar) setAvatarUrl(dbUser.avatar);
    };
    fetchUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const navigation = [
    { name: "Tổng quan", href: "/admin", icon: LayoutDashboard },
    { name: "Người dùng", href: "/admin/users", icon: Users },
    { name: "Tài liệu", href: "/admin/documents", icon: Files },
    { name: "Câu hỏi", href: "/admin/questions", icon: HelpCircle },
    { name: "Hồ sơ", href: "/admin/profile", icon: UserIcon },
    // { name: "Tiến trình AI", href: "/admin/ai-jobs", icon: Activity },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 font-sans text-gray-800">
      <aside
        className={`bg-gray-900 border-r border-gray-800 flex flex-col h-full shadow-lg z-10 hidden md:flex shrink-0 transition-all duration-500 ease-in-out relative overflow-hidden ${
          isSidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 border-r-0"
        }`}
      >
        <div className="w-64 min-w-[16rem] flex flex-col h-full relative">
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-all"
          >
            <PanelLeftClose size={20} />
          </button>

          <div className="p-6 border-b border-gray-800 pr-14 flex items-center gap-3">
            <ShieldCheck className="text-blue-500" size={28} />
            <h1 className="text-xl font-extrabold text-white leading-snug">Admin Panel</h1>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {navigation.map((item) => {
              // Xử lý active class đặc biệt cho thư mục root admin
              const isActive = item.href === "/admin" 
                 ? pathname === "/admin"
                 : pathname?.startsWith(item.href);
                 
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <item.icon size={20} className={isActive ? "text-white" : "text-gray-400"} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-800">
            {/* User info + role badge */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-950 flex items-center justify-center text-blue-400 font-bold shrink-0 overflow-hidden border border-blue-800 shadow-sm">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  userInitial
                )}
              </div>
              <div className="overflow-hidden flex-1">
                <p
                  className="font-semibold text-sm text-gray-200 truncate"
                  title={userName}
                >
                  {userName}
                </p>
                {/* Role badge */}
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-purple-900/30 border-purple-500/30 text-purple-300 mt-0.5"
                >
                  <ShieldCheck size={10} />
                  Admin
                </span>
                <button
                  onClick={handleLogout}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 mt-1.5 hover:underline"
                >
                  <LogOut size={12} /> Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="hidden md:flex absolute top-6 left-6 z-40 p-2.5 bg-gray-900 shadow-md text-gray-400 hover:text-white border border-gray-800 rounded-xl transition-all"
        >
          <Menu size={24} />
        </button>
      )}

      <main className="flex-1 p-6 lg:p-10 relative overflow-y-auto h-full text-gray-900">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
