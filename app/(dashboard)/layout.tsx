"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
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
  ShieldCheck,
  GraduationCap,
  BookMarked,
  BarChart,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { AppRole } from "@/utils/rbac";
import { getRoleLabel, getRoleBadgeClass } from "@/utils/rbac";

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState("Người dùng");
  const [userInitial, setUserInitial] = useState("U");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<AppRole>("user");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  // Thêm logic Auto-refresh toàn cục cho Dashboard
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const pollInterval = setInterval(() => {
      router.refresh();
    }, 15000); // 15 seconds

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(pollInterval);
    };
  }, [router]);

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let currentUserId: string | null = null;

    const fetchUserData = async () => {
      if (!currentUserId || !isMounted) return;

      const { data: dbUser } = await supabase
        .from("users")
        .select("full_name, email, role, avatar")
        .eq("id", currentUserId)
        .single();

      if (!isMounted) return;

      if (dbUser?.full_name) {
        setUserName(dbUser.full_name);
        setUserInitial(dbUser.full_name.charAt(0).toUpperCase());
      } else if (dbUser?.email) {
        const email = dbUser.email || "Người dùng";
        setUserName(email);
        setUserInitial(email.charAt(0).toUpperCase());
      }
      if (dbUser?.avatar) setAvatarUrl(dbUser.avatar);

      if (dbUser?.role === "admin") {
        setUserRole("admin");
        return;
      }

      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("roles(name)")
        .eq("user_id", currentUserId);

      if (!isMounted) return;

      if (userRoles && userRoles.length > 0) {
        const roleNames = userRoles
          .map((ur: any) => {
            const roleObj = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
            return roleObj?.name;
          })
          .filter(Boolean) as string[];
        if (roleNames.includes("teacher")) {
          setUserRole("teacher");
          return;
        }
        if (roleNames.includes("learner")) {
          setUserRole("learner");
          return;
        }
      }
      setUserRole("user");
    };

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;
      currentUserId = user.id;

      await fetchUserData();

      if (!isMounted) return;

      channel = supabase
        .channel(`layout_user_${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "users", filter: `id=eq.${user.id}` },
          () => { fetchUserData(); }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
          () => { fetchUserData(); }
        )
        .on(
          "broadcast",
          { event: "role_updated" },
          () => { fetchUserData(); }
        )
        .subscribe();

      // Fallback/Immediate update for local profile changes
      window.addEventListener("user_profile_updated", fetchUserData);
    };

    init();

    return () => {
      isMounted = false;
      window.removeEventListener("user_profile_updated", fetchUserData);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  // Menu điều hướng — ẩn "Lịch sử thi" nếu không phải learner
  const navigation = [
    { name: "Tổng quan", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "teacher", "learner", "user"] },
    { name: "Tài liệu", href: "/documents", icon: Files, roles: ["teacher", "learner", "user"] },
    { name: "Bộ câu hỏi", href: "/quizzes", icon: BookOpen, roles: ["teacher", "learner", "user"] },
    { name: "Lịch sử thi", href: "/history", icon: History, roles: ["learner"] },
    { name: "Kết quả thi", href: "/teacher-results", icon: BarChart, roles: ["teacher", "admin"] },
    { name: "Câu hỏi báo lỗi", href: "/reported-questions", icon: ShieldCheck, roles: ["teacher", "admin"] },
    { name: "Hồ sơ", href: "/profile", icon: UserIcon, roles: ["admin", "teacher", "learner", "user"] },
  ].filter((item) => item.roles.includes(userRole));

  // Bottom nav items (max 5 for mobile)
  const bottomNavItems = navigation.slice(0, 5);

  // Thông báo lỗi khi bị chặn route
  const routeError = searchParams.get("error");

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans text-gray-800">
      {/* DESKTOP SIDEBAR — hidden on mobile */}
      <aside
        className={`bg-white border-r border-gray-200 flex-col h-full shadow-sm z-10 hidden md:flex shrink-0 transition-all duration-500 ease-in-out relative overflow-hidden ${
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
            <Link
              href="/"
              className="text-xl font-extrabold text-blue-700 block mb-6 leading-snug"
            >
              QuizGen
            </Link>
            {/* Nút MỚI: ẩn với admin (admin dùng trang /admin riêng) */}
            {userRole !== "admin" && (
              <Link
                href="/documents/upload"
                className="w-full py-3 mb-2 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-sm bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30 hover:shadow-lg"
              >
                <PlusCircle size={20} /> MỚI
              </Link>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname?.startsWith(item.href + "/");
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
                  <item.icon
                    size={20}
                    className={isActive ? "text-blue-600" : "text-gray-500"}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-100">
            {userRole === "admin" && (
              <Link
                href="/admin"
                className="flex items-center gap-2 mb-3 px-3 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-sm font-bold transition-colors"
              >
                <ShieldCheck size={16} /> Vào trang Quản trị
              </Link>
            )}

            {/* User info + role badge */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0 overflow-hidden border border-gray-100 shadow-sm">
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
                  className="font-semibold text-sm truncate"
                  title={userName}
                >
                  {userName}
                </p>
                {/* Role badge */}
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border mt-0.5 ${getRoleBadgeClass(userRole)}`}
                >
                  {userRole === "teacher" && <BookMarked size={10} />}
                  {userRole === "learner" && <GraduationCap size={10} />}
                  {getRoleLabel(userRole)}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-xs text-red-500 hover:underline flex items-center gap-1 mt-1"
                >
                  <LogOut size={12} /> Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Desktop Hamburger Button (when sidebar closed) */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="hidden md:flex absolute top-6 left-6 z-40 p-2.5 bg-white shadow-md text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 rounded-xl transition-all"
        >
          <Menu size={24} />
        </button>
      )}

      {/* MOBILE HEADER — visible only on mobile */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/" className="text-lg font-extrabold text-blue-700">
            QuizGen
          </Link>
          <div className="flex items-center gap-2">
            {userRole !== "admin" && (
              <Link
                href="/documents/upload"
                className="p-2 bg-blue-600 text-white rounded-lg shadow-sm"
              >
                <PlusCircle size={18} />
              </Link>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE SLIDE-OUT DRAWER */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <div className="md:hidden fixed top-0 right-0 bottom-0 z-50 w-72 bg-white shadow-2xl animate-slide-in-right flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <span className="font-extrabold text-gray-800">Menu</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* User info */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0 overflow-hidden border border-gray-100">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    userInitial
                  )}
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="font-semibold text-sm truncate">{userName}</p>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border mt-0.5 ${getRoleBadgeClass(userRole)}`}
                  >
                    {userRole === "teacher" && <BookMarked size={10} />}
                    {userRole === "learner" && <GraduationCap size={10} />}
                    {getRoleLabel(userRole)}
                  </span>
                </div>
              </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {navigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <item.icon
                      size={20}
                      className={isActive ? "text-blue-600" : "text-gray-400"}
                    />
                    {item.name}
                  </Link>
                );
              })}

              {userRole === "admin" && (
                <Link
                  href="/admin"
                  className="flex items-center gap-3 px-3 py-3 rounded-xl font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
                >
                  <ShieldCheck size={20} className="text-purple-600" />
                  Vào trang Quản trị
                </Link>
              )}
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl font-bold text-sm transition-colors"
              >
                <LogOut size={16} /> Đăng xuất
              </button>
            </div>
          </div>
        </>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-around h-16 px-1">
          {bottomNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg transition-colors ${
                  isActive
                    ? "text-blue-600"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-[10px] font-semibold leading-tight ${isActive ? "font-bold" : ""}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
        {/* Safe area for phones with home bar */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 relative overflow-y-auto h-full pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6">
          {/* Banner thông báo nếu bị chặn route */}
          {routeError === "learner_only" && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-medium flex items-center gap-2">
              <GraduationCap size={18} className="text-amber-600 shrink-0" />
              Tính năng này chỉ dành cho <strong>Người học</strong>. Liên hệ
              admin để được cấp quyền.
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50"><div className="animate-pulse text-gray-400">Đang tải...</div></div>}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
