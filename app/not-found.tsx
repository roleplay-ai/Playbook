import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center n-card">
        <h1 className="text-6xl font-black text-[var(--n-shadow)]">404</h1>
        <p className="mt-2 text-sm text-[var(--n-text-muted)]">This page doesn&apos;t exist.</p>
        <div className="mt-6">
          <Link href="/" className="n-btn n-btn-primary">Go home</Link>
        </div>
      </div>
    </div>
  );
}
