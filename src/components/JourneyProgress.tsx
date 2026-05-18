import { Check, Lock } from "lucide-react";

type Step = {
  label: string;
  color: string;
  status: "completed" | "current" | "upcoming";
};

export function JourneyProgress({
  steps,
  className = "",
}: {
  steps: Step[];
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 md:gap-3 flex-wrap ${className}`}>
      {steps.map((step, i) => {
        const isDone = step.status === "completed";
        const isCurrent = step.status === "current";
        const bg = isDone ? "#23CE6B" : isCurrent ? step.color : "#E8E6DC";
        const fg = isDone || isCurrent ? "#FFFFFF" : "#6B6B6B";
        return (
          <div key={i} className="flex items-center gap-2 md:gap-3">
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-black transition-all"
                style={{ background: bg, color: fg, boxShadow: isCurrent ? `0 0 0 4px ${step.color}33` : undefined }}
                aria-label={`${step.label} ${step.status}`}
              >
                {isDone ? <Check size={16} strokeWidth={3} /> : step.status === "upcoming" ? <Lock size={13} /> : i + 1}
              </div>
              <span
                className="font-semibold text-sm md:text-base"
                style={{ color: isDone || isCurrent ? "#221D23" : "#6B6B6B" }}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="hidden md:block w-10 h-0.5 rounded-full"
                style={{ background: isDone ? "#23CE6B" : "#C8C5BC" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
