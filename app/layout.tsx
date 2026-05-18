import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";

export const metadata: Metadata = {
  title: "AI for Work Playbook — Nudgeable.ai",
  description:
    "Know your AI level, learn where AI fits, and find real work activities where AI can save time.",
  openGraph: {
    siteName: "AI for Work Playbook",
    title: "AI for Work Playbook — Nudgeable.ai",
    description:
      "A practical system to understand your AI level, learn where AI fits, and find real work activities where AI can save time.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI for Work Playbook — Nudgeable.ai",
    description:
      "A practical system to understand your AI level, learn where AI fits, and find real work activities where AI can save time.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
        />
      </head>
      <body>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
