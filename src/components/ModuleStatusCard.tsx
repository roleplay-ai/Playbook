import Link from "next/link";
import { ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";

export type ModuleStatus = "not_started" | "in_progress" | "completed";

export function ModuleStatusCard({
  to,
  viewResultTo,
  accent,
  icon,
  tag,
  title,
  subtitle,
  body,
  startCta,
  status,
  resultSummary,
  retakeTo,
}: {
  to: string;
  viewResultTo?: string;
  accent: string;
  icon: React.ReactNode;
  tag: string;
  title: string;
  subtitle: string;
  body: string;
  startCta: string;
  status: ModuleStatus;
  resultSummary?: React.ReactNode;
  retakeTo?: string;
}) {
  const statusBadge =
    status === "completed" ? (
      <span
        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
        style={{ background: "#23CE6B", color: "white" }}
      >
        <CheckCircle2 size={12} /> Completed
      </span>
    ) : status === "in_progress" ? (
      <span
        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
        style={{ background: "#FFCE00", color: "#221D23" }}
      >
        In Progress
      </span>
    ) : (
      <span
        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
        style={{ background: "#E8E6DC", color: "#6B6B6B" }}
      >
        Not Started
      </span>
    );

  const isDone = status === "completed";

  return (
    <div
      className="n-card flex flex-col transition-all hover:shadow-lg"
      style={{
        borderTop: `4px solid ${accent}`,
        boxShadow: isDone ? `0 6px 24px ${accent}22, 0 2px 12px rgba(34,29,35,0.08)` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: accent }}
          >
            {icon}
          </div>
          <span className="n-step">{tag}</span>
        </div>
        {statusBadge}
      </div>

      <h2 className="text-2xl font-black mb-1" style={{ color: "#221D23" }}>
        {title}
      </h2>
      <p className="font-semibold mb-3" style={{ color: accent }}>
        {subtitle}
      </p>

      {isDone && resultSummary ? (
        <div className="mb-5">{resultSummary}</div>
      ) : (
        <p className="text-[var(--n-text-muted)] mb-5 flex-1">{body}</p>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        {isDone ? (
          <>
            <Link href={viewResultTo ?? to} className="n-btn n-btn-primary n-btn-press inline-flex items-center gap-1.5 !py-2 text-sm">
              View Result <ArrowRight size={14} />
            </Link>
            {retakeTo && (
              <Link href={retakeTo} className="n-btn n-btn-ghost n-btn-press inline-flex items-center gap-1.5 !py-2 text-sm">
                <RotateCcw size={13} /> Retake
              </Link>
            )}
          </>
        ) : (
          <Link href={to} className="n-btn n-btn-primary n-btn-press inline-flex items-center gap-1.5 !py-2 text-sm">
            {startCta} <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
