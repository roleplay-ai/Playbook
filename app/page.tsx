"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ensureAdmin, enterAudit, listCompaniesPublic } from "@/lib/auth.actions";
import { usernameToEmail } from "@/lib/utils";
import { NudgeShell } from "@/components/NudgeShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Sparkles } from "lucide-react";

type LoadState = "loading" | "ready" | "error";

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
      const { error } = await (supabase.from("profiles") as any)
        .upsert({ id: user!.id, company_id: pickedCompanyId }, { onConflict: "id" });
      if (error) throw error;
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
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(adminUser),
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
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-10 items-start mb-16">
          <section>
            <p className="n-step mb-3">Frameworks to apply AI at work</p>
            <h1 className="text-4xl md:text-6xl font-black leading-[1.05] mb-4" style={{ color: "#221D23" }}>
              AI for Work <span style={{ color: "#F68A29" }}>Playbook</span>
            </h1>
            <p className="text-xl md:text-2xl font-semibold mb-4 leading-snug" style={{ color: "#221D23" }}>
              Learn where you are, where AI fits, and where AI can create real value in your work.
            </p>
            <p className="text-[var(--n-text-muted)] text-lg mb-8 max-w-xl">
              A practical journey to help professionals move from random AI use to confident AI application at work.
            </p>
          </section>

          {/* Company picker — shown to SSO users who are logged in but have no company yet */}
          {pickingCompany ? (
            <div id="entry">
              <div className="n-card">
                <p className="n-step mb-3 flex items-center gap-1">
                  <Building2 size={12} /> One more step
                </p>
                <h2 className="text-lg font-bold mb-1" style={{ color: "#221D23" }}>Choose your company</h2>
                <p className="text-sm text-[var(--n-text-muted)] mb-4">
                  Select the company you&apos;re attending this workshop with so we can group your results correctly.
                </p>
                <form className="space-y-4" onSubmit={handleSaveCompany}>
                  <div>
                    <label className="n-label">Company</label>
                    <Select value={pickedCompanyId} onValueChange={setPickedCompanyId}>
                      <SelectTrigger className="n-input h-auto">
                        <SelectValue placeholder={loadState === "loading" ? "Loading companies…" : "— Pick your company —"} />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-slate-900 z-50">
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="cursor-pointer">{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <button
                    type="submit"
                    disabled={savingCompany || !pickedCompanyId}
                    className="n-btn n-btn-primary n-btn-press w-full"
                  >
                    {savingCompany ? "Saving…" : "Continue to Playbook →"}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div ref={entryRef} id="entry">
              <div className="n-card">
                <p className="n-step mb-3 flex items-center gap-1">
                  <Sparkles size={12} /> Workshop entry
                </p>
                {!adminMode ? (
                  <form className="space-y-4" onSubmit={handleEnter}>
                    <div>
                      <label className="n-label">Company email</label>
                      <input
                        className="n-input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        required
                        autoComplete="email"
                      />
                    </div>
                    <div>
                      <label className="n-label">Company</label>
                      <Select value={companyId} onValueChange={setCompanyId}>
                        <SelectTrigger className="n-input h-auto">
                          <SelectValue placeholder={loadState === "loading" ? "Loading companies…" : "— Pick your company —"} />
                        </SelectTrigger>
                        <SelectContent className="bg-white text-slate-900 z-50">
                          {companies.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="cursor-pointer">{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-[var(--n-text-muted)] mt-2">
                        {loadState === "loading" && "Loading companies…"}
                        {loadState === "ready" && companies.length > 0 && `${companies.length} companies available`}
                        {loadState === "ready" && companies.length === 0 && "No companies yet? Ask your facilitator to add one."}
                        {loadState === "error" && (
                          <button type="button" className="underline" onClick={loadCompanies}>
                            Could not load — tap to retry
                          </button>
                        )}
                      </p>
                    </div>
                    <button type="submit" disabled={busy} className="n-btn n-btn-primary n-btn-press w-full">
                      {busy ? "Signing you in…" : "Enter the Playbook"}
                    </button>
                  </form>
                ) : (
                  <form className="space-y-4" onSubmit={handleAdmin}>
                    <div>
                      <label className="n-label">Admin username</label>
                      <input className="n-input" value={adminUser} onChange={(e) => setAdminUser(e.target.value)} required autoComplete="username" />
                    </div>
                    <div>
                      <label className="n-label">Password</label>
                      <input className="n-input" type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} required autoComplete="current-password" />
                    </div>
                    <button type="submit" disabled={busy} className="n-btn n-btn-primary n-btn-press w-full">
                      {busy ? "Please wait…" : "Log in as admin"}
                    </button>
                  </form>
                )}
                <p className="text-xs text-[var(--n-text-muted)] text-center mt-4">
                  <button
                    type="button"
                    className="underline hover:text-[var(--n-text)]"
                    onClick={() => setAdminMode((m) => !m)}
                  >
                    {adminMode ? "← Back to participant entry" : "Facilitator? Admin login"}
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </NudgeShell>
  );
}
