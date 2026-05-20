"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ensureAdmin, enterAudit, listCompaniesPublic, saveUserCompany, signInFacilitator } from "@/lib/auth.actions";
import { NudgeShell } from "@/components/NudgeShell";
import { toast } from "sonner";
import { Building2, Sparkles, BrainCircuit, Zap, Target, Search, Check, ChevronDown, Loader2 } from "lucide-react";

type LoadState = "loading" | "ready" | "error";

/* ── Inline company picker ────────────────────────────────────
   Dark-card-aware, searchable, amber-highlighted selection.    */
function CompanyPicker({
  companies,
  value,
  onChange,
  loadState,
  onRetry,
}: {
  companies: Array<{ id: string; name: string }>;
  value: string;
  onChange: (id: string) => void;
  loadState: LoadState;
  onRetry?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = companies.find((c) => c.id === value);
  const filtered = q.trim()
    ? companies.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
    : companies;

  // close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="n-input w-full flex items-center justify-between gap-2 text-left"
        style={{ minHeight: 48 }}
      >
        {loadState === "loading" ? (
          <span className="flex items-center gap-2 opacity-60">
            <Loader2 size={14} className="animate-spin" /> Loading companies…
          </span>
        ) : selected ? (
          <span className="flex items-center gap-2 font-semibold" style={{ color: "#fff" }}>
            <Building2 size={14} style={{ color: "#FFCE00" }} />
            {selected.name}
          </span>
        ) : (
          <span style={{ color: "rgba(255,255,255,0.45)" }}>Select your company</span>
        )}
        <ChevronDown
          size={15}
          style={{
            color: "rgba(255,255,255,0.45)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.18s ease",
          }}
        />
      </button>

      {/* dropdown panel */}
      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-2xl overflow-hidden"
          style={{
            background: "#1a1614",
            border: "1.5px solid rgba(255,206,0,0.28)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
          }}
        >
          {/* search */}
          <div
            className="flex items-center gap-2 px-3 py-2.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Search size={13} style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "#fff" }}
            />
          </div>

          {/* list */}
          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
            {loadState === "error" && (
              <button
                type="button"
                className="w-full px-4 py-3 text-sm text-left"
                style={{ color: "#ED4551" }}
                onClick={onRetry}
              >
                Could not load — tap to retry
              </button>
            )}
            {filtered.length === 0 && loadState === "ready" && (
              <p className="px-4 py-3 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                No match
              </p>
            )}
            {filtered.map((c) => {
              const isActive = c.id === value;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c.id); setOpen(false); setQ(""); }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm text-left transition-colors"
                  style={{
                    color: isActive ? "#FFCE00" : "rgba(255,255,255,0.85)",
                    background: isActive ? "rgba(255,206,0,0.10)" : "transparent",
                    fontWeight: isActive ? 700 : 500,
                    borderLeft: isActive ? "3px solid #FFCE00" : "3px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Building2 size={13} style={{ color: isActive ? "#FFCE00" : "rgba(255,255,255,0.35)", flexShrink: 0 }} />
                    {c.name}
                  </span>
                  {isActive && <Check size={13} style={{ color: "#FFCE00", flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function IndexPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [adminMode, setAdminMode] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const entryRef = useRef<HTMLDivElement>(null);

  const [pickingCompany, setPickingCompany] = useState(false);
  const [pickedCompanyId, setPickedCompanyId] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  useEffect(() => { ensureAdmin().catch(() => {}); }, []);

  const loadCompanies = () => {
    setLoadState("loading");
    listCompaniesPublic()
      .then((r) => { setCompanies(r.companies ?? []); setLoadState("ready"); })
      .catch(() => setLoadState("error"));
  };

  useEffect(() => { loadCompanies(); }, []);

  // SSO: nudgeable passes session tokens in the URL hash so users don't re-authenticate
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).catch(console.error);
  }, []);

  // Redirect logged-in users; users without a company stay to pick one first
  useEffect(() => {
    if (loading || !user) return;
    if (profile?.is_admin) {
      router.push("/admin");
      return;
    }
    if (!profile || !profile.company_id) {
      setPickingCompany(true);
      return;
    }
    router.push("/hub");
  }, [loading, user, profile, router]);

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!pickedCompanyId) return;
    setSavingCompany(true);
    try {
      const res = await saveUserCompany(user!.id, pickedCompanyId, user!.email ?? user!.id);
      if (!res.ok) throw new Error(res.error ?? "Could not save company");
      router.push("/hub");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingCompany(false);
    }
  }

  function scrollToEntry() {
    entryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      const input = entryRef.current?.querySelector("input");
      (input as HTMLInputElement | undefined)?.focus();
    }, 400);
  }
  void scrollToEntry;

  async function handleEnter(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (!companyId) throw new Error("Please pick your company");
      const res = await enterAudit({ email, company_id: companyId });
      if (!res.ok || !res.email || !res.password) throw new Error(res.error || "Could not sign you in");
      const { error } = await supabase.auth.signInWithPassword({ email: res.email, password: res.password });
      if (error) throw error;
      toast.success("Welcome");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAdmin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const lookup = await signInFacilitator(adminUser);
      if (!lookup.ok || !lookup.email) throw new Error(lookup.error || "Not a facilitator account");
      const { error } = await supabase.auth.signInWithPassword({
        email: lookup.email,
        password: adminPass,
      });
      if (error) throw error;
      toast.success("Welcome back");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <NudgeShell>
      {/* Full-viewport centred split layout */}
      <div className="min-h-[calc(100vh-60px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-5xl grid lg:grid-cols-[1fr_420px] gap-8 lg:gap-16 items-center">

          {/* ── Left: brand panel ── */}
          <div className="flex flex-col gap-6">
            {/* wordmark cluster */}
            <div>
              <p className="n-step mb-2">AI for Work</p>
              <h1
                className="text-5xl md:text-7xl font-black leading-none tracking-tight"
                style={{ color: "#221D23" }}
              >
                Play<span style={{ color: "#FFCE00" }}>book</span>
              </h1>
            </div>

            {/* one-line tagline */}
            <p className="text-lg font-semibold leading-snug max-w-sm" style={{ color: "#4A4047" }}>
              Know where AI fits. Map your opportunities. Take action.
            </p>

            {/* 3 icon chips — no paragraphs */}
            <div className="flex flex-wrap gap-3">
              {[
                { icon: <BrainCircuit size={14} />, label: "CAB Ladder" },
                { icon: <Target size={14} />,       label: "AI Fit Test" },
                { icon: <Zap size={14} />,           label: "Opportunity Map" },
              ].map(({ icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold"
                  style={{
                    background: "rgba(255,206,0,0.18)",
                    color: "#221D23",
                    border: "1.5px solid rgba(255,206,0,0.45)",
                  }}
                >
                  {icon} {label}
                </span>
              ))}
            </div>

            {/* decorative accent bar */}
            <div
              className="hidden lg:block w-16 h-1 rounded-full"
              style={{ background: "linear-gradient(90deg,#FFCE00,#F68A29)" }}
            />
          </div>

          {/* ── Right: form panel ── */}
          <div ref={entryRef} id="entry">
            {pickingCompany ? (
              /* Company picker for SSO users with no company yet */
              <div className="n-auth-shell">
                <div className="flex items-center gap-2 mb-5">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(255,206,0,0.18)" }}
                  >
                    <Building2 size={15} style={{ color: "#FFCE00" }} />
                  </span>
                  <span className="n-auth-title text-base font-extrabold">One more step</span>
                </div>

                <form className="space-y-4" onSubmit={handleSaveCompany}>
                  <CompanyPicker
                    companies={companies}
                    value={pickedCompanyId}
                    onChange={setPickedCompanyId}
                    loadState={loadState}
                    onRetry={loadCompanies}
                  />

                  <button
                    type="submit"
                    disabled={savingCompany || !pickedCompanyId}
                    className="n-btn n-btn-primary n-btn-press w-full"
                  >
                    {savingCompany ? "Saving…" : "Continue →"}
                  </button>
                </form>
              </div>
            ) : (
              /* Main entry form */
              <div className="n-auth-shell">
                {/* header */}
                <div className="flex items-center gap-2 mb-6">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(255,206,0,0.18)" }}
                  >
                    <Sparkles size={15} style={{ color: "#FFCE00" }} />
                  </span>
                  <span className="n-auth-title text-base font-extrabold">
                    {adminMode ? "Facilitator login" : "Workshop entry"}
                  </span>
                </div>

                {!adminMode ? (
                  <form className="space-y-3" onSubmit={handleEnter}>
                    <input
                      className="n-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Work email"
                      required
                      autoComplete="email"
                    />

                    <CompanyPicker
                      companies={companies}
                      value={companyId}
                      onChange={setCompanyId}
                      loadState={loadState}
                      onRetry={loadCompanies}
                    />

                    <button
                      type="submit"
                      disabled={busy}
                      className="n-btn n-btn-primary n-btn-press w-full mt-1"
                    >
                      {busy ? "Signing you in…" : "Enter the Playbook →"}
                    </button>
                  </form>
                ) : (
                  <form className="space-y-3" onSubmit={handleAdmin}>
                    <input
                      className="n-input"
                      placeholder="Username"
                      value={adminUser}
                      onChange={(e) => setAdminUser(e.target.value)}
                      required
                      autoComplete="username"
                    />
                    <input
                      className="n-input"
                      type="password"
                      placeholder="Password"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="n-btn n-btn-primary n-btn-press w-full mt-1"
                    >
                      {busy ? "Please wait…" : "Sign in →"}
                    </button>
                  </form>
                )}

                <div className="mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                  <button
                    type="button"
                    className="w-full text-xs n-auth-muted text-center hover:opacity-100 transition-opacity"
                    onClick={() => setAdminMode((m) => !m)}
                  >
                    {adminMode ? "← Participant entry" : "Facilitator / Admin →"}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </NudgeShell>
  );
}
