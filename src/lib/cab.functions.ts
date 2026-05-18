import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LEVELS = ["C1", "C2", "A1", "A2", "B1", "B2"] as const;
type Level = (typeof LEVELS)[number];

async function requireAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  if (!data?.is_admin) throw new Error("Forbidden");
}

export const getCabDiagnostic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const [{ data: questions }, { data: levels }] = await Promise.all([
      supabaseAdmin.from("cab_questions").select("id, question_text, example_text, sort_order").eq("is_active", true).order("sort_order"),
      supabaseAdmin.from("cab_level_definitions").select("*").order("sort_order"),
    ]);
    return { questions: questions ?? [], levels: levels ?? [] };
  });

export const submitCabAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ selected_question_ids: z.array(z.string().uuid()).max(200) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const selected = data.selected_question_ids;

    const { data: qs } = await supabaseAdmin
      .from("cab_questions")
      .select("id, cab_level, weight, is_active")
      .in("id", selected.length ? selected : ["00000000-0000-0000-0000-000000000000"]);

    const active = (qs ?? []).filter(q => q.is_active);
    const scores: Record<Level, number> = { C1: 0, C2: 0, A1: 0, A2: 0, B1: 0, B2: 0 };
    const counts: Record<Level, number> = { C1: 0, C2: 0, A1: 0, A2: 0, B1: 0, B2: 0 };
    for (const q of active) {
      const lv = q.cab_level as Level;
      scores[lv] += Number(q.weight);
      counts[lv] += 1;
    }

    let final: Level = "C1";
    let note: string | null = null;

    if (active.length <= 1) {
      final = "C1";
    } else {
      // highest level with count >= 2
      for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (counts[LEVELS[i]] >= 2) { final = LEVELS[i]; break; }
      }
      // if none had >=2 but there are selections, take highest with any
      if (counts[final] < 2) {
        for (let i = LEVELS.length - 1; i >= 0; i--) {
          if (counts[LEVELS[i]] >= 1) { final = LEVELS[i]; note = "advanced_without_base"; break; }
        }
      } else {
        // check if a higher level had a single advanced selection without base
        for (let i = LEVELS.length - 1; i > LEVELS.indexOf(final); i--) {
          if (counts[LEVELS[i]] >= 1) { note = "advanced_without_base"; break; }
        }
      }
    }

    const { data: levelDef } = await supabaseAdmin
      .from("cab_level_definitions").select("level_name").eq("cab_level", final).maybeSingle();

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();

    const { data: row, error } = await supabaseAdmin.from("cab_assessments").insert({
      user_id: userId,
      company_id: profile?.company_id ?? null,
      final_level: final,
      final_level_name: levelDef?.level_name ?? final,
      level_scores: scores,
      selected_question_ids: selected,
      note,
    }).select("*").single();

    if (error) throw new Error(error.message);
    return { assessment: row };
  });

export const getMyLatestCabResult = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("cab_assessments")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return { assessment: null, level: null };
    const { data: level } = await supabaseAdmin
      .from("cab_level_definitions").select("*").eq("cab_level", data.final_level).maybeSingle();
    return { assessment: data, level };
  });

// ===================== ADMIN =====================

export const adminGetCabOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const [{ data: assessments }, { data: questions }, { data: levels }, { data: profiles }, { data: companies }] = await Promise.all([
      supabaseAdmin.from("cab_assessments").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("cab_questions").select("*").order("sort_order"),
      supabaseAdmin.from("cab_level_definitions").select("*").order("sort_order"),
      supabaseAdmin.from("profiles").select("id, username, company_id, role, is_admin"),
      supabaseAdmin.from("companies").select("id, name").order("name"),
    ]);
    return {
      assessments: assessments ?? [],
      questions: questions ?? [],
      levels: levels ?? [],
      profiles: profiles ?? [],
      companies: companies ?? [],
    };
  });

export const adminUpsertCabQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid().optional(),
    question_text: z.string().trim().min(1).max(1000),
    example_text: z.string().trim().max(1000).nullable().optional(),
    cab_level: z.enum(LEVELS),
    weight: z.number().min(0).max(100),
    is_active: z.boolean(),
    sort_order: z.number().int().min(0).max(10000),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const payload = { ...data, example_text: data.example_text ?? null };
    if (data.id) {
      const { error } = await supabaseAdmin.from("cab_questions").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { id: _omit, ...insert } = payload;
      void _omit;
      const { error } = await supabaseAdmin.from("cab_questions").insert(insert);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteCabQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("cab_questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpsertCabLevelDefinition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    cab_level: z.enum(LEVELS),
    level_name: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(2000),
    next_move: z.string().trim().min(1).max(1000),
    recommended_actions: z.array(z.string().min(1).max(500)).max(20),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("cab_level_definitions")
      .update({
        level_name: data.level_name,
        description: data.description,
        next_move: data.next_move,
        recommended_actions: data.recommended_actions,
      })
      .eq("cab_level", data.cab_level);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
