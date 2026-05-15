"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, FileText, CheckCircle, GraduationCap } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { AppRole } from "@/utils/rbac";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole>("user");
  const [docsCount, setDocsCount] = useState(0);
  const [quizzesCount, setQuizzesCount] = useState(0);
  const [attemptsCount, setAttemptsCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let channel: any;

    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Lấy role của user hiện tại
      const { data: dbUser } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      let currentRole: AppRole = "user";
      if (dbUser?.role === "admin") {
        currentRole = "admin";
      } else {
        const { data: userRoles } = await supabase
          .from("user_roles")
          .select("roles(name)")
          .eq("user_id", user.id);

        if (userRoles && userRoles.length > 0) {
          const roleNames = userRoles
            .map((ur: any) => {
              const roleObj = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
              return roleObj?.name;
            })
            .filter(Boolean) as string[];

          if (roleNames.includes("teacher")) currentRole = "teacher";
          else if (roleNames.includes("learner")) currentRole = "learner";
        }
      }
      setRole(currentRole);

      // 2. Định nghĩa hàm fetch dữ liệu thống kê song song
      const fetchCounts = async () => {
        if (currentRole === "learner") {
          // Chạy đồng thời cả 3 truy vấn cho người học
          const [docsRes, quizzesRes, attemptsRes] = await Promise.all([
            supabase
              .from('documents')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id),
            supabase
              .from('quizzes')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id),
            supabase
              .from('quiz_attempts')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
          ]);

          setDocsCount(docsRes.count || 0);
          setQuizzesCount(quizzesRes.count || 0);
          setAttemptsCount(attemptsRes.count || 0);
        } else {
          // Chạy đồng thời 2 truy vấn cho Giáo viên / Admin / Người dùng thường
          const [docsRes, quizzesRes] = await Promise.all([
            supabase
              .from('documents')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id),
            supabase
              .from('quizzes')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
          ]);

          setDocsCount(docsRes.count || 0);
          setQuizzesCount(quizzesRes.count || 0);
        }
      };

      await fetchCounts();
      setLoading(false);

      // 3. Đăng ký nhận sự thay đổi realtime với tên channel ngẫu nhiên tránh lỗi Strict Mode
      const uniqueChannelName = `dashboard_realtime_${user.id}_${Math.random().toString(36).substring(2, 9)}`;
      channel = supabase
        .channel(uniqueChannelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'documents', filter: `user_id=eq.${user.id}` },
          () => { fetchCounts(); }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'quizzes', filter: `user_id=eq.${user.id}` },
          () => { fetchCounts(); }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'quiz_attempts', filter: `user_id=eq.${user.id}` },
          () => { fetchCounts(); }
        )
        .subscribe();
    };

    loadData();

    return () => {
      if (channel) {
        const supabase = createClient();
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Giao diện loading shimmer cao cấp
  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-24 bg-gray-100 rounded-lg" />
                <div className="h-6 w-12 bg-gray-200 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Grid columns động dựa theo role
  const gridCols = role === 'learner' ? "lg:grid-cols-3" : "lg:grid-cols-2";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Tổng quan (Dashboard)</h1>
        <p className="text-sm text-gray-400 mt-1">Theo dõi hoạt động học tập và tài nguyên của bạn</p>
      </div>
      
      <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols} gap-6`}>
        {/* Tài liệu đã tải */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 flex items-center gap-4 group">
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-sm font-semibold">Tài liệu đã tải</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1 transition-all">{docsCount}</p>
          </div>
        </div>
        
        {/* Bộ câu hỏi (Chỉ hiển thị cho teacher và learner) */}
        {(role === 'teacher' || role === 'learner') && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 flex items-center gap-4 group">
          <div className="p-3.5 bg-purple-50 text-purple-600 rounded-2xl group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-sm font-semibold">Bộ câu hỏi</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1 transition-all">{quizzesCount}</p>
          </div>
        </div>
        )}
        
        {/* Bài đã làm (Chỉ hiển thị cho người học) */}
        {role === 'learner' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 flex items-center gap-4 group">
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-sm font-semibold">Bài đã làm</p>
              <p className="text-3xl font-extrabold text-gray-900 mt-1 transition-all">{attemptsCount}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
