"use client";

export const FOOTER_HEIGHT = "2.25rem";

export function Footer() {
  function handleSupport() {
    window.dispatchEvent(new Event("helixtones:show-support"));
  }

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center px-4"
      style={{
        height: FOOTER_HEIGHT,
        fontFamily: "var(--font-mono), monospace",
        background: "linear-gradient(transparent, var(--hlx-void) 40%)",
        pointerEvents: "none",
      }}
    >
      <p
        className="text-[11px] text-[var(--hlx-text-muted)] tracking-wide"
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
        {" "}&middot; Powered by Gemini &middot; Claude &middot; Line 6 Helix
      </p>
    </footer>
  );
}
