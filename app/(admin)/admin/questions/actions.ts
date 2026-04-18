"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateQuestionAction(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const question_text = formData.get("question_text") as string;
  const explanation = formData.get("explanation") as string;

  const { error } = await supabase
    .from("questions")
    .update({ question_text, explanation })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/questions");
}

export async function moderateQuestionAction(id: string, status: string) {
  const supabase = await createClient();
  console.log(`[Admin] Moderating question ${id} to ${status}`);

  const { error } = await supabase
    .from("questions")
    .update({ moderation_status: status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/questions");
}

export async function deleteQuestionAction(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/questions");
}
