"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateUserAction(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const full_name = formData.get("full_name") as string;
  const role = formData.get("role") as string;

  const { error } = await supabase
    .from("users")
    .update({ full_name, role })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/users");
}
