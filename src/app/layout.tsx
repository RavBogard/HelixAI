import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthButton } from "@/components/auth/AuthButton";
import { ChatSidebar } from "@/components/sidebar/ChatSidebar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Toaster } from "sonner";

// Display + body font — geometric, technical, studio-console feel
const spaceGrotesk = Space_Grotesk({
  variable: "--font-primary",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// Mono — for technical labels, suggestion chips, code blocks
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HelixTones — Helix Preset Builder",
  description: "Describe your tone and get a mix-ready preset for Line 6 Helix, Pod Go, Helix Stadium, or HX Stomp. AI-powered, instant, free.",
  metadataBase: new URL('https://helixtones.com'),
  openGraph: {
    title: "HelixTones — Helix Preset Builder",
    description: "Describe your tone and get a mix-ready preset for Line 6 Helix, Pod Go, Helix Stadium, or HX Stomp.",
    type: "website",
    siteName: "HelixTones",
  },
  twitter: {
    card: "summary_large_image",
    title: "HelixTones — Helix Preset Builder",
    description: "Describe your tone and get a mix-ready preset for Line 6 Helix, Pod Go, Helix Stadium, or HX Stomp.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Auth check — determines whether to render the sidebar
  // createSupabaseServerClient reads cookies set by middleware (Phase 24)
  let isAuthenticated = false
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    isAuthenticated = Boolean(user && !user.is_anonymous)
  } catch {
    // If auth check fails, treat as anonymous — sidebar is hidden
    isAuthenticated = false
  }

  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {/* Film grain overlay */}
        <div className="hlx-grain" aria-hidden="true" />
        {/* Ambient studio glow */}
        <div className="hlx-ambient" aria-hidden="true" />

        {/* Auth button — fixed top-right, floats above all content */}
        <header className="fixed top-0 right-0 z-50 p-3">
          <AuthButton />
        </header>

        {/* Root layout: sidebar (auth only) + main content */}
        <div className="flex min-h-screen">
          {isAuthenticated && <ChatSidebar />}
          <main className="flex-1 min-w-0 overflow-hidden">
            {children}
          </main>
        </div>

        {/* Global Toaster */}
        <Toaster 
          position="bottom-center"
          toastOptions={{
            style: {
              background: "var(--hlx-elevated)",
              border: "1px solid var(--hlx-border-warm)",
              color: "var(--hlx-text)",
              fontFamily: "var(--font-primary)",
              boxShadow: "0 10px 40px -10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)"
            },
            className: "text-[0.85rem]",
          }}
        />
      </body>
    </html>
  );
}
