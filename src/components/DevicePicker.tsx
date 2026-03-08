"use client";

// Phase 66: device picker options — single source of truth for both rig-upload and chat-flow pickers
export const DEVICE_OPTIONS = [
  { id: "helix_lt" as const, label: "LT", desc: "Helix LT" },
  { id: "helix_floor" as const, label: "FLOOR", desc: "Helix Floor" },
  { id: "helix_native" as const, label: "NATIVE", desc: "Helix Native" },
  { id: "helix_stadium" as const, label: "STADIUM", desc: "Helix Stadium" },
  { id: "pod_go" as const, label: "POD GO", desc: "Pod Go" },
  { id: "helix_stomp" as const, label: "STOMP", desc: "HX Stomp" },
  { id: "helix_stomp_xl" as const, label: "STOMP XL", desc: "HX Stomp XL" },
] as const;

export type DeviceId = typeof DEVICE_OPTIONS[number]["id"];

export const DEVICE_LABELS: Record<DeviceId, string> = {
  helix_lt: "Helix LT",
  helix_floor: "Helix Floor",
  helix_native: "Helix Native",
  helix_stadium: "Helix Stadium",
  pod_go: "Pod Go",
  helix_stomp: "HX Stomp",
  helix_stomp_xl: "HX Stomp XL",
};

interface DevicePickerProps {
  selected: DeviceId | null;
  onSelect: (id: DeviceId) => void;
  disabled?: boolean;
  /** Show spinner on the selected device (used during generation) */
  showSpinner?: boolean;
  className?: string;
}

export function DevicePicker({
  selected,
  onSelect,
  disabled = false,
  showSpinner = false,
  className = "grid grid-cols-3 gap-2.5 w-full",
}: DevicePickerProps) {
  return (
    <div role="radiogroup" aria-label="Select your Line 6 device" className={className}>
      {DEVICE_OPTIONS.map(({ id, label, desc }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={selected === id}
          aria-label={desc}
          disabled={disabled}
          onClick={() => onSelect(id)}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
            showSpinner && selected === id
              ? "border-[var(--hlx-amber)] bg-[var(--hlx-elevated)] shadow-[0_0_18px_rgba(240,144,10,0.15)]"
              : selected === id
              ? "border-[var(--hlx-amber)] bg-[var(--hlx-elevated)] shadow-[0_0_18px_rgba(240,144,10,0.15)]"
              : "border-[var(--hlx-border)] bg-[var(--hlx-surface)] hover:border-[var(--hlx-border-warm)] hover:bg-[var(--hlx-elevated)]"
          }`}
        >
          {showSpinner && selected === id ? (
            <svg className="hlx-spin h-4 w-4 text-[var(--hlx-amber)]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <span className="text-[12px] font-bold tracking-wider text-[var(--hlx-text)]" style={{ fontFamily: "var(--font-mono)" }}>{label}</span>
          )}
          <span className="text-[10px] text-[var(--hlx-text-muted)]">{desc}</span>
        </button>
      ))}
    </div>
  );
}
