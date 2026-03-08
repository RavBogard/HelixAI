"use client";

import { useRef, useEffect, useCallback } from "react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCameraClick: () => void;
  onAnalyze?: () => void;
  isStreaming: boolean;
  isVisionLoading: boolean;
  rigImageCount: number;
  rigAnalyzed: boolean;
  placeholder?: string;
  formClassName?: string;
  /** External ref for the textarea — allows parent to manage focus */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onCameraClick,
  onAnalyze,
  isStreaming,
  isVisionLoading,
  rigImageCount,
  rigAnalyzed,
  placeholder = "Describe the tone you're after...",
  formClassName = "flex gap-2 items-end",
  inputRef: externalRef,
}: ChatInputProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalRef || internalRef;

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 150) + "px";
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  const showAnalyze = rigImageCount > 0 && !rigAnalyzed && !isVisionLoading && onAnalyze;

  return (
    <form onSubmit={handleSubmit} className={formClassName}>
      {/* Camera button */}
      <button
        type="button"
        title="Analyze my pedal rig"
        aria-label="Upload rig photo"
        onClick={onCameraClick}
        className={`relative flex-shrink-0 w-[44px] h-[44px] rounded-[11px] border flex items-center justify-center transition-all ${
          rigAnalyzed
            ? "border-[var(--hlx-amber)] bg-[rgba(240,144,10,0.08)] text-[var(--hlx-amber)]"
            : rigImageCount > 0
            ? "border-[var(--hlx-border-warm)] bg-[var(--hlx-elevated)] text-[var(--hlx-text-sub)]"
            : "border-[var(--hlx-border)] bg-[var(--hlx-surface)] text-[var(--hlx-text-muted)] hover:text-[var(--hlx-text-sub)] hover:border-[var(--hlx-border-warm)]"
        }`}
      >
        {isVisionLoading ? (
          <svg className="hlx-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
        {/* Count badge — shown when images are staged but not yet analyzed */}
        {rigImageCount > 0 && !isVisionLoading && !rigAnalyzed && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[var(--hlx-amber)] rounded-full text-[9px] text-[var(--hlx-void)] flex items-center justify-center font-bold leading-none">
            {rigImageCount}
          </span>
        )}
      </button>

      <div className="flex-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="hlx-input"
          disabled={isStreaming}
        />
      </div>

      {showAnalyze && (
        <button
          type="button"
          aria-label="Analyze rig photo"
          onClick={onAnalyze}
          className="flex-shrink-0 h-[44px] px-3 rounded-[11px] border border-[var(--hlx-amber)] bg-[rgba(240,144,10,0.06)] text-[var(--hlx-amber)] text-[0.8125rem] font-semibold transition-all hover:bg-[rgba(240,144,10,0.12)] whitespace-nowrap"
        >
          Analyze
        </button>
      )}

      <button
        type="submit"
        aria-label="Send message"
        disabled={!value.trim() || isStreaming}
        className="hlx-send"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19V5m0 0l-7 7m7-7l7 7" />
        </svg>
      </button>
    </form>
  );
}
