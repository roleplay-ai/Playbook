"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors,
  useDraggable, useDroppable, DragOverlay,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { NudgeShell, BrandLoader } from "@/components/NudgeShell";
import { CATEGORIES, AI_CAPS, ROLES, PLACEHOLDER_BY_ROLE, hoursSaved } from "@/lib/constants";
import { recommendTools } from "@/lib/anthropic.actions";
import { toast } from "sonner";
import { Trash2, Sparkles, Plus, ChevronDown, ChevronUp } from "lucide-react";

type Classification = "yes" | "partly" | "no" | null;
type Row = {
  id: string;
  name: string;
  categories: string[];
  ai_capabilities: string[];
  weekly_hours: number;
  classification: Classification;
};

const CATEGORY_COLORS: Record<string, string> = {
  repeated: "n-pop-amber",
  brain: "n-pop-violet",
  time: "n-pop-fuchsia",
};
const CAP_COLORS: Record<string, string> = {
  read: "n-pop-blue",
  understand: "n-pop-violet",
  generate: "n-pop-emerald",
  classify: "n-pop-orange",
  extract: "n-pop-amber",
  image: "n-pop-fuchsia",
  talk: "n-pop-shadow",
};

const blankRow = (): Row => ({
  id: crypto.randomUUID(), name: "", categories: [], ai_capabilities: [],
  weekly_hours: 5, classification: "yes",
});

export default function ActivitiesPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([blankRow(), blankRow(), blankRow()]);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [activeDrag, setActiveDrag] = useState<{ kind: string; value: string } | null>(null);
  const [trayOpen, setTrayOpen] = useState(true);
  const [role, setRole] = useState<string>("Others");
  const [customRole, setCustomRole] = useState<string>("");
  const [sparkAt, setSparkAt] = useState<{ rowId: string; key: number } | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/"); return; }
    if (profile?.is_admin) { router.push("/admin"); return; }
    if (loadedRef.current || !user) return;
    loadedRef.current = true;

    const presetRole = profile?.role || "";
    if ((ROLES as readonly string[]).includes(presetRole)) {
      setRole(presetRole);
    } else if (presetRole) {
      setRole("Others"); setCustomRole(presetRole);
    }

    supabase.from("activities").select("*").eq("user_id", user.id).order("created_at").then(({ data }) => {
      const acts = (data ?? []) as unknown as Array<{
        id: string; name: string; categories: string[] | null; ai_capabilities: string[] | null;
        weekly_hours: number; ai_capable: string;
      }>;
      if (acts.length > 0) {
        setRows(acts.map(a => ({
          id: a.id, name: a.name,
          categories: a.categories ?? [],
          ai_capabilities: a.ai_capabilities ?? [],
          weekly_hours: Number(a.weekly_hours),
          classification: (a.ai_capable === "yes" || a.ai_capable === "partly" || a.ai_capable === "no") ? a.ai_capable as Classification : null,
        })));
      }
    });
  }, [loading, user, profile, router]);

  useEffect(() => {
    if (!user || !loadedRef.current) return;
    const t = setTimeout(async () => {
      const complete = rows.filter(r => r.name.trim() && r.weekly_hours > 0);
      const payload = complete.map(r => ({
        id: r.id, user_id: user.id, name: r.name,
        categories: r.categories, ai_capabilities: r.ai_capabilities,
        weekly_hours: r.weekly_hours,
        ai_capable: (r.classification ?? "yes") as string,
        hours_saved: hoursSaved(r.weekly_hours, (r.classification ?? "yes") as string),
      }));
      if (payload.length > 0) await supabase.from("activities").upsert(payload as any);
      const keepIds = complete.map(r => r.id);
      if (keepIds.length > 0) {
        await supabase.from("activities").delete().eq("user_id", user.id).not("id", "in", `(${keepIds.join(",")})`);
      } else {
        await supabase.from("activities").delete().eq("user_id", user.id);
      }
      setSavedAt(Date.now());
    }, 800);
    return () => clearTimeout(t);
  }, [rows, user]);

  useEffect(() => {
    if (!user || !loadedRef.current) return;
    const value = role === "Others" ? (customRole.trim() || "Others") : role;
    const t = setTimeout(() => {
      (supabase.from("profiles") as any).update({ role: value }).eq("id", user.id);
    }, 400);
    return () => clearTimeout(t);
  }, [role, customRole, user]);

  const update = (id: string, patch: Partial<Row>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  const addChip = (key: "categories" | "ai_capabilities", id: string, val: string) => {
    setRows(prev => prev.map(r =>
      r.id === id && !r[key].includes(val) ? { ...r, [key]: [...r[key], val] } : r
    ));
    setSparkAt({ rowId: id, key: Date.now() });
  };
  const removeChip = (key: "categories" | "ai_capabilities", id: string, val: string) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: r[key].filter(x => x !== val) } : r));

  const removeRow = (id: string) => {
    const r = rows.find(x => x.id === id);
    const hasData = !!r && (r.name.trim() || r.categories.length || r.ai_capabilities.length || r.classification);
    if (hasData && !confirm("Remove this activity?")) return;
    setRows(prev => prev.filter(x => x.id !== id));
  };
  const addRow = () => setRows(prev => [...prev, blankRow()]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  function onDragStart(e: DragStartEvent) {
    const data = e.active.data.current as { kind: string; value: string } | undefined;
    if (data) setActiveDrag(data);
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;
    const data = active.data.current as { kind: string; value: string } | undefined;
    const overId = String(over.id);
    if (!data) return;
    if (data.kind === "category" && overId.startsWith("cat-zone:")) {
      addChip("categories", overId.slice("cat-zone:".length), data.value);
    } else if (data.kind === "capability" && overId.startsWith("cap-zone:")) {
      addChip("ai_capabilities", overId.slice("cap-zone:".length), data.value);
    }
  }

  const placeholder = PLACEHOLDER_BY_ROLE[role] || PLACEHOLDER_BY_ROLE["Others"];

  const isComplete = (r: Row) => !!r.name.trim() && r.weekly_hours > 0;
  const readyCount = useMemo(() => rows.filter(isComplete).length, [rows]);
  const canSubmit = readyCount > 0;

  async function handleGenerate() {
    if (!user || !profile) return;
    const valid = rows.filter(isComplete);
    if (valid.length === 0) { toast.error("Fill at least one activity with hours and a Yes/Partly/No choice"); return; }
    setBusy(true); setGenerating(true);
    try {
      const payload = valid.map(r => ({
        id: r.id, user_id: user.id, name: r.name,
        categories: r.categories, ai_capabilities: r.ai_capabilities,
        weekly_hours: r.weekly_hours, ai_capable: (r.classification ?? "yes") as string,
        hours_saved: hoursSaved(r.weekly_hours, (r.classification ?? "yes") as string),
      }));
      await supabase.from("activities").upsert(payload as any);
      await supabase.from("activities").delete().eq("user_id", user.id).not("id", "in", `(${valid.map(v => v.id).join(",")})`);

      const roleValue = role === "Others" ? (customRole.trim() || "Other") : role;
      const reqs = valid.filter(v => (v.classification ?? "yes") !== "no").map(v => ({
        id: v.id, name: v.name, role: roleValue,
        capabilities: v.ai_capabilities, weekly_hours: v.weekly_hours,
        ai_capable: (v.classification ?? "yes") as "yes" | "partly" | "no",
      }));
      if (reqs.length > 0) {
        const { results } = await recommendTools(reqs);
        await Promise.all(results.map(r => {
          const update: {
            recommended_tool: string; how_to: string;
            ai_bullets: { text: string; hours_saved: number }[];
            clarity: string; hours_saved?: number;
          } = {
            recommended_tool: r.tool,
            how_to: r.how_to,
            ai_bullets: r.bullets ?? [],
            clarity: r.clarity ?? "clear",
          };
          if (r.total_saved && r.total_saved > 0) update.hours_saved = r.total_saved;
          return (supabase.from("activities") as any).update(update).eq("id", r.id);
        }));
      }
      router.push("/results");
    } catch (e) {
      toast.error((e as Error).message);
      setGenerating(false);
    } finally {
      setBusy(false);
    }
  }

  if (generating) {
    return (
      <NudgeShell>
        <BrandLoader messages={[
          "Mapping your AI application opportunities… 🗺️",
          "Asking the AI brain for tips… 🧠",
          "Calculating your time freedom… ⏰",
          "Wrapping it up with a bow… 🎁",
        ]} />
      </NudgeShell>
    );
  }

  return (
    <NudgeShell>
      {savedAt > 0 && <div key={savedAt} className="n-saved-pill">✓ Saved</div>}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 pb-40">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <label className="n-label !mb-0">I work in:</label>
            <select
              className="n-input !w-auto !py-2"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {role === "Others" && (
              <input
                className="n-input !w-auto !py-2"
                placeholder="(type your role)"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
              />
            )}
          </div>

          <h1 className="font-black mb-2 text-[var(--n-shadow)] text-[36px] md:text-[42px] leading-tight" style={{ letterSpacing: "-0.5px", fontWeight: 900 }}>
            Map your <span style={{ color: "#F68A29" }}>weekly</span> Activities
          </h1>
          <p className="text-[var(--n-text-muted)] mb-6">
            Add 3–5 things you do every week. Drag the chips. Submit.
          </p>

          <div className="n-tbl">
            <div className="n-tbl-head">
              <div>#</div>
              <div>Activity</div>
              <div>Categories</div>
              <div>AI Capabilities</div>
              <div>Weekly Hours</div>
              <div>Can AI do this?</div>
              <div></div>
            </div>
            {rows.map((r, idx) => (
              <RowEditor
                key={r.id}
                row={r}
                index={idx + 1}
                placeholder={placeholder}
                sparkOn={sparkAt?.rowId === r.id ? sparkAt.key : 0}
                onChange={(patch) => update(r.id, patch)}
                onRemoveCat={(v) => removeChip("categories", r.id, v)}
                onRemoveCap={(v) => removeChip("ai_capabilities", r.id, v)}
                onDelete={() => removeRow(r.id)}
              />
            ))}
          </div>

          <div className="flex justify-center">
            <button type="button" className="n-add-row" onClick={addRow}>
              <Plus size={18} /> Add another activity
            </button>
          </div>

          <div className="flex flex-col items-center mt-10 gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={busy || !canSubmit}
              title={!canSubmit ? "Add at least one activity name to continue." : ""}
              className={`n-cta-mega ${canSubmit ? "is-ready" : ""}`}
            >
              <Sparkles size={18} className="mr-2" /> Find My AI Opportunities
            </button>
            {!canSubmit && (
              <p className="text-xs text-[var(--n-text-muted)]">
                Add at least one activity name to continue.
              </p>
            )}
            {canSubmit && (
              <p className="text-xs text-[var(--n-text-muted)]">
                {readyCount} activit{readyCount === 1 ? "y" : "ies"} ready
              </p>
            )}
          </div>
        </div>

        {trayOpen ? (
          <div className="n-tray">
            <div className="flex items-center justify-between mb-2">
              <span className="n-tray-label">Drag chips into your activities ↑</span>
              <button type="button" className="n-tray-toggle" onClick={() => setTrayOpen(false)}>
                <ChevronDown size={14} /> hide
              </button>
            </div>
            <div className="n-tray-row">
              <span className="n-tray-label">Categories</span>
              {CATEGORIES.map(c => (
                <DraggableChip key={c.id} dragId={`cat:${c.id}`} data={{ kind: "category", value: c.id }} colorClass={CATEGORY_COLORS[c.id]}>
                  {c.label}
                </DraggableChip>
              ))}
            </div>
            <div className="n-tray-row mt-1">
              <span className="n-tray-label">AI Caps</span>
              {AI_CAPS.map(c => (
                <DraggableChip key={c.id} dragId={`cap:${c.id}`} data={{ kind: "capability", value: c.id }} colorClass={CAP_COLORS[c.id]}>
                  {c.label}
                </DraggableChip>
              ))}
            </div>
          </div>
        ) : (
          <div className="n-tray-collapsed">
            <button type="button" className="n-tray-show" onClick={() => setTrayOpen(true)}>
              <ChevronUp size={16} className="inline mr-1" /> Show chips
            </button>
          </div>
        )}

        <DragOverlay>
          {activeDrag && activeDrag.kind === "category" && (
            <span className={`n-pop ${CATEGORY_COLORS[activeDrag.value]}`} style={{ transform: "rotate(3deg) scale(1.1)" }}>
              {CATEGORIES.find(c => c.id === activeDrag.value)?.label}
            </span>
          )}
          {activeDrag && activeDrag.kind === "capability" && (
            <span className={`n-pop ${CAP_COLORS[activeDrag.value]}`} style={{ transform: "rotate(3deg) scale(1.1)" }}>
              {AI_CAPS.find(c => c.id === activeDrag.value)?.label}
            </span>
          )}
        </DragOverlay>
      </DndContext>
    </NudgeShell>
  );
}

function DraggableChip({ dragId, data, colorClass, children }: {
  dragId: string; data: { kind: string; value: string }; colorClass: string; children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId, data });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      className={`n-pop ${colorClass}`}
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: "none" }}
    >
      {children}
    </button>
  );
}

function RowEditor({ row, index, placeholder, sparkOn, onChange, onRemoveCat, onRemoveCap, onDelete }: {
  row: Row; index: number; placeholder: string; sparkOn: number;
  onChange: (patch: Partial<Row>) => void;
  onRemoveCat: (v: string) => void;
  onRemoveCap: (v: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="n-row n-row-enter">
      <div>
        <span className="n-row-num">{index}</span>
      </div>

      <div>
        <div className="n-cell-label">Activity</div>
        <input
          className="n-row-input"
          value={row.name}
          placeholder={placeholder}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div>
        <div className="n-cell-label">Categories</div>
        <DropCell
          dropId={`cat-zone:${row.id}`}
          items={row.categories}
          getLabel={(v) => CATEGORIES.find(c => c.id === v)?.label || v}
          getColor={(v) => CATEGORY_COLORS[v] || "n-pop-shadow"}
          onRemove={onRemoveCat}
          sparkOn={sparkOn}
        />
      </div>

      <div>
        <div className="n-cell-label">AI Capabilities</div>
        <DropCell
          dropId={`cap-zone:${row.id}`}
          items={row.ai_capabilities}
          getLabel={(v) => AI_CAPS.find(c => c.id === v)?.label || v}
          getColor={(v) => CAP_COLORS[v] || "n-pop-shadow"}
          onRemove={onRemoveCap}
          sparkOn={sparkOn}
        />
      </div>

      <div>
        <div className="n-cell-label">Weekly Hours</div>
        <div className="n-row-slider-wrap">
          <input
            type="range" min={0.5} max={40} step={0.5}
            value={row.weekly_hours}
            className="n-slider"
            onChange={(e) => onChange({ weekly_hours: Number(e.target.value) })}
          />
          <span className="n-row-hours">{row.weekly_hours}</span>
        </div>
      </div>

      <div>
        <div className="n-cell-label">Can AI do this?</div>
        <div className="n-yespill-group">
          <button type="button"
            className={`n-yespill ${row.classification === "yes" ? "is-yes-on" : ""}`}
            onClick={() => onChange({ classification: row.classification === "yes" ? null : "yes" })}>
            ✅ Yes
          </button>
          <button type="button"
            className={`n-yespill ${row.classification === "partly" ? "is-partly-on" : ""}`}
            onClick={() => onChange({ classification: row.classification === "partly" ? null : "partly" })}>
            ⚡ Partly
          </button>
          <button type="button"
            className={`n-yespill ${row.classification === "no" ? "is-no-on" : ""}`}
            onClick={() => onChange({ classification: row.classification === "no" ? null : "no" })}>
            🧠 No
          </button>
        </div>
      </div>

      <div className="flex md:justify-end">
        <button type="button" className="n-row-trash" onClick={onDelete} aria-label="Remove activity">
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

function DropCell({ dropId, items, getLabel, getColor, onRemove, sparkOn }: {
  dropId: string; items: string[];
  getLabel: (v: string) => string;
  getColor: (v: string) => string;
  onRemove: (v: string) => void;
  sparkOn: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  const filled = items.length > 0;
  return (
    <div
      ref={setNodeRef}
      className={`n-dropzone ${isOver ? "is-over" : ""} ${filled ? "has-chips" : ""}`}
    >
      {!filled && <span className="n-dropzone-ghost">Drop chips here</span>}
      {items.map(v => (
        <span key={v} className={`n-dropchip ${getColor(v)}`}>
          {getLabel(v)}
          <button type="button" className="n-dropchip-x" onClick={() => onRemove(v)} aria-label={`Remove ${getLabel(v)}`}>×</button>
        </span>
      ))}
      {sparkOn > 0 && <span key={sparkOn} className="n-sparkle">✨</span>}
    </div>
  );
}
