import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { NudgeShell } from "@/components/NudgeShell";
import { toast } from "sonner";
import { Trophy, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { CompletionBurst } from "@/components/CompletionBurst";

export const Route = createFileRoute("/results")({
  component: ResultsPage,
  head: () => ({
    meta: [
      { title: "AI Application Opportunities — AI for Work Playbook" },
      { name: "description", content: "Your practical action plan for where AI can save time in your work." },
    ],
  }),
});

type Bullet = { text: string; hours_saved: number };
type Activity = {
  id: string;
  name: string;
  weekly_hours: number;
  ai_capable: "yes" | "partly" | "no";
  recommended_tool: string | null;
  how_to: string | null;
  hours_saved: number;
  ai_bullets: Bullet[] | null;
  clarity: string | null;
  commitment: string | null;
};

function ResultsPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [commitments, setCommitments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedBurst, setSavedBurst] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/" }); return; }
    if (profile?.is_admin) { navigate({ to: "/admin" }); return; }
    supabase.from("activities").select("*").eq("user_id", user.id).then(({ data }) => {
      const acts = (data ?? []) as unknown as Activity[];
      acts.sort((a, b) => Number(b.hours_saved) - Number(a.hours_saved));
      setActivities(acts);
      const map: Record<string, string> = {};
      acts.forEach(a => { map[a.id] = a.commitment ?? ""; });
      setCommitments(map);
      setLoaded(true);
    });
  }, [loading, user, profile, navigate]);

  const totals = useMemo(() => {
    const saved = activities.reduce((s, a) => s + Number(a.hours_saved), 0);
    return { saved, annual: saved * 48 };
  }, [activities]);

  async function saveAll() {
    if (!user) return;
    setSaving(true);
    try {
      await Promise.all(activities.map(a =>
        supabase.from("activities").update({ commitment: commitments[a.id] ?? "" }).eq("id", a.id)
      ));
      toast.success("Your AI action plan is saved");
      setSavedBurst(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return <NudgeShell><div className="max-w-3xl mx-auto px-4 py-20 text-center text-[var(--n-text-muted)]">Loading…</div></NudgeShell>;
  }

  if (activities.length === 0) {
    navigate({ to: "/activities" });
    return <NudgeShell><div className="max-w-3xl mx-auto px-4 py-20 text-center text-[var(--n-text-muted)]">Loading…</div></NudgeShell>;
  }

  return (
    <NudgeShell>
      <CompletionBurst trigger={activities.length > 0 || savedBurst} />
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* 1. Completion */}
        <div className="n-card mb-6 n-glow-once n-reveal" style={{ background: "linear-gradient(135deg, #FFEEDD 0%, #FFFFFF 100%)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={18} style={{ color: "#23CE6B" }} className="n-check-pop" />
            <p className="n-step !text-[#23CE6B]">Module complete</p>
          </div>
          <p className="font-semibold" style={{ color: "#221D23" }}>
            You completed your AI Application Opportunities map. You now have a practical plan for where AI can save time in your work.
          </p>
        </div>

        {/* 2. Headline */}
        <p className="n-step mb-3 n-reveal n-reveal-delay-1">Your results</p>
        <h1 className="text-3xl md:text-5xl font-black mb-2 n-reveal n-reveal-delay-1">
          Your <span className="n-grad-violet">AI Application Opportunities</span>
        </h1>
        <p className="text-[var(--n-text-muted)] mb-6 n-reveal n-reveal-delay-1">
          Sorted by the clearest and highest-impact opportunities first.
        </p>

        {/* 3. Two summary cards only */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <div className="n-stat n-stat-emerald">
            <div className="n-stat-num">{totals.saved.toFixed(1)}</div>
            <div className="n-stat-label">Hours saved / week with AI</div>
          </div>
          <div className="n-stat n-stat-fuchsia">
            <div className="n-stat-num">{Math.round(totals.annual)}</div>
            <div className="n-stat-label">Hours saved / year with AI</div>
          </div>
        </div>

        {/* 4. Per-activity cards */}
        <h2 className="text-xl font-black mb-4">Your activities and how AI can help</h2>
        <div className="space-y-5">
          {activities.map(a => (
            <ActivityCard
              key={a.id}
              a={a}
              commitment={commitments[a.id] ?? ""}
              onCommitmentChange={(v) => setCommitments(p => ({ ...p, [a.id]: v }))}
            />
          ))}
        </div>

        {/* G. Save */}
        <div className="mt-8 flex flex-wrap gap-3 items-center justify-between">
          <Link to="/activities" className="n-btn n-btn-ghost">← Edit activities</Link>
          <button onClick={saveAll} disabled={saving} className="n-btn n-btn-accept inline-flex items-center gap-2">
            <Sparkles size={16} />
            {saving ? "Saving…" : "Save my AI action plan"}
          </button>
        </div>
      </div>
    </NudgeShell>
  );
}

function ActivityCard({
  a, commitment, onCommitmentChange,
}: {
  a: Activity;
  commitment: string;
  onCommitmentChange: (v: string) => void;
}) {
  const vague = a.clarity === "vague" || (a.ai_capable !== "no" && (a.ai_bullets?.length ?? 0) === 0 && !a.how_to);
  const bullets: Bullet[] = Array.isArray(a.ai_bullets) ? a.ai_bullets : [];

  return (
    <div className="n-card">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-bold text-lg" style={{ color: "#221D23" }}>{a.name}</h3>
        {!vague && a.ai_capable !== "no" && (
          <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: "#23CE6B", color: "white" }}>
            <CheckCircle2 size={12} /> Clear opportunity
          </span>
        )}
        {vague && (
          <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: "#FFCE00", color: "#221D23" }}>
            <AlertCircle size={12} /> Needs more detail
          </span>
        )}
        {!vague && a.ai_capable === "no" && (
          <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: "#E8E6DC", color: "#6B6B6B" }}>
            Human-only
          </span>
        )}
      </div>

      <div className="text-sm text-[var(--n-text-muted)] mb-4">
        Current time: <span className="font-semibold text-[var(--n-text)]">{Number(a.weekly_hours).toFixed(1)} hrs/week</span>
        {!vague && Number(a.hours_saved) > 0 && (
          <>
            {" · "}
            <span className="font-semibold text-[var(--n-emerald)]">
              Estimated time saved: {Number(a.hours_saved).toFixed(1)} hrs/week
            </span>
          </>
        )}
      </div>

      {vague ? (
        <div className="rounded-xl p-4 mb-4" style={{ background: "#FFF7DD", border: "1px solid #F5DC7B" }}>
          <p className="font-semibold mb-1" style={{ color: "#221D23" }}>Needs more detail</p>
          <p className="text-sm text-[var(--n-text-muted)]">
            This activity is too broad for a specific AI recommendation. Add more detail about what you do in this activity,
            what output you create, and where you spend the most time — then re-run the analysis.
          </p>
          <Link to="/activities" className="n-btn n-btn-ghost !py-1.5 text-sm mt-3 inline-block">Edit this activity</Link>
        </div>
      ) : a.ai_capable === "no" ? (
        <p className="text-sm text-[var(--n-text-muted)] italic mb-4">
          You marked this as not AI-doable — keep it on your plate.
        </p>
      ) : (
        <div className="mb-4">
          <p className="font-semibold mb-2 text-sm" style={{ color: "#221D23" }}>How AI can help:</p>
          {bullets.length > 0 ? (
            <ul className="space-y-1.5">
              {bullets.map((b, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-[var(--n-emerald)] font-bold">•</span>
                  <span>
                    {b.text}
                    {b.hours_saved > 0 && (
                      <span className="text-[var(--n-emerald)] font-semibold"> (~{b.hours_saved.toFixed(1)} hrs/week)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed">{a.how_to}</p>
          )}
          {a.recommended_tool && (
            <p className="text-xs text-[var(--n-text-muted)] mt-3">
              Suggested tool: <span className="font-semibold text-[var(--n-text)]">{a.recommended_tool}</span>
            </p>
          )}
        </div>
      )}

      {/* F. Per-activity commitment */}
      {!vague && a.ai_capable !== "no" && (
        <div className="pt-4 border-t border-[var(--n-border)]">
          <label className="font-semibold text-sm mb-2 block" style={{ color: "#221D23" }}>
            How will you use AI for this activity?
          </label>
          <textarea
            className="n-input min-h-[64px]"
            placeholder="Example: I will use AI every Monday to create the first draft before I edit it myself."
            value={commitment}
            onChange={(e) => onCommitmentChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
