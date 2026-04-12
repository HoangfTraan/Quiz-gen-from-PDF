"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { data: authData, error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    console.error("Login Error:", error.message);
    redirect("/login?error=" + encodeURIComponent("Đăng nhập thất bại: " + error.message));
  }

  let redirectTo = "/dashboard";
  if (authData?.user) {
    const { data: dbUser } = await supabase.from('users').select('role').eq('id', authData.user.id).single();
    if (dbUser?.role === 'admin') {
      redirectTo = "/admin";
    }
  }

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: {
        full_name: formData.get("name") as string,
      }
    }
  };

  const { error, data: authData } = await supabase.auth.signUp(data);

  if (error) {
    console.error("Signup Error:", error.message);
    redirect("/register?error=" + encodeURIComponent("Đăng ký thất bại: " + error.message));
  }
  
  // Create user record in public.users if auth is successful
  if (authData.user) {
     const { error: dbError } = await supabase.from('users').insert({
       id: authData.user.id,
       full_name: data.options.data.full_name,
       email: data.email,
     });
     if (dbError) console.error("Error creating public.user:", dbError.message);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
