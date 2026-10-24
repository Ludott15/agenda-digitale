"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadProfile } from "@/lib/auth";
import { fail, invalidInput } from "@/lib/action-utils";
import type { ActionResult } from "@/lib/types";

const LoginSchema = z.object({
  email: z.string().trim().pipe(z.email({ message: "Email non valida" })),
  password: z.string().min(1, "Password obbligatoria"),
});

export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = LoginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail("Email o password non corretti.");

  const profile = await loadProfile(supabase);
  if (!profile) {
    await supabase.auth.signOut();
    return fail("Account non abilitato o disattivato.");
  }

  redirect("/agenda");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
