"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export async function reportQuestionAction(questionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Bạn phải đăng nhập để báo lỗi.");
  }

  const adminDb = createAdminClient();
  
  // Lấy thông tin câu hỏi để biết ai là chủ sở hữu bộ đề
  const { data: question } = await adminDb
    .from("questions")
    .select("quizzes(user_id)")
    .eq("id", questionId)
    .single();

  const quizUserId = Array.isArray(question?.quizzes) ? question?.quizzes[0]?.user_id : (question?.quizzes as any)?.user_id;
  const isOwner = quizUserId === user.id;
  const newStatus = isOwner ? "teacher_reported" : "pending_review";

  const { error } = await adminDb
    .from("questions")
    .update({ moderation_status: newStatus })
    .eq("id", questionId);

  if (error) {
    throw new Error(error.message);
  }

  return { success: true, newStatus };
}
