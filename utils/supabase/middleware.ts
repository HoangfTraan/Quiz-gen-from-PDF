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

  // ── Chặn admin vào route của user dashboard → đưa thẳng về /admin ──
  if (user && isDashboardRoute) {
    const { data: dbUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    if (dbUser?.role === "admin") {
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  // ── Bảo vệ /history: chỉ learner ──
  // ── /attempts/*: cho phép cả learner và teacher (giáo viên xem kết quả học viên) ──
  if (user && url.pathname.startsWith("/history")) {
    const { data: learnerRole } = await supabase
      .from("user_roles")
      .select("id, roles!inner(name)")
      .eq("user_id", user.id)
      .eq("roles.name", "learner")
      .maybeSingle();

    if (!learnerRole) {
      url.pathname = "/dashboard";
      url.searchParams.set("error", "learner_only");
      return NextResponse.redirect(url);
    }
  }

  if (user && url.pathname.startsWith("/attempts")) {
    // Cho phép learner hoặc teacher truy cập
    const { data: allowedRoles } = await supabase
      .from("user_roles")
      .select("id, roles!inner(name)")
      .eq("user_id", user.id)
      .in("roles.name", ["learner", "teacher"]);

    if (!allowedRoles || allowedRoles.length === 0) {
      url.pathname = "/dashboard";
      url.searchParams.set("error", "learner_only");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
