import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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
  title: "HelixAI — Helix Preset Builder",
  description: "AI-powered tone consultant and preset generator for Line 6 Helix",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {/* Film grain overlay */}
        <div className="hlx-grain" aria-hidden="true" />
        {/* Ambient studio glow */}
        <div className="hlx-ambient" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
