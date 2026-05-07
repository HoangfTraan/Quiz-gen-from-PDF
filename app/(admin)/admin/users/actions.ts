"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Cập nhật tên + role cho người dùng.
 * - Nếu role = 'admin' → ghi vào cột users.role, xoá khỏi user_roles
 * - Nếu role = 'teacher' | 'learner' | 'user' → cột users.role = 'user',
 *   INSERT vào user_roles và xoá các role cũ khác
 */
export async function updateUserAction(formData: FormData) {
  try {
    const supabase = await createClient();

  const targetUserId = formData.get("id") as string;
  const full_name = formData.get("full_name") as string;
  const newRole = formData.get("role") as string;

  // Lấy admin đang thao tác
  const {
    data: { user: adminUser },
  } = await supabase.auth.getUser();
  if (!adminUser) return { error: "Không xác định được admin" };

  // 1. Cập nhật tên + cột role (chỉ dùng cho admin flag)
  const usersRoleValue = newRole === "admin" ? "admin" : "user";
  const { data: updatedUsers, error: updateError } = await supabase
    .from("users")
    .update({ full_name, role: usersRoleValue })
    .eq("id", targetUserId)
    .select();

  if (updateError) return { error: updateError.message };
  if (!updatedUsers || updatedUsers.length === 0) {
    return { error: "Không thể cập nhật người dùng. Lỗi phân quyền (RLS) hoặc không tìm thấy user." };
  }

  // 2. Xử lý bảng user_roles
  if (newRole === "admin") {
    // Admin: xóa hết user_roles (admin dùng cột users.role)
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", targetUserId);
  } else {
    // teacher / learner / user: đặt user_roles tương ứng
    // Bước 2a: Lấy role_id của role mới
    const { data: roleRecord } = await supabase
      .from("roles")
      .select("id")
      .eq("name", newRole)
      .single();

    if (!roleRecord) return { error: `Không tìm thấy role: ${newRole}` };

    // Bước 2b: Xóa tất cả user_roles hiện tại của user này
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", targetUserId);

    // Bước 2c: Nếu không phải 'user' mặc định thì mới cần thêm vào user_roles
    // (role 'user' là mặc định khi không có record trong user_roles)
    if (newRole !== "user") {
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({
          user_id: targetUserId,
          role_id: roleRecord.id,
          assigned_by: adminUser.id,
        });

      if (insertError) return { error: insertError.message };
    }
  }

  revalidatePath("/admin/users");
  return { success: true };
} catch (err: any) {
  return { error: err.message || "Lỗi máy chủ không xác định" };
}
}
