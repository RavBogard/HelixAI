import type { Metadata } from "next";
import { Barlow_Condensed, Barlow, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Display / headline font — condensed industrial, great for big headers
const barlowCondensed = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal"],
  display: "swap",
});

// Body font — same family for cohesion, comfortable at small sizes
const barlow = Barlow({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
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
        className={`${barlowCondensed.variable} ${barlow.variable} ${jetbrainsMono.variable} antialiased`}
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
