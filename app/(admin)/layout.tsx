"use client";

import { useState } from "react";
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
  LayoutDashboard
} from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const pathname = usePathname();

  const navigation = [
    { name: "Tổng quan", href: "/admin", icon: LayoutDashboard },
    { name: "Người dùng", href: "/admin/users", icon: Users },
    { name: "Tài liệu", href: "/admin/documents", icon: Files },
    { name: "Câu hỏi", href: "/admin/questions", icon: HelpCircle },
    { name: "Tiến trình AI", href: "/admin/ai-jobs", icon: Activity },
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
             <Link href="/dashboard" className="block text-center text-sm text-gray-400 hover:text-white py-2 rounded-lg border border-gray-700 hover:bg-gray-800">
               Trang Người dùng
             </Link>
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
