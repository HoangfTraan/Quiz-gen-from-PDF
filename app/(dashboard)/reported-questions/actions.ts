"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/utils/rbac-server";
import { revalidatePath } from "next/cache";

export async function approveReportAction(questionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error("Chưa đăng nhập");
  const role = await getUserRole(user.id);
  if (role !== "teacher" && role !== "admin") throw new Error("Không có quyền");

  const adminDb = createAdminClient();
  
  // Verify ownership
  const { data: question } = await adminDb
    .from("questions")
    .select("quiz_id, quizzes(user_id)")
    .eq("id", questionId)
    .single();

  const quizUserId = Array.isArray(question?.quizzes) ? question?.quizzes[0]?.user_id : (question?.quizzes as any)?.user_id;
  if (quizUserId !== user.id && role !== "admin") {
    throw new Error("Chỉ chủ bộ đề mới có quyền duyệt");
  }

  const { error } = await adminDb
    .from("questions")
    .update({ moderation_status: "error" })
    .eq("id", questionId);

  if (error) throw new Error(error.message);

  if (question?.quiz_id) {
    await recalculateQuizScores(question.quiz_id);
  }

  revalidatePath("/reported-questions");
  return { success: true };
}

export async function rejectReportAction(questionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error("Chưa đăng nhập");
  const role = await getUserRole(user.id);
  if (role !== "teacher" && role !== "admin") throw new Error("Không có quyền");

  const adminDb = createAdminClient();

  // Verify ownership
  const { data: question } = await adminDb
    .from("questions")
    .select("quizzes(user_id)")
    .eq("id", questionId)
    .single();

  const quizUserId = Array.isArray(question?.quizzes) ? question?.quizzes[0]?.user_id : (question?.quizzes as any)?.user_id;
  if (quizUserId !== user.id && role !== "admin") {
    throw new Error("Chỉ chủ bộ đề mới có quyền duyệt");
  }

  const { error } = await adminDb
    .from("questions")
    .update({ moderation_status: null })
    .eq("id", questionId);

  if (error) throw new Error(error.message);

  revalidatePath("/reported-questions");
  return { success: true };
}

export async function undoReportAction(questionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error("Chưa đăng nhập");
  const role = await getUserRole(user.id);
  if (role !== "teacher" && role !== "admin") throw new Error("Không có quyền");

  const adminDb = createAdminClient();

  // Verify ownership and get current status
  const { data: question } = await adminDb
    .from("questions")
    .select("quiz_id, quizzes(user_id), moderation_status")
    .eq("id", questionId)
    .single();

  const quizUserId = Array.isArray(question?.quizzes) ? question?.quizzes[0]?.user_id : (question?.quizzes as any)?.user_id;
  if (quizUserId !== user.id && role !== "admin") {
    throw new Error("Chỉ chủ bộ đề mới có quyền hoàn tác");
  }

  const nextStatus = question?.moderation_status === "teacher_reported" ? null : "pending_review";

  const { error } = await adminDb
    .from("questions")
    .update({ moderation_status: nextStatus })
    .eq("id", questionId);

  if (error) throw new Error(error.message);

  if (question?.quiz_id) {
    await recalculateQuizScores(question.quiz_id);
  }

  revalidatePath("/reported-questions");
  return { success: true };
}

async function recalculateQuizScores(quizId: string) {
  const adminDb = createAdminClient();

  const { data: allQuestions } = await adminDb
    .from("questions")
    .select("id, moderation_status")
    .eq("quiz_id", quizId);

  const validQuestionIds = allQuestions
    ?.filter(q => q.moderation_status !== "error" && q.moderation_status !== "teacher_reported")
    .map(q => q.id) || [];

  const { data: attempts } = await adminDb
    .from("quiz_attempts")
    .select("id")
    .eq("quiz_id", quizId);

  if (!attempts || attempts.length === 0) return;

  for (const attempt of attempts) {
    const { data: answers } = await adminDb
      .from("attempt_answers")
      .select("question_id, is_correct")
      .eq("attempt_id", attempt.id);

    let total_q = 0;
    let total_c = 0;

    for (const ans of answers || []) {
      if (validQuestionIds.includes(ans.question_id)) {
        total_q++;
        if (ans.is_correct) total_c++;
      }
    }

    await adminDb
      .from("quiz_attempts")
      .update({ total_questions: total_q, total_correct: total_c })
      .eq("id", attempt.id);
  }
}
