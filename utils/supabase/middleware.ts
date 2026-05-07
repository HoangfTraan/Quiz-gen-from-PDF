import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh auth token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();

  const isDashboardRoute =
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/history") ||
    url.pathname.startsWith("/attempts") ||
    url.pathname.startsWith("/quizzes") ||
    url.pathname.startsWith("/documents") ||
    url.pathname.startsWith("/profile");

  const isAdminRoute = url.pathname.startsWith("/admin");

  const isAuthRoute =
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/register") ||
    url.pathname.startsWith("/forgot-password");

  // ── Chưa đăng nhập → về login ──
  if (!user && (isDashboardRoute || isAdminRoute)) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ── Đã đăng nhập mà vào trang auth → redirect theo role ──
  if (user && isAuthRoute) {
    const { data: dbUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    url.pathname = dbUser?.role === "admin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  // ── Bảo vệ route Admin: chỉ role = 'admin' ──
  if (user && isAdminRoute) {
    const { data: dbUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    if (dbUser?.role !== "admin") {
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // ── Bảo vệ /history và /attempts/*: chỉ learner ──
  const isLearnerRoute =
    url.pathname.startsWith("/history") ||
    url.pathname.startsWith("/attempts");

  if (user && isLearnerRoute) {
    // Kiểm tra có role learner trong user_roles không
    const { data: learnerRole } = await supabase
      .from("user_roles")
      .select("id, roles!inner(name)")
      .eq("user_id", user.id)
      .eq("roles.name", "learner")
      .maybeSingle();

    if (!learnerRole) {
      // Không phải learner → về dashboard với thông báo
      url.pathname = "/dashboard";
      url.searchParams.set("error", "learner_only");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
