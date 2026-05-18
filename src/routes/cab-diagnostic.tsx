import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { NudgeShell } from "@/components/NudgeShell";
import { getCabDiagnostic, submitCabAssessment } from "@/lib/cab.functions";
import { toast } from "sonner";
import { Check, RotateCcw, ArrowLeft, Trophy } from "lucide-react";
import { CompletionBurst } from "@/components/CompletionBurst";

export const Route = createFileRoute("/cab-diagnostic")({ component: CabPage });

type Question = { id: string; question_text: string; example_text: string | null; sort_order: number };
type LevelDef = {
  cab_level: string; level_name: string; description: string; next_move: string;
  recommended_actions: string[]; sort_order: number;
};
type Assessment = {
  id: string; final_level: string; final_level_name: string;
  level_scores: Record<string, number>; selected_question_ids: string[]; note: string | null; created_at: string;
};

export const LEVEL_COLORS: Record<string, { bg: string; fg: string }> = {
  C1: { bg: "#3699FC", fg: "#FFFFFF" },
  C2: { bg: "#623CEA", fg: "#FFFFFF" },
  A1: { bg: "#F68A29", fg: "#FFFFFF" },
  A2: { bg: "#FFCE00", fg: "#221D23" },
  B1: { bg: "#23CE6B", fg: "#FFFFFF" },
  B2: { bg: "#221D23", fg: "#FFFFFF" },
};

function CabPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const loadFn = useServerFn(getCabDiagnostic);
  const submitFn = useServerFn(submitCabAssessment);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [levels, setLevels] = useState<LevelDef[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [result, setResult] = useState<Assessment | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/" }); return; }
    loadFn()
      .then((r) => { setQuestions(r.questions as Question[]); setLevels(r.levels as LevelDef[]); })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoadingData(false));
  }, [loading, user, navigate, loadFn]);

  const levelByCode = useMemo(() => {
    const m: Record<string, LevelDef> = {};
    levels.forEach(l => { m[l.cab_level] = l; });
    return m;
  }, [levels]);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    setBusy(true);
    try {
      const r = await submitFn({ data: { selected_question_ids: Array.from(selected) } });
      setResult(r.assessment as Assessment);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setSelected(new Set());
  }

  if (loading || loadingData) {
    return <NudgeShell><div className="p-12 text-center text-[var(--n-text-muted)]">Loading diagnostic…</div></NudgeShell>;
  }

  if (result) {
    const def = levelByCode[result.final_level];
    const colors = LEVEL_COLORS[result.final_level];
    return (
      <NudgeShell>
        <CompletionBurst trigger={true} />
        <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
          <Link to="/hub" className="inline-flex items-center gap-1 text-sm text-[var(--n-text-muted)] hover:underline mb-6">
            <ArrowLeft size={14} /> Back to Playbook
          </Link>

          <div className="n-card mb-5 n-glow-once n-reveal" style={{ background: "linear-gradient(135deg, #FFF6CF 0%, #FFFFFF 100%)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={18} style={{ color: "#23CE6B" }} className="n-check-pop" />
              <p className="n-step !text-[#23CE6B]">Module complete</p>
            </div>
            <p className="font-semibold" style={{ color: "#221D23" }}>
              You completed your CAB Diagnostic. Your AI fluency level is ready.
            </p>
          </div>

          <p className="n-step mb-3 n-reveal n-reveal-delay-1">Your CAB level</p>
          <div className="flex items-center gap-4 mb-6 n-reveal n-reveal-delay-1">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black"
              style={{ background: colors.bg, color: colors.fg }}
            >
              {result.final_level}
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black" style={{ color: "#221D23" }}>{result.final_level_name}</h1>
              <p className="text-[var(--n-text-muted)] text-sm">Chat → Automate → Build</p>
            </div>
          </div>

          {def && (
            <div className="n-reveal n-reveal-delay-2">
              <div className="n-card mb-4">
                <p className="text-lg" style={{ color: "#221D23" }}>{def.description}</p>
              </div>

              {result.note === "advanced_without_base" && (
                <div className="n-card mb-4" style={{ borderLeft: "4px solid #F68A29" }}>
                  <p className="text-sm" style={{ color: "#221D23" }}>
                    Your result shows advanced activity in this area. You may still benefit from strengthening the earlier levels.
                  </p>
                </div>
              )}

              <div className="n-card mb-4">
                <p className="n-step mb-2">Next move</p>
                <p className="font-semibold text-lg" style={{ color: "#221D23" }}>{def.next_move}</p>
              </div>

              <div className="n-card mb-6">
                <p className="n-step mb-3">Recommended actions</p>
                <ul className="space-y-2">
                  {def.recommended_actions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check size={18} style={{ color: "#23CE6B", marginTop: 2, flexShrink: 0 }} />
                      <span style={{ color: "#221D23" }}>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="flex gap-3 n-reveal n-reveal-delay-3">
            <button className="n-btn n-btn-ghost n-btn-press flex items-center gap-2" onClick={reset}>
              <RotateCcw size={16} /> Retake
            </button>
            <Link to="/hub" className="n-btn n-btn-primary n-btn-press">Continue your journey</Link>
          </div>
        </div>
      </NudgeShell>
    );
  }

  return (
    <NudgeShell>
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14 pb-32">
        <Link to="/hub" className="inline-flex items-center gap-1 text-sm text-[var(--n-text-muted)] hover:underline mb-6">
          <ArrowLeft size={14} /> Back to modules
        </Link>
        <p className="n-step mb-3">Diagnostic</p>
        <h1 className="text-3xl md:text-4xl font-black mb-2" style={{ color: "#221D23" }}>
          CAB Ladder AI Fluency Diagnostic
        </h1>
        <p className="text-[var(--n-text-muted)] mb-1 font-semibold">Chat → Automate → Build</p>
        <p className="text-[var(--n-text-muted)] mb-8">
          Select the statements that describe how you actually use AI at work today.
        </p>

        <div className="space-y-3">
          {questions.map((q) => {
            const isSel = selected.has(q.id);
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => toggle(q.id)}
                className="n-card w-full text-left transition"
                style={{
                  cursor: "pointer",
                  borderLeft: isSel ? "4px solid #623CEA" : "4px solid transparent",
                  background: isSel ? "#F7F4FF" : undefined,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: isSel ? "#623CEA" : "white",
                      border: isSel ? "none" : "2px solid #C8C5BC",
                    }}
                  >
                    {isSel && <Check size={16} style={{ color: "white" }} />}
                  </div>
                  <div className="flex-1">
                    <p style={{ color: "#221D23" }}>{q.question_text}</p>
                    {q.example_text && (
                      <p className="text-sm text-[var(--n-text-muted)] mt-1">{q.example_text}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t z-40"
        style={{ borderColor: "#E8E6DC", boxShadow: "0 -2px 12px rgba(34,29,35,0.06)" }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold" style={{ color: "#221D23" }}>
            {selected.size} selected
          </span>
          <button
            className="n-btn n-btn-primary n-btn-press"
            disabled={busy}
            onClick={handleSubmit}
          >
            {busy ? "Finding your AI fluency level…" : "See My Level"}
          </button>
        </div>
      </div>
    </NudgeShell>
  );
}
