import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // refreshing the auth token
  const { data: { user } } = await supabase.auth.getUser();

  // Basic route protection
  const url = request.nextUrl.clone();
  const isDashboardRoute = url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/history') || url.pathname.startsWith('/attempts') || url.pathname.startsWith('/quizzes') || url.pathname.startsWith('/documents') || url.pathname.startsWith('/profile');
  const isAdminRoute = url.pathname.startsWith('/admin');
  const isAuthRoute = url.pathname.startsWith('/login') || url.pathname.startsWith('/register') || url.pathname.startsWith('/forgot-password');

  if (!user && (isDashboardRoute || isAdminRoute)) {
    // Không có user mà vào dashboard/admin thì đẩy về login
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    // Nếu đã login mà vào trang auth thì kiểm tra quyền
    const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (dbUser?.role === 'admin') {
      url.pathname = '/admin';
    } else {
      url.pathname = '/dashboard';
    }
    return NextResponse.redirect(url);
  }

  // Bảo vệ route Admin (Check quyền)
  if (user && isAdminRoute) {
    const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (dbUser?.role !== 'admin') {
      // Nếu không phải admin thì đẩy về dashboard
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
