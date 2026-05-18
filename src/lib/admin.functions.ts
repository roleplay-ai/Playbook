import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  if (!data?.is_admin) throw new Error("Forbidden");
}

export const adminAddCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ name: z.string().trim().min(1).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("companies")
      .insert({ name: data.name })
      .select("*")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, company: row };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    // delete from auth - cascades to profiles, activities, commitments
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const adminGetAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const [{ data: profiles }, { data: activities }, { data: commitments }, { data: companies }] = await Promise.all([
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
  });
