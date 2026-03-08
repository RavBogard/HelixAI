"use client";

const SUGGESTIONS = [
  "Mark Knopfler\u2019s Sultans of Swing tone",
  "SRV Texas blues crunch",
  "Modern worship ambient clean",
  "80s new wave jangly clean",
  "Metallica Black Album rhythm",
  "Edge of U2 dotted-eighth delays",
];

interface SuggestionChipsProps {
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export function SuggestionChips({ onSelect, disabled = false }: SuggestionChipsProps) {
  return (
    <div className="grid grid-cols-3 gap-2.5 w-full max-w-2xl">
      {SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion}
          disabled={disabled}
          onClick={() => onSelect(suggestion)}
          className="text-left p-4 rounded-xl border border-[var(--hlx-border)] bg-[var(--hlx-surface)] text-[0.8rem] leading-snug text-[var(--hlx-text-sub)] hover:border-[rgba(240,144,10,0.22)] hover:bg-[var(--hlx-elevated)] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.35)] transition-all duration-200"
          style={{ fontFamily: "var(--font-mono), monospace" }}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
