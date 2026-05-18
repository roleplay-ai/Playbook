import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { NudgeShell } from "@/components/NudgeShell";
import { getAiFitTest, submitAiFitTest } from "@/lib/ai-fit.functions";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, X, RotateCcw, Sparkles, Trophy } from "lucide-react";
import { CompletionBurst } from "@/components/CompletionBurst";

export const Route = createFileRoute("/ai-fit-test")({
  component: AiFitTestPage,
  head: () => ({
    meta: [
      { title: "AI Fit Test — AI for Work Playbook" },
      { name: "description", content: "Practice judging where AI fits at work. Use it, use partially, or avoid." },
    ],
  }),
});

type Question = {
  id: string; scenario: string;
  choice_use_label: string; choice_partial_label: string; choice_avoid_label: string;
  sort_order: number;
};
type Choice = "use" | "partial" | "avoid";
type Breakdown = { question_id: string; scenario: string; your: Choice; correct: Choice | null; rationale: string; ok: boolean };

const CHOICE_STYLE: Record<Choice, { bg: string; fg: string; label: string }> = {
  use:     { bg: "#23CE6B", fg: "#FFFFFF", label: "Use AI" },
  partial: { bg: "#FFCE00", fg: "#221D23", label: "Use Partially" },
  avoid:   { bg: "#ED4551", fg: "#FFFFFF", label: "Avoid" },
};

function AiFitTestPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const loadFn = useServerFn(getAiFitTest);
  const submitFn = useServerFn(submitAiFitTest);

  const [stage, setStage] = useState<"intro" | "play" | "result">("intro");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Choice>>({});
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [result, setResult] = useState<{ score: number; total: number; breakdown: Breakdown[] } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/" }); return; }
    loadFn()
      .then(r => setQuestions(r.questions as Question[]))
      .catch(e => toast.error((e as Error).message))
      .finally(() => setLoadingData(false));
  }, [loading, user, navigate, loadFn]);

  function start() {
    setAnswers({});
    setIdx(0);
    setStage("play");
  }

  function pick(q: Question, choice: Choice) {
    setAnswers(prev => ({ ...prev, [q.id]: choice }));
    if (idx < questions.length - 1) {
      setTimeout(() => setIdx(i => i + 1), 150);
    }
  }

  async function handleSubmit() {
    setBusy(true);
    try {
      const payload = Object.entries(answers).map(([question_id, choice]) => ({ question_id, choice }));
      const r = await submitFn({ data: { answers: payload } });
      setResult({ score: r.score, total: r.total, breakdown: r.breakdown as Breakdown[] });
      setStage("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    setResult(null);
    setStage("intro");
  }

  if (loading || loadingData) {
    return <NudgeShell><div className="p-12 text-center text-[var(--n-text-muted)]">Loading test…</div></NudgeShell>;
  }

  // INTRO
  if (stage === "intro") {
    return (
      <NudgeShell>
        <div className="max-w-2xl mx-auto px-4 py-10 md:py-14">
          <Link to="/hub" className="inline-flex items-center gap-1 text-sm text-[var(--n-text-muted)] hover:underline mb-6">
            <ArrowLeft size={14} /> Back to Playbook
          </Link>
          <p className="n-step mb-3">Diagnostic 2 of 3</p>
          <h1 className="text-3xl md:text-4xl font-black mb-3" style={{ color: "#221D23" }}>
            AI <span style={{ color: "#3699FC" }}>Fit Test</span>
          </h1>
          <p className="text-[var(--n-text-muted)] mb-8">
            Build judgement on where AI belongs at work. For each scenario, pick whether you would
            <strong style={{ color: "#23CE6B" }}> Use AI</strong>,
            <strong style={{ color: "#221D23" }}> Use it Partially</strong>, or
            <strong style={{ color: "#ED4551" }}> Avoid it</strong>.
          </p>
          <div className="n-card mb-6">
            <ul className="space-y-2 text-sm" style={{ color: "#221D23" }}>
              <li>• {questions.length} short scenarios</li>
              <li>• ~3 minutes</li>
              <li>• See your score and rationale at the end</li>
            </ul>
          </div>
          <button className="n-btn n-btn-primary inline-flex items-center gap-2" onClick={start} disabled={questions.length === 0}>
            Start the test <ArrowRight size={16} />
          </button>
        </div>
      </NudgeShell>
    );
  }

  // RESULT
  if (stage === "result" && result) {
    const band =
      result.score >= 13 ? { label: "Sharp judgement", color: "#23CE6B" } :
      result.score >= 10 ? { label: "Solid foundation", color: "#3699FC" } :
      result.score >= 7  ? { label: "Getting there",   color: "#FFCE00" } :
                           { label: "Worth practicing", color: "#ED4551" };
    return (
      <NudgeShell>
        <CompletionBurst trigger={true} />
        <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
          <div className="n-card mb-5 n-glow-once n-reveal" style={{ background: "linear-gradient(135deg, #E8F4FF 0%, #FFFFFF 100%)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={18} style={{ color: "#23CE6B" }} className="n-check-pop" />
              <p className="n-step !text-[#23CE6B]">Module complete</p>
            </div>
            <p className="font-semibold" style={{ color: "#221D23" }}>
              You completed the AI Fit Test. You now have a clearer sense of where AI fits and where it should be avoided.
            </p>
          </div>

          <p className="n-step mb-3 n-reveal n-reveal-delay-1">Your result</p>
          <div className="flex items-center gap-5 mb-6 n-reveal n-reveal-delay-1">
            <div
              className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center font-black"
              style={{ background: band.color, color: band.color === "#FFCE00" ? "#221D23" : "#FFFFFF" }}
            >
              <span className="text-3xl leading-none">{result.score}</span>
              <span className="text-xs opacity-80">/ {result.total}</span>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black" style={{ color: "#221D23" }}>{band.label}</h1>
              <p className="text-[var(--n-text-muted)] text-sm">AI Fit Test</p>
            </div>
          </div>

          <div className="n-card mb-6 n-reveal n-reveal-delay-2">
            <p className="n-step mb-2 flex items-center gap-1"><Sparkles size={14} /> Per-scenario feedback</p>
            <ul className="divide-y" style={{ borderColor: "#E8E6DC" }}>
              {result.breakdown.map((b, i) => (
                <li key={b.question_id} className="py-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: b.ok ? "#23CE6B" : "#ED4551", color: "white" }}
                    >
                      {b.ok ? <Check size={14} /> : <X size={14} />}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold" style={{ color: "#221D23" }}>{i + 1}. {b.scenario}</p>
                      <p className="text-xs mt-1 text-[var(--n-text-muted)]">
                        You: <strong style={{ color: CHOICE_STYLE[b.your].bg === "#FFCE00" ? "#221D23" : CHOICE_STYLE[b.your].bg }}>{CHOICE_STYLE[b.your].label}</strong>
                        {b.correct && (<> · Correct: <strong style={{ color: CHOICE_STYLE[b.correct].bg === "#FFCE00" ? "#221D23" : CHOICE_STYLE[b.correct].bg }}>{CHOICE_STYLE[b.correct].label}</strong></>)}
                      </p>
                      <p className="text-sm mt-1" style={{ color: "#221D23" }}>{b.rationale}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3 n-reveal n-reveal-delay-3">
            <button className="n-btn n-btn-ghost n-btn-press inline-flex items-center gap-2" onClick={retake}><RotateCcw size={16} /> Retake</button>
            <Link to="/hub" className="n-btn n-btn-primary n-btn-press">Continue your journey</Link>
          </div>
        </div>
      </NudgeShell>
    );
  }

  // PLAY
  const q = questions[idx];
  if (!q) return null;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  return (
    <NudgeShell>
      <div className="max-w-2xl mx-auto px-4 py-10 md:py-14 pb-32">
        <div className="flex items-center justify-between mb-6">
          <span className="n-step">Question {idx + 1} / {questions.length}</span>
          <span className="text-xs text-[var(--n-text-muted)]">{answeredCount} answered</span>
        </div>
        <div className="h-2 rounded-full mb-8" style={{ background: "#E8E6DC" }}>
          <div className="h-2 rounded-full transition-all" style={{ width: `${((idx + 1) / questions.length) * 100}%`, background: "#3699FC" }} />
        </div>

        <h2 className="text-2xl md:text-3xl font-black mb-8 leading-snug" style={{ color: "#221D23" }}>
          {q.scenario}
        </h2>

        <div className="space-y-3">
          {(["use", "partial", "avoid"] as Choice[]).map(c => {
            const s = CHOICE_STYLE[c];
            const label = c === "use" ? q.choice_use_label : c === "partial" ? q.choice_partial_label : q.choice_avoid_label;
            const isSel = answers[q.id] === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => pick(q, c)}
                className="n-card w-full text-left transition flex items-center gap-3"
                style={{
                  cursor: "pointer",
                  borderLeft: isSel ? `4px solid ${s.bg}` : "4px solid transparent",
                  background: isSel ? `${s.bg}15` : undefined,
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center font-bold flex-shrink-0"
                  style={{ background: s.bg, color: s.fg }}
                >
                  {c === "use" ? "✓" : c === "partial" ? "~" : "✗"}
                </div>
                <span className="font-semibold" style={{ color: "#221D23" }}>{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between mt-8">
          <button
            className="n-btn n-btn-ghost inline-flex items-center gap-1"
            disabled={idx === 0}
            onClick={() => setIdx(i => Math.max(0, i - 1))}
          >
            <ArrowLeft size={14} /> Previous
          </button>
          {idx < questions.length - 1 ? (
            <button
              className="n-btn n-btn-ghost inline-flex items-center gap-1"
              onClick={() => setIdx(i => Math.min(questions.length - 1, i + 1))}
            >
              Skip <ArrowRight size={14} />
            </button>
          ) : (
            <button className="n-btn n-btn-primary n-btn-press" onClick={handleSubmit} disabled={busy || !allAnswered}>
              {busy ? "Checking your AI judgment…" : allAnswered ? "See my score" : `${questions.length - answeredCount} left`}
            </button>
          )}
        </div>
      </div>
    </NudgeShell>
  );
}
