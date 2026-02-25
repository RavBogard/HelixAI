"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface GeneratedPreset {
  preset: Record<string, unknown>;
  summary: string;
  spec: Record<string, unknown>;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [generatedPreset, setGeneratedPreset] = useState<GeneratedPreset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [premiumKey, setPremiumKey] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check for premium key in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("pro");
    if (key) {
      setPremiumKey(key);
      // Clean the URL so the key isn't visible in the address bar
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 150) + "px";
    }
  }, [input]);

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    setError(null);

    // Add empty assistant message for streaming
    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMessage]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, premiumKey }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.text) {
                fullContent += parsed.text;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: fullContent };
                  return updated;
                });
              }
            } catch (parseError) {
              // Skip malformed SSE chunks
              if (parseError instanceof Error && parseError.message !== "Unexpected end of JSON input") {
                console.warn("SSE parse error:", parseError);
              }
            }
          }
        }
      }

      // Check if the AI indicated it's ready to generate
      if (fullContent.includes("[READY_TO_GENERATE]")) {
        setReadyToGenerate(true);
        // Clean the marker from the displayed message
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: fullContent.replace("[READY_TO_GENERATE]", "").trim(),
          };
          return updated;
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      // Remove the empty assistant message on error
      setMessages(newMessages);
    } finally {
      setIsStreaming(false);
    }
  }

  async function generatePreset() {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, premiumKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Generation failed: ${res.status}`);
      }

      const data = await res.json();
      setGeneratedPreset(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  function downloadPreset() {
    if (!generatedPreset) return;

    const json = JSON.stringify(generatedPreset.preset, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const name = (generatedPreset.spec as { name?: string }).name || "HelixAI_Preset";
    a.href = url;
    a.download = `${name.replace(/[^a-zA-Z0-9_-]/g, "_")}.hlx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function startOver() {
    setMessages([]);
    setInput("");
    setReadyToGenerate(false);
    setGeneratedPreset(null);
    setError(null);
  }

  return (
    <div className="relative z-10 flex flex-col h-screen max-w-4xl mx-auto">
      {/* ═══ Header ═══ */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3.5">
          {/* Tube glow logo */}
          <div className="hlx-tube hlx-tube-sm">
            <span className="text-sm font-bold text-white drop-shadow-sm select-none">H</span>
          </div>
          <div>
            <h1 className="hlx-font-display text-lg font-semibold tracking-tight text-[var(--hlx-text)]">
              HelixAI
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-[var(--hlx-text-muted)]">
                Helix LT Preset Builder
              </p>
              {premiumKey && (
                <span className="hlx-pro">
                  <span className="hlx-led hlx-led-warm" style={{ width: 4, height: 4 }} />
                  Pro
                </span>
              )}
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={startOver}
            className="text-xs text-[var(--hlx-text-muted)] hover:text-[var(--hlx-text-sub)] transition-colors px-3 py-1.5 rounded-lg border border-[var(--hlx-border)] hover:border-[var(--hlx-border-warm)] hover:bg-[var(--hlx-surface)]"
          >
            New Session
          </button>
        )}
      </header>

      {/* Rack divider */}
      <div className="hlx-rack" />

      {/* ═══ Messages ═══ */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          /* ─── Welcome Screen ─── */
          <div className="flex flex-col items-center justify-center h-full text-center gap-6 hlx-stagger">
            {/* Hero logo */}
            <div className="hlx-tube hlx-tube-lg">
              <span className="text-2xl font-bold text-white drop-shadow-sm select-none">H</span>
            </div>

            {/* Headline */}
            <div>
              <h2 className="hlx-font-display text-3xl font-semibold mb-2 hlx-hero-text">
                What tone are you after?
              </h2>
              <p className="text-[var(--hlx-text-sub)] max-w-md leading-relaxed text-[0.9375rem]">
                Describe an artist, a song, a genre, or just a vibe &mdash;
                I&apos;ll build you a studio-quality Helix LT preset.
              </p>
            </div>

            {/* Suggestion pedals */}
            <div className="flex flex-wrap gap-2.5 justify-center max-w-xl">
              {[
                "Mark Knopfler\u2019s Sultans of Swing Alchemy tone",
                "SRV Texas blues crunch",
                "Modern worship ambient clean",
                "80s new wave jangly clean",
                "Metallica Black Album rhythm",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="hlx-pedal"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="hlx-led" />
                    {suggestion}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ─── Chat Flow ─── */
          <div className="space-y-5">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`hlx-msg flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" ? (
                  /* AI message — left amber border accent */
                  <div className="hlx-msg-ai max-w-[88%]">
                    <div
                      className={`message-content text-[0.9375rem] leading-relaxed text-[var(--hlx-text-sub)] ${
                        isStreaming && i === messages.length - 1 ? "typing-cursor" : ""
                      }`}
                    >
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  /* User message — warm amber chip */
                  <div className="hlx-msg-user max-w-[80%]">
                    <div className="text-[0.9375rem] leading-relaxed text-[var(--hlx-text)]">
                      {msg.content}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* ─── Generate Button ─── */}
            {readyToGenerate && !generatedPreset && (
              <div className="flex justify-center py-6">
                <button
                  onClick={generatePreset}
                  disabled={isGenerating}
                  className="hlx-generate"
                >
                  {isGenerating ? (
                    <>
                      <svg className="hlx-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating Preset&hellip;
                    </>
                  ) : (
                    <>
                      {/* Small tube icon */}
                      <span className="w-5 h-5 rounded-md bg-[var(--hlx-void)] flex items-center justify-center text-[10px] font-bold text-[var(--hlx-amber)]">
                        H
                      </span>
                      Generate Helix LT Preset
                    </>
                  )}
                </button>
              </div>
            )}

            {/* ─── Preset Result Card ─── */}
            {generatedPreset && (
              <div className="hlx-preset-card space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="hlx-led hlx-led-on" />
                    <h3 className="hlx-font-display text-lg font-semibold text-[var(--hlx-amber)]">
                      Preset Ready
                    </h3>
                  </div>
                  <button onClick={downloadPreset} className="hlx-download">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download .hlx
                  </button>
                </div>
                <div className="hlx-rack" />
                <div className="text-[0.875rem] text-[var(--hlx-text-sub)] leading-relaxed message-content">
                  <ReactMarkdown>{generatedPreset.summary}</ReactMarkdown>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ═══ Error ═══ */}
      {error && (
        <div className="mx-6 mb-2 hlx-error">
          {error}
        </div>
      )}

      {/* ═══ Input Area ═══ */}
      <div className="px-6 pb-6 pt-2">
        <form onSubmit={sendMessage} className="flex gap-3 items-end">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the tone you're after..."
              rows={1}
              className="hlx-input"
              disabled={isStreaming}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="hlx-send"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </form>
        <p className="text-[11px] text-[var(--hlx-text-muted)] mt-3 text-center tracking-wide">
          Powered by Gemini &middot; Google Search grounded &middot; Line 6 Helix LT
        </p>
      </div>
    </div>
  );
}
