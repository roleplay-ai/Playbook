"use server";

import { z } from "zod";
import { requireAuth } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.is_admin) throw new Error("Forbidden");
}

export async function adminAddCompany(input: { name: string }) {
  const { user } = await requireAuth();
  await requireAdmin(user.id);
  const data = z.object({ name: z.string().trim().min(1).max(80) }).parse(input);
  const { data: row, error } = await supabaseAdmin
    .from("companies")
    .insert({ name: data.name })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, company: row };
}

export async function adminDeleteUser(input: { user_id: string }) {
  const { user } = await requireAuth();
  await requireAdmin(user.id);
  const data = z.object({ user_id: z.string().uuid() }).parse(input);
  const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function adminGetAll() {
  const { user } = await requireAuth();
  await requireAdmin(user.id);
  const [{ data: profiles }, { data: activities }, { data: commitments }, { data: companies }] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("is_admin", false).order("created_at", { ascending: false }),
      supabaseAdmin.from("activities").select("*"),
      supabaseAdmin.from("commitments").select("*"),
      supabaseAdmin.from("companies").select("*").order("name"),
    ]);
  return {
    profiles: profiles ?? [],
    activities: activities ?? [],
    commitments: commitments ?? [],
    companies: companies ?? [],
  };
}
