"use client";

import Image from "next/image";
import { DevicePicker, type DeviceId } from "@/components/DevicePicker";

interface WelcomeScreenProps {
  selectedDevice: DeviceId;
  onDeviceSelect: (id: DeviceId) => void;
  children?: React.ReactNode;
}

export function WelcomeScreen({
  selectedDevice,
  onDeviceSelect,
  children,
}: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-9 hlx-stagger">
      {/* Hero: Large centered logo + wordmark */}
      <div className="space-y-6">
        {/* Big logo with amber glow */}
        <div className="flex justify-center">
          <div className="relative">
            {/* Ambient radial glow behind logo */}
            <div
              className="absolute rounded-3xl"
              style={{
                inset: "-48px",
                background:
                  "radial-gradient(ellipse at 50% 60%, rgba(240,144,10,0.25) 0%, transparent 68%)",
              }}
            />
            <Image
              src="/logo.jpg"
              alt="HelixTones"
              width={320}
              height={320}
              className="relative rounded-3xl"
              style={{
                boxShadow:
                  "0 0 0 1px rgba(240,144,10,0.35), 0 0 100px rgba(240,144,10,0.32), 0 24px 80px rgba(0,0,0,0.7)",
              }}
            />
          </div>
        </div>

        {/* Wordmark + subtitle */}
        <div className="space-y-3">
          <h1
            className="hlx-font-display hlx-hero-text font-black leading-none"
            style={{
              fontSize: "clamp(2.75rem, 7vw, 4.25rem)",
              letterSpacing: "0.14em",
            }}
          >
            helixtones
          </h1>
          <p
            className="text-[var(--hlx-text-sub)] max-w-sm leading-relaxed mx-auto"
            style={{ fontSize: "0.9375rem" }}
          >
            Describe an artist, a song, a genre, or just a vibe &mdash;
            I&apos;ll build you a studio-quality Helix preset.
          </p>
        </div>
      </div>

      {/* Phase 66: Device picker — must select before chatting (FRONT-01) */}
      <div className="flex flex-col items-center gap-3 w-full max-w-sm">
        <p className="text-[11px] text-[var(--hlx-text-muted)] uppercase tracking-widest font-semibold">
          Which device are you building for?
        </p>
        <DevicePicker
          selected={selectedDevice}
          onSelect={onDeviceSelect}
        />
      </div>

      {/* Remaining content (input form, suggestion chips, rig analysis) injected by parent */}
      {children}
    </div>
  );
}
