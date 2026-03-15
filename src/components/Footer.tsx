"use client";

export const FOOTER_HEIGHT = "2.5rem";

export function Footer() {
  function handleSupport() {
    window.dispatchEvent(new Event("helixtones:show-support"));
  }

  return (
    <footer
      role="contentinfo"
      aria-label="Site footer"
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center px-4"
      style={{
        height: FOOTER_HEIGHT,
        fontFamily: "var(--font-mono), monospace",
        background: "linear-gradient(transparent 0%, var(--hlx-void) 50%)",
        pointerEvents: "none",
      }}
    >
      <p
        className="text-[10px] text-[var(--hlx-text-muted)] tracking-wide opacity-70"
        style={{ pointerEvents: "auto" }}
      >
        <button
          onClick={handleSupport}
          className="text-[var(--hlx-text-muted)] hover:text-[var(--hlx-amber)] transition-colors"
        >
          Support
        </button>
        {" "}&middot;{" "}
        A project of{" "}
        <a
          href="https://danielbogard.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--hlx-text-sub)] hover:text-[var(--hlx-amber)] transition-colors"
        >
          Daniel Bogard
        </a>
        {" "}&middot; Powered by Gemini &middot; Line 6 Helix
      </p>
    </footer>
  );
}
