// ─── Server-only — chỉ dùng trong Server Components / Route Handlers ───
// KHÔNG import file này trong Client Components ("use client")

import { createClient } from "@/utils/supabase/server";
import type { AppRole } from "@/utils/rbac";
export { canManageQuiz, canTakeQuiz, canViewScores, canAuthorQuiz, canTakePublishedQuiz, getRoleLabel, getRoleBadgeClass } from "@/utils/rbac";

/**
 * Lấy role của user hiện tại.
 * Ưu tiên: cột `users.role = 'admin'` > bảng `user_roles` > mặc định 'user'
 */
export async function getUserRole(userId: string): Promise<AppRole> {
  const supabase = await createClient();

  // Song song hóa truy vấn để tránh network thắt cổ chai
  const [dbUserResult, userRolesResult] = await Promise.all([
    supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single(),
    supabase
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", userId)
  ]);

  const dbUser = dbUserResult.data;
  if (dbUser?.role === "admin") return "admin";

  const userRoles = userRolesResult.data;
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
