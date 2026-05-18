import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getPlaybookSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const [{ data: cab }, { data: fit }, { count: oppCount }] = await Promise.all([
      supabaseAdmin
        .from("cab_assessments")
        .select("final_level, final_level_name, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("ai_fit_attempts")
        .select("score, total, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .in("ai_capable", ["yes", "partly"]),
    ]);
    return {
      cab: cab ?? null,
      fit: fit ?? null,
      opportunityCount: oppCount ?? 0,
    };
  });

export const getAdminPlaybookOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // admin check
    const { data: me } = await supabaseAdmin.from("profiles").select("is_admin").eq("id", context.userId).maybeSingle();
    if (!me?.is_admin) throw new Error("Forbidden");

    const [{ count: totalUsers }, { data: cabAssessments }, { data: fitAttempts }, { data: activities }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("cab_assessments").select("user_id, final_level, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("ai_fit_attempts").select("user_id, score, total, answers, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("activities").select("id, ai_capable, hours_saved"),
    ]);

    // latest CAB per user → distribution
    const latestCabByUser = new Map<string, string>();
    (cabAssessments ?? []).forEach(a => {
      if (!latestCabByUser.has(a.user_id)) latestCabByUser.set(a.user_id, a.final_level);
    });
    const cabDistribution: Record<string, number> = { C1: 0, C2: 0, A1: 0, A2: 0, B1: 0, B2: 0 };
    latestCabByUser.forEach(lvl => { if (cabDistribution[lvl] !== undefined) cabDistribution[lvl]++; });

    // latest Fit per user → avg
    const latestFitByUser = new Map<string, { score: number; total: number; answers: unknown }>();
    (fitAttempts ?? []).forEach(a => {
      if (!latestFitByUser.has(a.user_id)) {
        latestFitByUser.set(a.user_id, { score: a.score, total: a.total, answers: a.answers });
      }
    });
    const fitScores = Array.from(latestFitByUser.values());
    const avgFit = fitScores.length
      ? fitScores.reduce((s, f) => s + f.score, 0) / fitScores.length
      : 0;
    const fitTotal = fitScores[0]?.total ?? 15;

    // top missed scenarios (across all attempts)
    const missCount = new Map<string, { scenario: string; misses: number }>();
    (fitAttempts ?? []).forEach(att => {
      const arr = (Array.isArray(att.answers) ? att.answers : []) as Array<{ question_id?: string; scenario?: string; ok?: boolean }>;
      arr.forEach((b) => {
        if (b && b.ok === false && b.scenario) {
          const cur = missCount.get(b.scenario) ?? { scenario: b.scenario, misses: 0 };
          cur.misses++;
          missCount.set(b.scenario, cur);
        }
      });
    });
    const topMissed = Array.from(missCount.values()).sort((a, b) => b.misses - a.misses).slice(0, 3);

    const highPriorityOpps = (activities ?? []).filter(
      a => (a.ai_capable === "yes" || a.ai_capable === "partly") && Number(a.hours_saved) >= 2
    ).length;

    return {
      totalUsers: totalUsers ?? 0,
      cabDistribution,
      avgFit,
      fitTotal,
      topMissed,
      highPriorityOpps,
    };
  });
