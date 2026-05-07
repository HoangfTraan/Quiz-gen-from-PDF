// ─── Server-only — chỉ dùng trong Server Components / Route Handlers ───
// KHÔNG import file này trong Client Components ("use client")

import { createClient } from "@/utils/supabase/server";
import type { AppRole } from "@/utils/rbac";
export { canManageQuiz, canTakeQuiz, canViewScores, getRoleLabel, getRoleBadgeClass } from "@/utils/rbac";

/**
 * Lấy role của user hiện tại.
 * Ưu tiên: cột `users.role = 'admin'` > bảng `user_roles` > mặc định 'user'
 */
export async function getUserRole(userId: string): Promise<AppRole> {
  const supabase = await createClient();

  // 1. Kiểm tra admin qua cột role (backward-compatible)
  const { data: dbUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  if (dbUser?.role === "admin") return "admin";

  // 2. Kiểm tra teacher / learner qua user_roles
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId);

  if (userRoles && userRoles.length > 0) {
    const roleNames = userRoles
      .map((ur: any) => {
        const roleObj = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
        return roleObj?.name;
      })
      .filter(Boolean) as string[];

    if (roleNames.includes("teacher")) return "teacher";
    if (roleNames.includes("learner")) return "learner";
  }

  // 3. Mặc định
  return "user";
}
