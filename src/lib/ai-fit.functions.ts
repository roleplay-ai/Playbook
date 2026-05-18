import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CHOICES = ["use", "partial", "avoid"] as const;

async function requireAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  if (!data?.is_admin) throw new Error("Forbidden");
}

export const getAiFitTest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("ai_fit_questions")
      .select("id, scenario, choice_use_label, choice_partial_label, choice_avoid_label, sort_order")
      .eq("is_active", true)
      .order("sort_order");
    return { questions: data ?? [] };
  });

export const submitAiFitTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    answers: z.array(z.object({
      question_id: z.string().uuid(),
      choice: z.enum(CHOICES),
    })).max(100),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const ids = data.answers.map(a => a.question_id);
    if (ids.length === 0) throw new Error("No answers submitted");

    const { data: qs } = await supabaseAdmin
      .from("ai_fit_questions")
      .select("id, scenario, correct_answer, rationale, is_active")
      .in("id", ids);

    const byId = new Map((qs ?? []).map(q => [q.id, q]));
    const breakdown = data.answers.map(a => {
      const q = byId.get(a.question_id);
      const correct = q?.correct_answer ?? null;
      return {
        question_id: a.question_id,
        scenario: q?.scenario ?? "",
        your: a.choice,
        correct,
        rationale: q?.rationale ?? "",
        ok: !!q?.is_active && correct === a.choice,
      };
    });
    const score = breakdown.filter(b => b.ok).length;
    const total = breakdown.length;

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("company_id").eq("id", context.userId).maybeSingle();

    const { data: row, error } = await supabaseAdmin.from("ai_fit_attempts").insert({
      user_id: context.userId,
      company_id: profile?.company_id ?? null,
      answers: breakdown,
      score,
      total,
    }).select("*").single();
    if (error) throw new Error(error.message);

    return { attempt: row, breakdown, score, total };
  });

export const getMyLatestAiFitAttempt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("ai_fit_attempts")
      .select("id, score, total, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { attempt: data ?? null };
  });

// ============ ADMIN ============

export const adminGetAiFitOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const [{ data: attempts }, { data: questions }] = await Promise.all([
      supabaseAdmin.from("ai_fit_attempts").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("ai_fit_questions").select("*").order("sort_order"),
    ]);
    return { attempts: attempts ?? [], questions: questions ?? [] };
  });

export const adminUpsertAiFitQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid().optional(),
    scenario: z.string().trim().min(1).max(1000),
    choice_use_label: z.string().trim().min(1).max(120),
    choice_partial_label: z.string().trim().min(1).max(120),
    choice_avoid_label: z.string().trim().min(1).max(120),
    correct_answer: z.enum(CHOICES),
    rationale: z.string().trim().min(1).max(2000),
    sort_order: z.number().int().min(0).max(10000),
    is_active: z.boolean(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin.from("ai_fit_questions").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { id: _omit, ...insert } = data;
      void _omit;
      const { error } = await supabaseAdmin.from("ai_fit_questions").insert(insert);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteAiFitQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("ai_fit_questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
