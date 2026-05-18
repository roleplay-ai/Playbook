import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { NudgeShell } from "@/components/NudgeShell";
import { Compass, ShieldCheck, Target, Users, BarChart3, Trophy, AlertTriangle } from "lucide-react";
import { getPlaybookSummary, getAdminPlaybookOverview } from "@/lib/playbook.functions";
import { LEVEL_COLORS } from "@/routes/cab-diagnostic";
import { JourneyProgress } from "@/components/JourneyProgress";
import { ModuleStatusCard, type ModuleStatus } from "@/components/ModuleStatusCard";

export const Route = createFileRoute("/hub")({
  component: HubPage,
  head: () => ({
    meta: [
      { title: "AI for Work Playbook" },
      { name: "description", content: "Know your AI level, learn where AI fits, find your best opportunities." },
    ],
  }),
});

type Summary = Awaited<ReturnType<typeof getPlaybookSummary>>;
type AdminOverview = Awaited<ReturnType<typeof getAdminPlaybookOverview>>;

function HubPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const summaryFn = useServerFn(getPlaybookSummary);
  const adminFn = useServerFn(getAdminPlaybookOverview);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [admin, setAdmin] = useState<AdminOverview | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/" }); return; }
    summaryFn().then(setSummary).catch(() => {});
    if (profile?.is_admin) {
      adminFn().then(setAdmin).catch(() => {});
    }
  }, [loading, user, profile, navigate, summaryFn, adminFn]);

  const cabStatus: ModuleStatus = summary?.cab ? "completed" : "not_started";
  const fitStatus: ModuleStatus = summary?.fit ? "completed" : "not_started";
  const oppStatus: ModuleStatus = summary && summary.opportunityCount > 0 ? "completed" : "not_started";

  const completedCount = [cabStatus, fitStatus, oppStatus].filter(s => s === "completed").length;

  // First incomplete is "current", rest after current are "upcoming"
  const journeySteps = useMemo(() => {
    const order: Array<{ status: ModuleStatus; label: string; color: string }> = [
      { status: cabStatus, label: "CAB Ladder", color: "#623CEA" },
      { status: fitStatus, label: "AI Fit Test", color: "#3699FC" },
      { status: oppStatus, label: "AI Application Opportunities", color: "#F68A29" },
    ];
    let foundCurrent = false;
    return order.map(s => {
      if (s.status === "completed") return { ...s, status: "completed" as const };
      if (!foundCurrent) { foundCurrent = true; return { ...s, status: "current" as const }; }
      return { ...s, status: "upcoming" as const };
    });
  }, [cabStatus, fitStatus, oppStatus]);

  const microcopy =
    completedCount === 0 ? "This is where your AI journey gets practical." :
    completedCount === 1 ? "Nice. Your first step is done." :
    completedCount === 2 ? "You are moving from learning AI to applying AI." :
                           "You have unlocked the full Playbook.";

  const cabBadge = summary?.cab
    ? { code: summary.cab.final_level, name: summary.cab.final_level_name }
    : null;
  const cabColors = cabBadge ? LEVEL_COLORS[cabBadge.code] ?? { bg: "#221D23", fg: "#FFF" } : null;

  // ===== ADMIN VIEW =====
  if (profile?.is_admin) {
    return (
      <NudgeShell>
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
          <section className="mb-8">
            <p className="n-step mb-3">Facilitator</p>
            <h1 className="text-4xl md:text-5xl font-black leading-tight mb-3" style={{ color: "#221D23" }}>
              Company <span style={{ color: "#623CEA" }}>results</span> overview
            </h1>
            <p className="text-[var(--n-text-muted)] max-w-2xl text-lg">
              See how participants are progressing across the CAB Ladder, AI Fit Test, and
              AI Application Opportunities — and manage the questions behind each module.
            </p>
          </section>

          {admin ? (
            <>
              <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <AdminStat icon={<Users size={18} />} label="Total participants" value={admin.totalUsers} />
                <AdminStat
                  icon={<BarChart3 size={18} />}
                  label="Avg AI Fit Test"
                  value={`${admin.avgFit.toFixed(1)} / ${admin.fitTotal}`}
                />
                <AdminStat
                  icon={<Trophy size={18} />}
                  label="High-priority opportunities"
                  value={admin.highPriorityOpps}
                />
                <div className="n-card">
                  <p className="text-xs text-[var(--n-text-muted)] mb-2">CAB distribution</p>
                  <div className="flex items-end gap-1 h-12">
                    {Object.entries(admin.cabDistribution).map(([lvl, n]) => {
                      const max = Math.max(...Object.values(admin.cabDistribution), 1);
                      const c = LEVEL_COLORS[lvl] ?? { bg: "#221D23", fg: "#FFF" };
                      return (
                        <div key={lvl} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full rounded-t" style={{ height: `${(n / max) * 100}%`, background: c.bg, minHeight: 2 }} />
                          <span className="text-[10px] font-bold" style={{ color: "#221D23" }}>{lvl}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {admin.topMissed.length > 0 && (
                <section className="n-card mb-6">
                  <p className="n-step mb-2 flex items-center gap-1"><AlertTriangle size={14} /> Top missed AI Fit scenarios</p>
                  <ul className="space-y-1 text-sm" style={{ color: "#221D23" }}>
                    {admin.topMissed.map(m => (
                      <li key={m.scenario}>• {m.scenario} <span className="text-[var(--n-text-muted)]">({m.misses} misses)</span></li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--n-text-muted)] mb-6">Loading overview…</p>
          )}

          <section className="mb-10">
            <p className="n-step mb-3">Manage modules</p>
            <div className="grid md:grid-cols-3 gap-4">
              <Link to="/admin" search={{ tab: "audit" }} className="n-card hover:shadow-md transition block" style={{ borderTop: "4px solid #F68A29" }}>
                <p className="n-step mb-2" style={{ color: "#F68A29" }}>Application</p>
                <h3 className="font-black text-lg mb-1" style={{ color: "#221D23" }}>AI Application Opportunities</h3>
                <p className="text-sm text-[var(--n-text-muted)]">View cohort activities, hours saved, and tool usage.</p>
              </Link>
              <Link to="/admin" search={{ tab: "cab" }} className="n-card hover:shadow-md transition block" style={{ borderTop: "4px solid #623CEA" }}>
                <p className="n-step mb-2" style={{ color: "#623CEA" }}>Diagnostic</p>
                <h3 className="font-black text-lg mb-1" style={{ color: "#221D23" }}>CAB Ladder</h3>
                <p className="text-sm text-[var(--n-text-muted)]">See level distribution, per-user results, edit questions & levels.</p>
              </Link>
              <Link to="/admin" search={{ tab: "fit" }} className="n-card hover:shadow-md transition block" style={{ borderTop: "4px solid #3699FC" }}>
                <p className="n-step mb-2" style={{ color: "#3699FC" }}>Judgement</p>
                <h3 className="font-black text-lg mb-1" style={{ color: "#221D23" }}>AI Fit Test</h3>
                <p className="text-sm text-[var(--n-text-muted)]">Per-user scores, missed scenarios, edit the scenario bank.</p>
              </Link>
            </div>
          </section>
        </div>
      </NudgeShell>
    );
  }

  // ===== PARTICIPANT VIEW =====
  return (
    <NudgeShell>
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
        {/* HERO */}
        <section className="mb-10">
          <p className="n-step mb-3">AI for Work Playbook</p>
          <h1 className="text-4xl md:text-6xl font-black leading-tight mb-3" style={{ color: "#221D23" }}>
            Move from <span style={{ color: "#F68A29" }}>random AI use</span><br />
            to real AI <span style={{ color: "#623CEA" }}>application</span> at work.
          </h1>
          <p className="text-[var(--n-text-muted)] mb-6 max-w-2xl text-lg">
            Understand your AI fluency, build judgement on where AI fits, and identify the work
            activities where AI can create real productivity gains.
          </p>
        </section>

        {/* JOURNEY PROGRESS */}
        <section className="mb-10">
          <div className="n-card" style={{ background: "linear-gradient(135deg, #FFFDF5 0%, #FFF6CF 100%)" }}>
            <p className="n-step mb-3">Your journey</p>
            <JourneyProgress steps={journeySteps} className="mb-4" />
            <p className="text-sm font-semibold" style={{ color: "#221D23" }}>{microcopy}</p>
          </div>
        </section>

        {/* MODULE CARDS */}
        <section className="mb-12">
          <div className="grid md:grid-cols-3 gap-5">
            <ModuleStatusCard
              to="/cab-diagnostic"
              accent="#623CEA"
              icon={<Compass size={22} color="white" />}
              tag="Diagnostic"
              title="CAB Ladder"
              subtitle="Find your AI fluency level."
              body="Discover whether you use AI mainly to chat, automate work, or build tools and systems."
              startCta="Start CAB Ladder"
              status={cabStatus}
              retakeTo="/cab-diagnostic"
              resultSummary={cabBadge && cabColors ? (
                <div>
                  <p className="text-xs text-[var(--n-text-muted)] mb-2">Your level</p>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-black"
                      style={{ background: cabColors.bg, color: cabColors.fg }}
                    >
                      {cabBadge.code}
                    </div>
                    <p className="font-bold text-lg" style={{ color: "#221D23" }}>{cabBadge.name}</p>
                  </div>
                </div>
              ) : undefined}
            />
            <ModuleStatusCard
              to="/ai-fit-test"
              accent="#3699FC"
              icon={<ShieldCheck size={22} color="white" />}
              tag="Judgement"
              title="AI Fit Test"
              subtitle="Learn where AI fits — and where to avoid it."
              body="Practice judging real workplace activities. Use AI, use it Partially, or Avoid it."
              startCta="Take AI Fit Test"
              status={fitStatus}
              retakeTo="/ai-fit-test"
              resultSummary={summary?.fit ? (
                <div>
                  <p className="text-xs text-[var(--n-text-muted)] mb-2">Your score</p>
                  <p className="text-3xl font-black" style={{ color: "#221D23" }}>
                    {summary.fit.score}
                    <span className="text-base text-[var(--n-text-muted)] font-semibold"> / {summary.fit.total}</span>
                  </p>
                </div>
              ) : undefined}
            />
            <ModuleStatusCard
              to="/activities"
              viewResultTo="/results"
              accent="#F68A29"
              icon={<Target size={22} color="white" />}
              tag="Application"
              title="AI Application Opportunities"
              subtitle="Find where AI can save time in your work."
              body="Map your weekly activities and identify where AI can help you create the most value."
              startCta="Find My AI Opportunities"
              status={oppStatus}
              retakeTo="/activities"
              resultSummary={summary && summary.opportunityCount > 0 ? (
                <div>
                  <p className="text-xs text-[var(--n-text-muted)] mb-2">Opportunities mapped</p>
                  <p className="text-3xl font-black" style={{ color: "#221D23" }}>
                    {summary.opportunityCount}
                    <span className="text-base text-[var(--n-text-muted)] font-semibold"> activities</span>
                  </p>
                </div>
              ) : undefined}
            />
          </div>
        </section>
      </div>
    </NudgeShell>
  );
}

function AdminStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="n-card">
      <p className="text-xs text-[var(--n-text-muted)] mb-2 flex items-center gap-1">{icon} {label}</p>
      <p className="text-3xl font-black" style={{ color: "#221D23" }}>{value}</p>
    </div>
  );
}
