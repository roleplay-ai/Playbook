"use server";

import { z } from "zod";
import { requireAuth } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CHOICES = ["use", "partial", "avoid"] as const;

async function requireAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  if (!data?.is_admin) throw new Error("Forbidden");
}

export async function getAiFitTest() {
  await requireAuth();
  const { data } = await supabaseAdmin
    .from("ai_fit_questions")
    .select("id, scenario, choice_use_label, choice_partial_label, choice_avoid_label, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  return { questions: data ?? [] };
}

export async function submitAiFitTest(answers: Array<{ question_id: string; choice: "use" | "partial" | "avoid" }>) {
  const { user } = await requireAuth();
  const validated = z.array(z.object({
    question_id: z.string().uuid(),
    choice: z.enum(CHOICES),
  })).max(100).parse(answers);

  const ids = validated.map((a) => a.question_id);
  if (ids.length === 0) throw new Error("No answers submitted");

  const { data: qs } = await supabaseAdmin
    .from("ai_fit_questions")
    .select("id, scenario, correct_answer, rationale, is_active")
    .in("id", ids);

  const byId = new Map((qs ?? []).map((q) => [q.id, q]));
  const breakdown = validated.map((a) => {
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
  const score = breakdown.filter((b) => b.ok).length;
  const total = breakdown.length;

  const { data: profile } = await supabaseAdmin
    .from("profiles").select("company_id").eq("id", user.id).maybeSingle();

  const { data: row, error } = await supabaseAdmin.from("ai_fit_attempts").insert({
    user_id: user.id,
    company_id: profile?.company_id ?? null,
    answers: breakdown,
    score,
    total,
  }).select("*").single();
  if (error) throw new Error(error.message);

  return { attempt: row, breakdown, score, total };
}

export async function adminGetAiFitOverview() {
  const { user } = await requireAuth();
  await requireAdmin(user.id);
  const [{ data: attempts }, { data: questions }] = await Promise.all([
    supabaseAdmin.from("ai_fit_attempts").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("ai_fit_questions").select("*").order("sort_order"),
  ]);
  return { attempts: attempts ?? [], questions: questions ?? [] };
}

export async function adminUpsertAiFitQuestion(input: {
  id?: string; scenario: string;
  choice_use_label: string; choice_partial_label: string; choice_avoid_label: string;
  correct_answer: "use" | "partial" | "avoid"; rationale: string;
  sort_order: number; is_active: boolean;
}) {
  const { user } = await requireAuth();
  await requireAdmin(user.id);
  const data = z.object({
    id: z.string().uuid().optional(),
    scenario: z.string().trim().min(1).max(1000),
    choice_use_label: z.string().trim().min(1).max(120),
    choice_partial_label: z.string().trim().min(1).max(120),
    choice_avoid_label: z.string().trim().min(1).max(120),
    correct_answer: z.enum(CHOICES),
    rationale: z.string().trim().min(1).max(2000),
    sort_order: z.number().int().min(0).max(10000),
    is_active: z.boolean(),
  }).parse(input);

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
}

export async function adminDeleteAiFitQuestion(input: { id: string }) {
  const { user } = await requireAuth();
  await requireAdmin(user.id);
  const data = z.object({ id: z.string().uuid() }).parse(input);
  const { error } = await supabaseAdmin.from("ai_fit_questions").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
