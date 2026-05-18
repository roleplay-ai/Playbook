import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { NudgeShell } from "@/components/NudgeShell";
import { adminAddCompany, adminDeleteUser, adminGetAll } from "@/lib/admin.functions";
import {
  adminGetCabOverview, adminUpsertCabQuestion, adminDeleteCabQuestion, adminUpsertCabLevelDefinition,
} from "@/lib/cab.functions";
import { adminGetAiFitOverview, adminUpsertAiFitQuestion, adminDeleteAiFitQuestion } from "@/lib/ai-fit.functions";
import { LEVEL_COLORS } from "@/routes/cab-diagnostic";
import { ROLES } from "@/lib/constants";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Plus, Trash2, X, Download, Pencil, Save } from "lucide-react";

type AdminTab = "audit" | "cab" | "fit";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  validateSearch: (s: Record<string, unknown>): { tab?: AdminTab } => {
    const t = s.tab;
    return t === "cab" || t === "fit" || t === "audit" ? { tab: t } : {};
  },
});

type Profile = { id: string; username: string; company_id: string | null; role: string | null; is_admin: boolean; created_at: string };
type Company = { id: string; name: string };
type Activity = {
  id: string; user_id: string; name: string; categories: string[]; ai_capabilities: string[];
  weekly_hours: number; ai_capable: string; recommended_tool: string | null; how_to: string | null; hours_saved: number;
  commitment?: string | null; ai_bullets?: Array<{ text: string; hours_saved: number }> | null; clarity?: string | null;
};

type AuditSortKey = "name" | "company" | "role" | "acts" | "spent" | "saved";
type SortDir = "asc" | "desc";

function SortHeader({ label, active, dir, onClick, align = "left" }: { label: string; active: boolean; dir: SortDir; onClick: () => void; align?: "left" | "right" }) {
  return (
    <th className={`py-2 pr-3 ${align === "right" ? "text-right" : ""} cursor-pointer select-none hover:text-[var(--n-text)]`} onClick={onClick}>
      {label}{active ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}
type Commitment = { user_id: string; position: number; text: string };

function AdminPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const getAll = useServerFn(adminGetAll);
  const addCompany = useServerFn(adminAddCompany);
  const deleteUser = useServerFn(adminDeleteUser);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [fCompany, setFCompany] = useState("");
  const [fRole, setFRole] = useState("");
  const [fAi, setFAi] = useState<"all" | "yes" | "partly">("all");
  const [drawerUser, setDrawerUser] = useState<Profile | null>(null);
  const [sortKey, setSortKey] = useState<AuditSortKey>("saved");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  function toggleSort(k: AuditSortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "name" || k === "company" || k === "role" ? "asc" : "desc"); }
  }
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const search = Route.useSearch();
  const [tab, setTab] = useState<AdminTab>(search.tab ?? "audit");
  useEffect(() => { if (search.tab) setTab(search.tab); }, [search.tab]);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/" }); return; }
    if (!profile?.is_admin) { navigate({ to: "/activities" }); return; }
    refresh();
  }, [loading, user, profile, navigate]);

  async function refresh() {
    setLoadingData(true);
    try {
      const res = await getAll();
      setProfiles(res.profiles as Profile[]);
      setActivities(res.activities as Activity[]);
      setCommitments(res.commitments as Commitment[]);
      setCompanies(res.companies as Company[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingData(false);
    }
  }

  const filteredProfiles = useMemo(() => profiles.filter(p =>
    (!fCompany || p.company_id === fCompany) &&
    (!fRole || p.role === fRole)
  ), [profiles, fCompany, fRole]);

  const userActivityMap = useMemo(() => {
    const map = new Map<string, Activity[]>();
    activities.forEach(a => {
      if (fAi !== "all" && a.ai_capable !== fAi) return;
      const arr = map.get(a.user_id) ?? [];
      arr.push(a); map.set(a.user_id, arr);
    });
    return map;
  }, [activities, fAi]);

  const visibleActivities = useMemo(() => {
    const userIds = new Set(filteredProfiles.map(p => p.id));
    return activities.filter(a => userIds.has(a.user_id) && (fAi === "all" || a.ai_capable === fAi));
  }, [activities, filteredProfiles, fAi]);

  const stats = useMemo(() => {
    const totalParticipants = profiles.length;
    const totalCompanies = companies.length;
    const totalHrs = activities.reduce((s, a) => s + Number(a.weekly_hours), 0);
    const totalSaved = activities.reduce((s, a) => s + Number(a.hours_saved), 0);
    return { totalParticipants, totalCompanies, totalHrs, totalSaved };
  }, [profiles, companies, activities]);

  const topActivities = useMemo(() => {
    const counts = new Map<string, number>();
    visibleActivities.forEach(a => {
      const k = a.name.trim().toLowerCase();
      if (!k) return;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, count]) => ({ name: name.length > 32 ? name.slice(0, 32) + "…" : name, count }));
  }, [visibleActivities]);

  const topTools = useMemo(() => {
    const counts = new Map<string, number>();
    visibleActivities.forEach(a => {
      if (!a.recommended_tool) return;
      counts.set(a.recommended_tool, (counts.get(a.recommended_tool) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [visibleActivities]);

  const aiDistribution = useMemo(() => {
    const c = { yes: 0, partly: 0, no: 0 };
    visibleActivities.forEach(a => { c[a.ai_capable as keyof typeof c] = (c[a.ai_capable as keyof typeof c] ?? 0) + 1; });
    return [
      { name: "Yes", value: c.yes, fill: "#23CE68" },
      { name: "Partly", value: c.partly, fill: "#FFCE00" },
      { name: "No", value: c.no, fill: "#ED4551" },
    ].filter(x => x.value > 0);
  }, [visibleActivities]);

  async function handleAddCompany() {
    if (!newCompany.trim()) return;
    const r = await addCompany({ data: { name: newCompany.trim() } });
    if (!r.ok) return toast.error(r.error || "Failed");
    toast.success("Company added");
    setNewCompany(""); setShowAddCompany(false);
    refresh();
  }

  async function handleDeleteUser(uid: string, username: string) {
    if (!confirm(`Delete user @${username}? This wipes all their data.`)) return;
    const r = await deleteUser({ data: { user_id: uid } });
    if (!r.ok) return toast.error(r.error || "Failed");
    toast.success("User deleted");
    refresh();
  }

  function exportCsv() {
    const rows = [["username", "company", "role", "activity", "categories", "ai_capabilities", "weekly_hours", "ai_capable", "hours_saved", "recommended_tool", "how_to"]];
    const profById = new Map(profiles.map(p => [p.id, p]));
    const compById = new Map(companies.map(c => [c.id, c.name]));
    visibleActivities.forEach(a => {
      const p = profById.get(a.user_id);
      if (!p) return;
      rows.push([
        p.username, compById.get(p.company_id ?? "") ?? "", p.role ?? "",
        a.name, a.categories.join("|"), a.ai_capabilities.join("|"),
        String(a.weekly_hours), a.ai_capable, String(a.hours_saved),
        a.recommended_tool ?? "", a.how_to ?? "",
      ]);
    });
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `audit-export-${Date.now()}.csv`; link.click();
    URL.revokeObjectURL(url);
  }

  if (loading || loadingData) {
    return <NudgeShell><div className="p-12 text-center text-[var(--n-text-muted)]">Loading dashboard…</div></NudgeShell>;
  }

  return (
    <NudgeShell>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <p className="n-step mb-2">Facilitator</p>
            <h1 className="text-3xl md:text-4xl font-black">Admin Dashboard</h1>
          </div>
          <div className="flex gap-2">
            <button className="n-btn n-btn-ghost flex items-center gap-2" onClick={() => setShowAddCompany(true)}>
              <Plus size={16} /> Add Company
            </button>
            <button className="n-btn n-btn-dark flex items-center gap-2" onClick={exportCsv}>
              <Download size={16} /> Export CSV
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-[var(--n-border)] overflow-x-auto">
          <button
            className="px-4 py-2 font-semibold text-sm transition whitespace-nowrap"
            style={{
              borderBottom: tab === "audit" ? "2px solid #F68A29" : "2px solid transparent",
              color: tab === "audit" ? "#221D23" : "var(--n-text-muted)",
            }}
            onClick={() => setTab("audit")}
          >
            AI Application Opportunities Admin
          </button>
          <button
            className="px-4 py-2 font-semibold text-sm transition whitespace-nowrap"
            style={{
              borderBottom: tab === "cab" ? "2px solid #623CEA" : "2px solid transparent",
              color: tab === "cab" ? "#221D23" : "var(--n-text-muted)",
            }}
            onClick={() => setTab("cab")}
          >
            CAB Ladder Admin
          </button>
          <button
            className="px-4 py-2 font-semibold text-sm transition whitespace-nowrap"
            style={{
              borderBottom: tab === "fit" ? "2px solid #3699FC" : "2px solid transparent",
              color: tab === "fit" ? "#221D23" : "var(--n-text-muted)",
            }}
            onClick={() => setTab("fit")}
          >
            AI Fit Test Admin
          </button>
        </div>

        {tab === "cab" ? (
          <CabAdmin companies={companies} profiles={profiles} />
        ) : tab === "fit" ? (
          <FitAdmin profiles={profiles} companies={companies} />
        ) : (
        <div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="n-stat n-stat-amber"><div className="n-stat-num">{stats.totalParticipants}</div><div className="n-stat-label">Participants</div></div>
          <div className="n-stat n-stat-blue"><div className="n-stat-num">{stats.totalCompanies}</div><div className="n-stat-label">Companies</div></div>
          <div className="n-stat n-stat-orange"><div className="n-stat-num">{stats.totalHrs.toFixed(0)}</div><div className="n-stat-label">Weekly hrs audited</div></div>
          <div className="n-stat n-stat-emerald"><div className="n-stat-num">{stats.totalSaved.toFixed(0)}</div><div className="n-stat-label">Weekly hrs saved</div></div>
        </div>

        {/* Filters */}
        <div className="n-card mb-6">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="n-label">Company</label>
              <select className="n-input" value={fCompany} onChange={(e) => setFCompany(e.target.value)}>
                <option value="">All companies</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="n-label">Role</label>
              <select className="n-input" value={fRole} onChange={(e) => setFRole(e.target.value)}>
                <option value="">All roles</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="n-label">AI capable</label>
              <div className="flex gap-2 mt-1">
                {(["all", "yes", "partly"] as const).map(v => (
                  <button key={v} className={`n-chip ${fAi === v ? "n-chip-active" : ""}`} onClick={() => setFAi(v)}>{v}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="n-card mb-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--n-text-muted)] border-b border-[var(--n-border)]">
                <SortHeader label="Username" active={sortKey==="name"} dir={sortDir} onClick={() => toggleSort("name")} />
                <SortHeader label="Company" active={sortKey==="company"} dir={sortDir} onClick={() => toggleSort("company")} />
                <SortHeader label="Role" active={sortKey==="role"} dir={sortDir} onClick={() => toggleSort("role")} />
                <SortHeader label="# Acts" active={sortKey==="acts"} dir={sortDir} onClick={() => toggleSort("acts")} align="right" />
                <SortHeader label="Hrs spent" active={sortKey==="spent"} dir={sortDir} onClick={() => toggleSort("spent")} align="right" />
                <SortHeader label="Hrs saved" active={sortKey==="saved"} dir={sortDir} onClick={() => toggleSort("saved")} align="right" />
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows = filteredProfiles.map(p => {
                  const acts = userActivityMap.get(p.id) ?? [];
                  const spent = acts.reduce((s, a) => s + Number(a.weekly_hours), 0);
                  const saved = acts.reduce((s, a) => s + Number(a.hours_saved), 0);
                  const compName = companies.find(c => c.id === p.company_id)?.name ?? "—";
                  return { p, acts, spent, saved, compName };
                });
                const dir = sortDir === "asc" ? 1 : -1;
                rows.sort((a, b) => {
                  switch (sortKey) {
                    case "name": return a.p.username.localeCompare(b.p.username) * dir;
                    case "company": return a.compName.localeCompare(b.compName) * dir;
                    case "role": return (a.p.role ?? "").localeCompare(b.p.role ?? "") * dir;
                    case "acts": return (a.acts.length - b.acts.length) * dir;
                    case "spent": return (a.spent - b.spent) * dir;
                    case "saved": return (a.saved - b.saved) * dir;
                    default: return 0;
                  }
                });
                return rows.map(({ p, acts, spent, saved, compName }) => (
                  <tr key={p.id} className="border-b border-[var(--n-border)] last:border-0 hover:bg-[var(--n-chiffon)]/40">
                    <td className="py-2.5 pr-3 font-semibold">@{p.username}</td>
                    <td className="py-2.5 pr-3">{compName}</td>
                    <td className="py-2.5 pr-3">{p.role ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-right">{acts.length}</td>
                    <td className="py-2.5 pr-3 text-right">{spent.toFixed(1)}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-[var(--n-emerald)]">{saved.toFixed(1)}</td>
                    <td className="py-2.5 pr-3 text-right">
                      <button className="text-[var(--n-blue)] hover:underline mr-3" onClick={() => setDrawerUser(p)}>View</button>
                      <button className="text-[var(--n-fuchsia)] hover:opacity-80" onClick={() => handleDeleteUser(p.id, p.username)}>
                        <Trash2 size={14} className="inline" />
                      </button>
                    </td>
                  </tr>
                ));
              })()}
              {filteredProfiles.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-[var(--n-text-muted)]">No participants match filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-4 mb-8">
          <div className="n-card">
            <h3 className="font-bold mb-3">Top 10 most-listed activities</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topActivities} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#FFCE00" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="n-card">
            <h3 className="font-bold mb-3">Most recommended tools</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topTools} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#623CEA" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="n-card lg:col-span-2">
            <h3 className="font-bold mb-3">AI-capable distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={aiDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {aiDistribution.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        </div>
        )}
      </div>

      {/* Drawer */}
      {drawerUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setDrawerUser(null)}>
          <div className="bg-[var(--n-bg)] w-full max-w-lg h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="n-step">Participant plan</p>
                <h2 className="text-2xl font-black">@{drawerUser.username}</h2>
                <p className="text-sm text-[var(--n-text-muted)]">{drawerUser.role} · {companies.find(c => c.id === drawerUser.company_id)?.name ?? "—"}</p>
              </div>
              <button onClick={() => setDrawerUser(null)}><X /></button>
            </div>
            <DrawerContent userId={drawerUser.id} activities={activities} commitments={commitments} />
          </div>
        </div>
      )}

      {/* Add company modal */}
      {showAddCompany && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAddCompany(false)}>
          <div className="n-card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">Add company</h3>
            <input className="n-input mb-4" placeholder="Company name" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button className="n-btn n-btn-ghost" onClick={() => setShowAddCompany(false)}>Cancel</button>
              <button className="n-btn n-btn-primary" onClick={handleAddCompany}>Add</button>
            </div>
          </div>
        </div>
      )}
    </NudgeShell>
  );
}

function DrawerContent({ userId, activities, commitments }: { userId: string; activities: Activity[]; commitments: Commitment[] }) {
  const acts = activities.filter(a => a.user_id === userId).sort((a, b) => Number(b.hours_saved) - Number(a.hours_saved));
  const coms = commitments.filter(c => c.user_id === userId).sort((a, b) => a.position - b.position);
  const totalSpent = acts.reduce((s, a) => s + Number(a.weekly_hours), 0);
  const totalSaved = acts.reduce((s, a) => s + Number(a.hours_saved), 0);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="n-stat n-stat-amber !p-4"><div className="text-3xl font-black">{totalSpent.toFixed(1)}</div><div className="text-xs font-bold uppercase tracking-wide mt-1">Hrs/week spent</div></div>
        <div className="n-stat n-stat-emerald !p-4"><div className="text-3xl font-black">{totalSaved.toFixed(1)}</div><div className="text-xs font-bold uppercase tracking-wide mt-1">Hrs/week saved</div></div>
      </div>
      <div className="space-y-3 mb-6">
        {acts.map(a => (
          <div key={a.id} className="n-card !p-4">
            <div className="flex justify-between items-start gap-2 mb-1">
              <h4 className="font-semibold">{a.name}</h4>
              {a.recommended_tool && <span className="n-chip" style={{ background: "var(--n-blue)", color: "white" }}>{a.recommended_tool}</span>}
            </div>
            <div className="text-sm text-[var(--n-text-muted)]">
              {Number(a.weekly_hours).toFixed(1)}h spent · <span className="text-[var(--n-emerald)] font-semibold">{Number(a.hours_saved).toFixed(1)}h saved</span> · {a.ai_capable}
            </div>
            {a.how_to && <p className="text-sm mt-2">{a.how_to}</p>}
            {Array.isArray(a.ai_bullets) && a.ai_bullets.length > 0 && (
              <ul className="text-sm mt-2 space-y-1 list-disc list-inside text-[var(--n-text-muted)]">
                {a.ai_bullets.map((b, i) => <li key={i}>{b.text} {b.hours_saved ? <span className="text-[var(--n-emerald)] font-semibold">(~{b.hours_saved}h/wk)</span> : null}</li>)}
              </ul>
            )}
            {a.commitment && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: "var(--n-chiffon)" }}>
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--n-text-muted)] mb-1">Commitment</div>
                <p className="text-sm">{a.commitment}</p>
              </div>
            )}
          </div>
        ))}
        {acts.length === 0 && <p className="text-[var(--n-text-muted)] text-sm">No activities yet.</p>}
      </div>
      {coms.length > 0 && (
        <div className="n-card !p-4">
          <h4 className="font-bold mb-2">Commitments</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            {coms.map(c => <li key={c.position}>{c.text}</li>)}
          </ol>
        </div>
      )}
    </>
  );
}

// ===================== CAB DIAGNOSTIC ADMIN =====================

const LEVELS = ["C1", "C2", "A1", "A2", "B1", "B2"] as const;
type CabLevel = (typeof LEVELS)[number];

type CabQuestion = {
  id: string; question_text: string; example_text: string | null; cab_level: CabLevel;
  weight: number; is_active: boolean; sort_order: number;
};
type CabLevelDef = {
  cab_level: CabLevel; level_name: string; description: string; next_move: string;
  recommended_actions: string[]; sort_order: number;
};
type CabAssessment = {
  id: string; user_id: string; company_id: string | null;
  final_level: CabLevel; final_level_name: string;
  level_scores: Record<string, number>; selected_question_ids: string[];
  created_at: string; note: string | null;
};

function CabAdmin({ companies, profiles }: { companies: Company[]; profiles: Profile[] }) {
  const overviewFn = useServerFn(adminGetCabOverview);
  const [subTab, setSubTab] = useState<"overview" | "users" | "questions" | "levels">("overview");
  const [cabSortKey, setCabSortKey] = useState<"user" | "company" | "role" | "level" | "date">("date");
  const [cabSortDir, setCabSortDir] = useState<SortDir>("desc");
  function toggleCabSort(k: typeof cabSortKey) {
    if (cabSortKey === k) setCabSortDir(d => d === "asc" ? "desc" : "asc");
    else { setCabSortKey(k); setCabSortDir(k === "date" || k === "level" ? "desc" : "asc"); }
  }
  const [assessments, setAssessments] = useState<CabAssessment[]>([]);
  const [questions, setQuestions] = useState<CabQuestion[]>([]);
  const [levels, setLevels] = useState<CabLevelDef[]>([]);
  const [fCompany, setFCompany] = useState("");
  const [busy, setBusy] = useState(true);

  async function refresh() {
    setBusy(true);
    try {
      const r = await overviewFn();
      setAssessments(r.assessments as CabAssessment[]);
      setQuestions(r.questions as CabQuestion[]);
      setLevels(r.levels as CabLevelDef[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  // latest per user
  const latestPerUser = useMemo(() => {
    const m = new Map<string, CabAssessment>();
    for (const a of assessments) {
      if (!m.has(a.user_id)) m.set(a.user_id, a); // already ordered desc
    }
    return Array.from(m.values()).filter(a => !fCompany || a.company_id === fCompany);
  }, [assessments, fCompany]);

  const distribution = useMemo(() => {
    const counts: Record<string, number> = { C1: 0, C2: 0, A1: 0, A2: 0, B1: 0, B2: 0 };
    latestPerUser.forEach(a => { counts[a.final_level]++; });
    const total = latestPerUser.length || 1;
    return LEVELS.map(l => ({
      level: l,
      name: levels.find(x => x.cab_level === l)?.level_name ?? l,
      count: counts[l],
      pct: Math.round((counts[l] / total) * 100),
    }));
  }, [latestPerUser, levels]);

  const mostCommon = useMemo(() => {
    return distribution.reduce((m, d) => (d.count > m.count ? d : m), distribution[0]);
  }, [distribution]);

  const profById = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const compById = useMemo(() => new Map(companies.map(c => [c.id, c.name])), [companies]);

  function exportCabCsv() {
    const rows = [["username", "company", "role", "final_level", "level_name", "completed_at"]];
    latestPerUser.forEach(a => {
      const p = profById.get(a.user_id);
      rows.push([
        p?.username ?? a.user_id,
        compById.get(a.company_id ?? "") ?? "",
        p?.role ?? "",
        a.final_level, a.final_level_name,
        new Date(a.created_at).toISOString(),
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cab-results-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (busy) return <div className="p-12 text-center text-[var(--n-text-muted)]">Loading CAB data…</div>;

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["overview", "users", "questions", "levels"] as const).map(t => (
          <button
            key={t}
            className="n-chip"
            style={{
              background: subTab === t ? "#623CEA" : undefined,
              color: subTab === t ? "white" : undefined,
              borderColor: subTab === t ? "#623CEA" : undefined,
            }}
            onClick={() => setSubTab(t)}
          >
            {t === "overview" ? "Overview" : t === "users" ? "User Results" : t === "questions" ? "Questions" : "Level Definitions"}
          </button>
        ))}
      </div>

      {subTab === "overview" && (
        <div>
          <div className="mb-4">
            <label className="n-label">Filter by company</label>
            <select className="n-input max-w-sm" value={fCompany} onChange={(e) => setFCompany(e.target.value)}>
              <option value="">All companies</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="n-stat n-stat-amber"><div className="n-stat-num">{latestPerUser.length}</div><div className="n-stat-label">Completed</div></div>
            <div className="n-stat n-stat-blue">
              <div className="n-stat-num">{mostCommon?.level ?? "—"}</div>
              <div className="n-stat-label">Most common · {mostCommon?.name}</div>
            </div>
            <div className="n-stat n-stat-emerald">
              <div className="n-stat-num">{assessments.length}</div>
              <div className="n-stat-label">Total attempts</div>
            </div>
          </div>
          <div className="n-card">
            <h3 className="font-bold mb-4">Level distribution</h3>
            <div className="space-y-3">
              {distribution.map(d => {
                const colors = LEVEL_COLORS[d.level];
                return (
                  <div key={d.level} className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center font-black flex-shrink-0"
                      style={{ background: colors.bg, color: colors.fg }}
                    >
                      {d.level}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-semibold" style={{ color: "#221D23" }}>{d.name}</span>
                        <span className="text-[var(--n-text-muted)]">{d.count} · {d.pct}%</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F0EDE4" }}>
                        <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: colors.bg }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {subTab === "users" && (
        <div>
          <div className="flex justify-between items-end mb-4 gap-3 flex-wrap">
            <div>
              <label className="n-label">Filter by company</label>
              <select className="n-input max-w-sm" value={fCompany} onChange={(e) => setFCompany(e.target.value)}>
                <option value="">All companies</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button className="n-btn n-btn-dark flex items-center gap-2" onClick={exportCabCsv}>
              <Download size={16} /> Export CSV
            </button>
          </div>
          <div className="n-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--n-text-muted)] border-b border-[var(--n-border)]">
                  <SortHeader label="User" active={cabSortKey==="user"} dir={cabSortDir} onClick={() => toggleCabSort("user")} />
                  <SortHeader label="Company" active={cabSortKey==="company"} dir={cabSortDir} onClick={() => toggleCabSort("company")} />
                  <SortHeader label="Role" active={cabSortKey==="role"} dir={cabSortDir} onClick={() => toggleCabSort("role")} />
                  <SortHeader label="Level" active={cabSortKey==="level"} dir={cabSortDir} onClick={() => toggleCabSort("level")} />
                  <th className="py-2 pr-3">Level name</th>
                  <SortHeader label="Completed" active={cabSortKey==="date"} dir={cabSortDir} onClick={() => toggleCabSort("date")} />
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const dir = cabSortDir === "asc" ? 1 : -1;
                  const levelOrder = ["C1", "C2", "A1", "A2", "B1", "B2"];
                  const sorted = [...latestPerUser].sort((a, b) => {
                    const pa = profById.get(a.user_id); const pb = profById.get(b.user_id);
                    switch (cabSortKey) {
                      case "user": return (pa?.username ?? "").localeCompare(pb?.username ?? "") * dir;
                      case "company": return (compById.get(a.company_id ?? "") ?? "").localeCompare(compById.get(b.company_id ?? "") ?? "") * dir;
                      case "role": return (pa?.role ?? "").localeCompare(pb?.role ?? "") * dir;
                      case "level": return (levelOrder.indexOf(a.final_level) - levelOrder.indexOf(b.final_level)) * dir;
                      case "date": return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
                      default: return 0;
                    }
                  });
                  return sorted.map(a => {
                    const p = profById.get(a.user_id);
                    const colors = LEVEL_COLORS[a.final_level];
                    return (
                      <tr key={a.id} className="border-b border-[var(--n-border)] last:border-0">
                        <td className="py-2.5 pr-3 font-semibold">@{p?.username ?? "—"}</td>
                        <td className="py-2.5 pr-3">{compById.get(a.company_id ?? "") ?? "—"}</td>
                        <td className="py-2.5 pr-3">{p?.role ?? "—"}</td>
                        <td className="py-2.5 pr-3">
                          <span className="inline-block px-2 py-0.5 rounded font-black text-xs" style={{ background: colors.bg, color: colors.fg }}>
                            {a.final_level}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">{a.final_level_name}</td>
                        <td className="py-2.5 pr-3 text-[var(--n-text-muted)]">{new Date(a.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  });
                })()}
                {latestPerUser.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-[var(--n-text-muted)]">No results yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "questions" && <QuestionsAdmin questions={questions} onChange={refresh} />}
      {subTab === "levels" && <LevelsAdmin levels={levels} onChange={refresh} />}
    </div>
  );
}

function QuestionsAdmin({ questions, onChange }: { questions: CabQuestion[]; onChange: () => void }) {
  const upsertFn = useServerFn(adminUpsertCabQuestion);
  const deleteFn = useServerFn(adminDeleteCabQuestion);
  const [editing, setEditing] = useState<Partial<CabQuestion> | null>(null);

  async function save() {
    if (!editing) return;
    try {
      await upsertFn({
        data: {
          id: editing.id,
          question_text: editing.question_text ?? "",
          example_text: editing.example_text ?? null,
          cab_level: (editing.cab_level ?? "C1") as CabLevel,
          weight: Number(editing.weight ?? 1),
          is_active: editing.is_active ?? true,
          sort_order: Number(editing.sort_order ?? 0),
        },
      });
      toast.success("Saved");
      setEditing(null);
      onChange();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this question?")) return;
    try { await deleteFn({ data: { id } }); toast.success("Deleted"); onChange(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button className="n-btn n-btn-primary flex items-center gap-2" onClick={() => setEditing({
          question_text: "", cab_level: "C1", weight: 1, is_active: true, sort_order: questions.length + 1, example_text: "",
        })}>
          <Plus size={16} /> Add question
        </button>
      </div>
      <div className="n-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--n-text-muted)] border-b border-[var(--n-border)]">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Level</th>
              <th className="py-2 pr-3">Statement</th>
              <th className="py-2 pr-3">Weight</th>
              <th className="py-2 pr-3">Active</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {questions.map(q => {
              const c = LEVEL_COLORS[q.cab_level];
              return (
                <tr key={q.id} className="border-b border-[var(--n-border)] last:border-0">
                  <td className="py-2.5 pr-3 text-[var(--n-text-muted)]">{q.sort_order}</td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-block px-2 py-0.5 rounded font-black text-xs" style={{ background: c.bg, color: c.fg }}>{q.cab_level}</span>
                  </td>
                  <td className="py-2.5 pr-3" style={{ maxWidth: 500 }}>{q.question_text}</td>
                  <td className="py-2.5 pr-3">{q.weight}</td>
                  <td className="py-2.5 pr-3">{q.is_active ? "✓" : "—"}</td>
                  <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                    <button className="text-[var(--n-blue)] hover:underline mr-3" onClick={() => setEditing(q)}><Pencil size={14} className="inline" /></button>
                    <button className="text-[var(--n-fuchsia)] hover:opacity-80" onClick={() => remove(q.id)}><Trash2 size={14} className="inline" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="n-card max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black">{editing.id ? "Edit question" : "New question"}</h3>
              <button onClick={() => setEditing(null)}><X /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="n-label">Statement</label>
                <textarea className="n-input" rows={3} value={editing.question_text ?? ""} onChange={(e) => setEditing({ ...editing, question_text: e.target.value })} />
              </div>
              <div>
                <label className="n-label">Example (optional)</label>
                <textarea className="n-input" rows={2} value={editing.example_text ?? ""} onChange={(e) => setEditing({ ...editing, example_text: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="n-label">CAB level</label>
                  <select className="n-input" value={editing.cab_level ?? "C1"} onChange={(e) => setEditing({ ...editing, cab_level: e.target.value as CabLevel })}>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="n-label">Weight</label>
                  <input className="n-input" type="number" step="0.1" min="0" value={editing.weight ?? 1} onChange={(e) => setEditing({ ...editing, weight: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="n-label">Sort order</label>
                  <input className="n-input" type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                <span className="font-semibold" style={{ color: "#221D23" }}>Active</span>
              </label>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button className="n-btn n-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="n-btn n-btn-primary flex items-center gap-2" onClick={save}><Save size={16} /> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LevelsAdmin({ levels, onChange }: { levels: CabLevelDef[]; onChange: () => void }) {
  const upsertFn = useServerFn(adminUpsertCabLevelDefinition);
  const [editing, setEditing] = useState<CabLevelDef | null>(null);
  const [actionsText, setActionsText] = useState("");

  function openEdit(l: CabLevelDef) {
    setEditing(l);
    setActionsText(l.recommended_actions.join("\n"));
  }

  async function save() {
    if (!editing) return;
    try {
      await upsertFn({
        data: {
          cab_level: editing.cab_level,
          level_name: editing.level_name,
          description: editing.description,
          next_move: editing.next_move,
          recommended_actions: actionsText.split("\n").map(s => s.trim()).filter(Boolean),
        },
      });
      toast.success("Saved");
      setEditing(null);
      onChange();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {levels.map(l => {
        const c = LEVEL_COLORS[l.cab_level];
        return (
          <div key={l.cab_level} className="n-card">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center font-black" style={{ background: c.bg, color: c.fg }}>
                  {l.cab_level}
                </div>
                <h3 className="text-lg font-black" style={{ color: "#221D23" }}>{l.level_name}</h3>
              </div>
              <button className="text-[var(--n-blue)] hover:underline text-sm" onClick={() => openEdit(l)}><Pencil size={14} className="inline" /></button>
            </div>
            <p className="text-sm mb-2" style={{ color: "#221D23" }}>{l.description}</p>
            <p className="text-sm text-[var(--n-text-muted)] mb-2"><strong>Next:</strong> {l.next_move}</p>
            <ul className="text-sm list-disc list-inside space-y-1 text-[var(--n-text-muted)]">
              {l.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        );
      })}

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="n-card max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black">Edit level {editing.cab_level}</h3>
              <button onClick={() => setEditing(null)}><X /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="n-label">Level name</label>
                <input className="n-input" value={editing.level_name} onChange={(e) => setEditing({ ...editing, level_name: e.target.value })} />
              </div>
              <div>
                <label className="n-label">Description</label>
                <textarea className="n-input" rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <label className="n-label">Next move</label>
                <textarea className="n-input" rows={2} value={editing.next_move} onChange={(e) => setEditing({ ...editing, next_move: e.target.value })} />
              </div>
              <div>
                <label className="n-label">Recommended actions (one per line)</label>
                <textarea className="n-input" rows={5} value={actionsText} onChange={(e) => setActionsText(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button className="n-btn n-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="n-btn n-btn-primary flex items-center gap-2" onClick={save}><Save size={16} /> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =================== AI FIT TEST ADMIN ===================

type FitQuestion = {
  id: string; scenario: string;
  choice_use_label: string; choice_partial_label: string; choice_avoid_label: string;
  correct_answer: "use" | "partial" | "avoid";
  rationale: string; sort_order: number; is_active: boolean;
};
type FitAttempt = { id: string; user_id: string; company_id: string | null; score: number; total: number; created_at: string };

function FitAdmin({ profiles, companies }: { profiles: Profile[]; companies: Company[] }) {
  const overviewFn = useServerFn(adminGetAiFitOverview);
  const upsertFn = useServerFn(adminUpsertAiFitQuestion);
  const deleteFn = useServerFn(adminDeleteAiFitQuestion);

  const [questions, setQuestions] = useState<FitQuestion[]>([]);
  const [attempts, setAttempts] = useState<FitAttempt[]>([]);
  const [editing, setEditing] = useState<FitQuestion | null>(null);
  const [subtab, setSubtab] = useState<"overview" | "users" | "questions">("overview");
  const [fitSortKey, setFitSortKey] = useState<"user" | "company" | "role" | "score" | "date">("score");
  const [fitSortDir, setFitSortDir] = useState<SortDir>("desc");
  function toggleFitSort(k: typeof fitSortKey) {
    if (fitSortKey === k) setFitSortDir(d => d === "asc" ? "desc" : "asc");
    else { setFitSortKey(k); setFitSortDir(k === "score" || k === "date" ? "desc" : "asc"); }
  }
  const [fCompany, setFCompany] = useState("");

  const load = () => {
    overviewFn().then(r => {
      setQuestions(r.questions as FitQuestion[]);
      setAttempts(r.attempts as FitAttempt[]);
    }).catch(e => toast.error((e as Error).message));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const profById = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const compById = useMemo(() => new Map(companies.map(c => [c.id, c.name])), [companies]);

  // latest attempt per user (attempts are already created_at desc from server)
  const latestPerUser = useMemo(() => {
    const m = new Map<string, FitAttempt>();
    for (const a of attempts) if (!m.has(a.user_id)) m.set(a.user_id, a);
    return Array.from(m.values()).filter(a => {
      if (!fCompany) return true;
      const p = profById.get(a.user_id);
      return p?.company_id === fCompany;
    });
  }, [attempts, fCompany, profById]);

  const avg = latestPerUser.length ? latestPerUser.reduce((s, a) => s + a.score, 0) / latestPerUser.length : 0;
  const total = attempts[0]?.total ?? 15;

  function exportFitCsv() {
    const rows = [["username", "company", "role", "score", "total", "completed_at"]];
    latestPerUser.forEach(a => {
      const p = profById.get(a.user_id);
      rows.push([
        p?.username ?? a.user_id,
        compById.get(p?.company_id ?? "") ?? "",
        p?.role ?? "",
        String(a.score), String(a.total),
        new Date(a.created_at).toISOString(),
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `ai-fit-results-${Date.now()}.csv`; link.click();
    URL.revokeObjectURL(url);
  }

  function newQ(): FitQuestion {
    return {
      id: "", scenario: "",
      choice_use_label: "Use AI", choice_partial_label: "Use AI partially", choice_avoid_label: "Avoid AI",
      correct_answer: "use", rationale: "", sort_order: (questions.at(-1)?.sort_order ?? 0) + 10, is_active: true,
    };
  }

  async function save() {
    if (!editing) return;
    try {
      await upsertFn({ data: { ...editing, id: editing.id || undefined } });
      toast.success("Saved");
      setEditing(null);
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this scenario?")) return;
    try { await deleteFn({ data: { id } }); load(); } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap">
        <button className={`n-chip ${subtab === "overview" ? "n-chip-active" : ""}`} onClick={() => setSubtab("overview")}>Overview</button>
        <button className={`n-chip ${subtab === "users" ? "n-chip-active" : ""}`} onClick={() => setSubtab("users")}>User Results</button>
        <button className={`n-chip ${subtab === "questions" ? "n-chip-active" : ""}`} onClick={() => setSubtab("questions")}>Questions</button>
      </div>

      {subtab === "overview" ? (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="n-stat n-stat-blue"><div className="n-stat-num">{latestPerUser.length}</div><div className="n-stat-label">Participants</div></div>
            <div className="n-stat n-stat-emerald"><div className="n-stat-num">{avg.toFixed(1)} / {total}</div><div className="n-stat-label">Avg score</div></div>
            <div className="n-stat n-stat-amber"><div className="n-stat-num">{questions.filter(q => q.is_active).length}</div><div className="n-stat-label">Active scenarios</div></div>
          </div>
          {attempts.length === 0 && (
            <p className="text-sm text-[var(--n-text-muted)]">No attempts yet.</p>
          )}
        </div>
      ) : subtab === "users" ? (
        <div>
          <div className="flex justify-between items-end mb-4 gap-3 flex-wrap">
            <div>
              <label className="n-label">Filter by company</label>
              <select className="n-input max-w-sm" value={fCompany} onChange={(e) => setFCompany(e.target.value)}>
                <option value="">All companies</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button className="n-btn n-btn-dark flex items-center gap-2" onClick={exportFitCsv}>
              <Download size={16} /> Export CSV
            </button>
          </div>
          <div className="n-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--n-text-muted)] border-b border-[var(--n-border)]">
                  <SortHeader label="User" active={fitSortKey==="user"} dir={fitSortDir} onClick={() => toggleFitSort("user")} />
                  <SortHeader label="Company" active={fitSortKey==="company"} dir={fitSortDir} onClick={() => toggleFitSort("company")} />
                  <SortHeader label="Role" active={fitSortKey==="role"} dir={fitSortDir} onClick={() => toggleFitSort("role")} />
                  <SortHeader label="Score" active={fitSortKey==="score"} dir={fitSortDir} onClick={() => toggleFitSort("score")} align="right" />
                  <SortHeader label="Completed" active={fitSortKey==="date"} dir={fitSortDir} onClick={() => toggleFitSort("date")} />
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const dir = fitSortDir === "asc" ? 1 : -1;
                  const sorted = [...latestPerUser].sort((a, b) => {
                    const pa = profById.get(a.user_id); const pb = profById.get(b.user_id);
                    switch (fitSortKey) {
                      case "user": return (pa?.username ?? "").localeCompare(pb?.username ?? "") * dir;
                      case "company": return (compById.get(pa?.company_id ?? "") ?? "").localeCompare(compById.get(pb?.company_id ?? "") ?? "") * dir;
                      case "role": return (pa?.role ?? "").localeCompare(pb?.role ?? "") * dir;
                      case "score": return (a.score - b.score) * dir;
                      case "date": return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
                      default: return 0;
                    }
                  });
                  return sorted.map(a => {
                    const p = profById.get(a.user_id);
                    const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
                    const color = pct >= 80 ? "var(--n-emerald)" : pct >= 50 ? "#221D23" : "var(--n-fuchsia)";
                    return (
                      <tr key={a.id} className="border-b border-[var(--n-border)] last:border-0">
                        <td className="py-2.5 pr-3 font-semibold">@{p?.username ?? "—"}</td>
                        <td className="py-2.5 pr-3">{compById.get(p?.company_id ?? "") ?? "—"}</td>
                        <td className="py-2.5 pr-3">{p?.role ?? "—"}</td>
                        <td className="py-2.5 pr-3 text-right font-bold" style={{ color }}>{a.score} / {a.total}</td>
                        <td className="py-2.5 pr-3 text-[var(--n-text-muted)]">{new Date(a.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  });
                })()}
                {latestPerUser.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-[var(--n-text-muted)]">No attempts yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">Scenario bank ({questions.length})</h3>
            <button className="n-btn n-btn-primary flex items-center gap-2" onClick={() => setEditing(newQ())}>
              <Plus size={16} /> New scenario
            </button>
          </div>
          <div className="n-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--n-text-muted)] border-b border-[var(--n-border)]">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Scenario</th>
                  <th className="py-2 pr-3">Answer</th>
                  <th className="py-2 pr-3">Active</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {questions.map(q => (
                  <tr key={q.id} className="border-b border-[var(--n-border)] last:border-0">
                    <td className="py-2 pr-3">{q.sort_order}</td>
                    <td className="py-2 pr-3">{q.scenario}</td>
                    <td className="py-2 pr-3 font-semibold uppercase text-xs">{q.correct_answer}</td>
                    <td className="py-2 pr-3">{q.is_active ? "✓" : "—"}</td>
                    <td className="py-2 text-right">
                      <button className="text-[var(--n-blue)] hover:underline mr-3" onClick={() => setEditing(q)}><Pencil size={14} className="inline" /></button>
                      <button className="text-[var(--n-fuchsia)] hover:opacity-80" onClick={() => remove(q.id)}><Trash2 size={14} className="inline" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setEditing(null)}>
          <div className="bg-[var(--n-bg)] w-full max-w-lg h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-black text-xl">{editing.id ? "Edit scenario" : "New scenario"}</h3>
              <button onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="n-label">Scenario</label>
                <textarea className="n-input" rows={2} value={editing.scenario} onChange={(e) => setEditing({ ...editing, scenario: e.target.value })} />
              </div>
              <div>
                <label className="n-label">Correct answer</label>
                <select className="n-input" value={editing.correct_answer} onChange={(e) => setEditing({ ...editing, correct_answer: e.target.value as FitQuestion["correct_answer"] })}>
                  <option value="use">Use AI</option>
                  <option value="partial">Use Partially</option>
                  <option value="avoid">Avoid</option>
                </select>
              </div>
              <div>
                <label className="n-label">Rationale</label>
                <textarea className="n-input" rows={3} value={editing.rationale} onChange={(e) => setEditing({ ...editing, rationale: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="n-label">Sort order</label>
                  <input type="number" className="n-input" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 font-semibold">
                    <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                    Active
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button className="n-btn n-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="n-btn n-btn-primary flex items-center gap-2" onClick={save}><Save size={16} /> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
