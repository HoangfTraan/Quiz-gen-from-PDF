"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export async function reportQuestionAction(questionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Bạn phải đăng nhập để báo lỗi.");
  }

  // Dùng admin client để bypass RLS (vì user bình thường có thể không có quyền update bảng questions)
  const adminDb = createAdminClient();
  
  const { error } = await adminDb
    .from("questions")
    .update({ moderation_status: "error" })
    .eq("id", questionId);

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}
