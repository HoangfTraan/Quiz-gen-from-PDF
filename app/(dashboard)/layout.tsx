"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  BookOpen, 
  History, 
  PlusCircle, 
  PanelLeftClose, 
  Menu, 
  LayoutDashboard,
  Files,
  User as UserIcon,
  LogOut,
  ShieldCheck
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [userName, setUserName] = useState("Người dùng");
  const [userInitial, setUserInitial] = useState("U");
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: dbUser } = await supabase.from('users').select('full_name, role').eq('id', user.id).single();
        if (dbUser?.full_name) {
           setUserName(dbUser.full_name);
           setUserInitial(dbUser.full_name.charAt(0).toUpperCase());
        } else if (user.email) {
           setUserName(user.email);
           setUserInitial(user.email.charAt(0).toUpperCase());
        }
        if (dbUser?.role === 'admin') {
           setIsAdmin(true);
        }
      }
    };
    fetchUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const navigation = [
    { name: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
    { name: "Tài liệu của tôi", href: "/documents", icon: Files },
    { name: "Bộ câu hỏi", href: "/quizzes", icon: BookOpen },
    { name: "Lịch sử thi", href: "/history", icon: History },
    { name: "Hồ sơ", href: "/profile", icon: UserIcon },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans text-gray-800">
      {/* SIDEBAR */}
      <aside
        className={`bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10 hidden md:flex shrink-0 transition-all duration-500 ease-in-out relative overflow-hidden ${
          isSidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 border-r-0"
        }`}
      >
        <div className="w-64 min-w-[16rem] flex flex-col h-full relative">
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="absolute top-4 right-4 p-2 bg-white text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl transition-all shadow-sm"
          >
            <PanelLeftClose size={20} />
          </button>

          <div className="p-5 border-b border-gray-100 pr-14">
            <Link href="/" className="text-xl font-extrabold text-blue-700 block mb-6 leading-snug">
              QuizGen
            </Link>
            <Link
              href="/documents/upload"
              className="w-full py-3 mb-2 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-sm bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30 hover:shadow-lg"
            >
              <PlusCircle size={20} /> MỚI
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <item.icon size={20} className={isActive ? "text-blue-600" : "text-gray-500"} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          
          <div className="p-4 border-t border-gray-100">
            {isAdmin && (
              <Link href="/admin" className="flex items-center gap-2 mb-3 px-3 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-sm font-bold transition-colors">
                <ShieldCheck size={16} /> Vào trang Quản trị
              </Link>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">
                {userInitial}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="font-semibold text-sm truncate" title={userName}>{userName}</p>
                <button onClick={handleLogout} className="text-xs text-red-500 hover:underline flex items-center gap-1 mt-0.5">
                  <LogOut size={12} /> Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Nút Hamburger Mở Sidebar (Nổi góc trái) */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="hidden md:flex absolute top-6 left-6 z-40 p-2.5 bg-white shadow-md text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 rounded-xl transition-all"
        >
          <Menu size={24} />
        </button>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-6 relative overflow-y-auto h-full">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
