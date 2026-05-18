import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export function NudgeShell({ children }: { children: React.ReactNode }) {
  const { user, profile, signOut } = useAuth();
  const isAdmin = !!profile?.is_admin;

  return (
    <div className="min-h-screen flex flex-col n-mesh">
      <header
        className="px-4 md:px-12 py-4 flex items-center justify-between gap-3 bg-white flex-wrap"
        style={{ boxShadow: "0 1px 0 #E8E6DC" }}
      >
        <Link to={user ? "/hub" : "/"} className="flex flex-col leading-tight">
          <span className="n-wordmark">NUDGEABLE.AI</span>
          <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: "#623CEA" }}>
            AI for Work Playbook
          </span>
        </Link>

        {user && (
          <nav className="hidden md:flex items-center gap-4 text-sm font-semibold" style={{ color: "#221D23" }}>
            <Link to="/hub" className="hover:underline" activeProps={{ style: { color: "#623CEA" } }} activeOptions={{ exact: true }}>
              Home
            </Link>
            <Link to="/cab-diagnostic" className="hover:underline" activeProps={{ style: { color: "#623CEA" } }}>
              CAB Ladder
            </Link>
            <Link to="/ai-fit-test" className="hover:underline" activeProps={{ style: { color: "#3699FC" } }}>
              AI Fit Test
            </Link>
            <Link to="/activities" className="hover:underline" activeProps={{ style: { color: "#F68A29" } }}>
              AI Application Opportunities
            </Link>
            {isAdmin && (
              <Link to="/admin" className="hover:underline" activeProps={{ style: { color: "#ED4551" } }}>
                Admin
              </Link>
            )}
          </nav>
        )}

        <div className="flex items-center gap-3 text-sm">
          {profile && (
            <span className="hidden sm:inline" style={{ color: "#221D23", fontWeight: 500 }}>
              @{profile.username}{isAdmin ? " · admin" : ""}
            </span>
          )}
          {user && (
            <button
              className="text-sm bg-transparent border-0 cursor-pointer hover:underline"
              style={{ color: "#221D23", fontWeight: 600 }}
              onClick={() => signOut()}
            >
              Sign out
            </button>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="px-6 md:px-12 py-6 text-center text-xs text-[var(--n-text-muted)] border-t border-[var(--n-border)]">
        Built by <span className="font-semibold">Nudgeable.ai</span>
      </footer>
    </div>
  );
}

export function BrandLoader({ messages }: { messages: string[] }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-[var(--n-chiffon)] border-t-[var(--n-amber)] animate-spin" />
      </div>
      <div className="text-center space-y-1">
        {messages.map((m, i) => (
          <p key={i} className="text-[var(--n-text-muted)]" style={{ animation: `fadeMsg 4s ${i * 1.3}s infinite` }}>
            {m}
          </p>
        ))}
      </div>
      <style>{`@keyframes fadeMsg { 0%, 20% { opacity: 0 } 30%, 70% { opacity: 1 } 80%, 100% { opacity: 0.3 } }`}</style>
    </div>
  );
}
