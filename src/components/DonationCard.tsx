"use client";

interface DonationCardProps {
  visible: boolean;
  onDismiss: () => void;
}

const DONATION_LINKS = [
  { label: "PayPal", url: "https://paypal.me/dsbogard" },
  { label: "Venmo", url: "https://venmo.com/Daniel-Bogard-1" },
  { label: "CashApp", url: "https://cash.app/$ravbogard" },
];

export function DonationCard({ visible, onDismiss }: DonationCardProps) {
  if (!visible) return null;

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in duration-300">
      <div className="rounded-xl border border-[var(--hlx-border-warm)] bg-[var(--hlx-elevated)] p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[0.8125rem] font-medium text-[var(--hlx-text)]">
              Hope you dig the preset!
            </p>
            <p className="text-[0.75rem] text-[var(--hlx-text-sub)]">
              If HelixTones saved you time, consider buying me a coffee.
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="text-[var(--hlx-text-muted)] hover:text-[var(--hlx-text-sub)] transition-colors flex-shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2">
          {DONATION_LINKS.map(({ label, url }) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-1.5 rounded-lg border border-[var(--hlx-border-warm)] text-[0.75rem] font-medium text-[var(--hlx-text-sub)] hover:bg-[rgba(240,144,10,0.08)] hover:text-[var(--hlx-amber)] transition-all"
              style={{ fontFamily: "var(--font-mono), monospace" }}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
