"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Signal chain block data from PresetSpec
interface VizBlock {
  type: string;
  modelName: string;
  dsp: number;
  enabled: boolean;
}

// Snapshot data from PresetSpec
interface VizSnapshot {
  name: string;
  ledColor: number;
  description: string;
}

// LED color number → CSS color mapping (matches Helix hardware colors)
const LED_CSS: Record<number, string> = {
  1: "#ef4444",   // Red
  2: "#f97316",   // Orange
  3: "#eab308",   // Yellow
  4: "#22c55e",   // Green
  5: "#06b6d4",   // Turquoise
  6: "#3b82f6",   // Blue
  7: "#e5e7eb",   // White
  8: "#a855f7",   // Purple
};

// Block type → display label
const BLOCK_LABEL: Record<string, string> = {
  dynamics: "Gate",
  distortion: "Drive",
  amp: "Amp",
  cab: "Cab",
  eq: "EQ",
  volume: "Gain",
  modulation: "Mod",
  delay: "Delay",
  reverb: "Reverb",
  wah: "Wah",
  pitch: "Pitch",
  send_return: "FX Loop",
};

function SignalChainViz({ blocks }: { blocks: VizBlock[] }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-center gap-1.5 min-w-0">
        {blocks.map((block, i) => (
          <div key={i} className="flex items-center gap-1.5 flex-shrink-0">
            <div
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-center min-w-[64px] transition-opacity ${
                block.enabled
                  ? "bg-[var(--hlx-elevated)] border-[var(--hlx-border-warm)]"
                  : "bg-[var(--hlx-surface)] border-[var(--hlx-border)] opacity-40"
              }`}
            >
              <span className="text-[10px] font-semibold tracking-wide uppercase text-[var(--hlx-text-muted)]">
                {BLOCK_LABEL[block.type] || block.type}
              </span>
              <span className="text-[11px] text-[var(--hlx-text-sub)] leading-tight max-w-[80px] truncate">
                {block.modelName}
              </span>
              <span
                className="w-[5px] h-[5px] rounded-full mt-0.5"
                style={{
                  background: block.enabled ? "var(--hlx-green)" : "var(--hlx-text-muted)",
                  boxShadow: block.enabled ? "0 0 6px var(--hlx-green)" : "none",
                }}
              />
            </div>
            {i < blocks.length - 1 && (
              <svg width="12" height="12" viewBox="0 0 12 12" className="flex-shrink-0 text-[var(--hlx-text-muted)]">
                <path d="M2 6h8M7 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ToneDescriptionCard({
  name,
  description,
  ampName,
  cabName,
  effects,
  snapshots,
  guitarNotes,
}: {
  name: string;
  description: string;
  ampName: string;
  cabName: string;
  effects: VizBlock[];
  snapshots: VizSnapshot[];
  guitarNotes?: string;
}) {
  return (
    <div className="space-y-4">
      {/* Amp → Cab pair */}
      <div className="flex items-center gap-2 text-[0.8125rem]">
        <span className="text-[var(--hlx-text-muted)] text-[11px] uppercase tracking-wide font-semibold">Signal</span>
        <span className="text-[var(--hlx-text)]">{ampName}</span>
        <span className="text-[var(--hlx-text-muted)]">&rarr;</span>
        <span className="text-[var(--hlx-text)]">{cabName}</span>
      </div>

      {/* Effects list */}
      {effects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {effects.map((fx, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--hlx-elevated)] border border-[var(--hlx-border)] text-[11px] text-[var(--hlx-text-sub)]"
            >
              <span className="text-[var(--hlx-text-muted)] font-semibold uppercase text-[9px]">
                {BLOCK_LABEL[fx.type] || fx.type}
              </span>
              {fx.modelName}
            </span>
          ))}
        </div>
      )}

      {/* Snapshots */}
      <div className="flex flex-wrap gap-2">
        {snapshots.map((snap, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--hlx-surface)] border border-[var(--hlx-border)] text-[11px] text-[var(--hlx-text-sub)]"
          >
            <span
              className="w-[6px] h-[6px] rounded-full flex-shrink-0"
              style={{
                background: LED_CSS[snap.ledColor] || LED_CSS[7],
                boxShadow: `0 0 6px ${LED_CSS[snap.ledColor] || LED_CSS[7]}40`,
              }}
            />
            {snap.name}
          </span>
        ))}
      </div>

      {/* Guitar notes */}
      {guitarNotes && (
        <div className="text-[0.8125rem] text-[var(--hlx-text-sub)] leading-relaxed border-l-2 border-[var(--hlx-border-warm)] pl-3 italic">
          {guitarNotes}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [generatedPreset, setGeneratedPreset] = useState<{
    preset: Record<string, unknown>;
    summary: string;
    spec: Record<string, unknown> & { name?: string };
    toneIntent: Record<string, unknown>;
    device: string;
    fileExtension?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [premiumKey, setPremiumKey] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<"helix_lt" | "helix_floor" | "pod_go">("helix_lt");

  // Vision state (Phase 19)
  const [rigImages, setRigImages] = useState<File[]>([]);
  const [isVisionLoading, setIsVisionLoading] = useState(false);
  const [rigIntent, setRigIntent] = useState<{
    pedals: Array<{
      brand: string;
      model: string;
      fullName: string;
      knobPositions: Record<string, string>;
      imageIndex: number;
      confidence: "high" | "medium" | "low";
    }>;
    rigDescription?: string;
    extractionNotes?: string;
  } | null>(null);
  const [visionError, setVisionError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check for premium key in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("pro");
    if (key) {
      setPremiumKey(key);
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
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: fullContent };
                  return updated;
                });
              }
            } catch (parseError) {
              if (
                parseError instanceof Error &&
                parseError.message !== "Unexpected end of JSON input"
              ) {
                console.warn("SSE parse error:", parseError);
              }
            }
          }
        }
      }

      // Check if the AI indicated it's ready to generate
      if (fullContent.includes("[READY_TO_GENERATE]")) {
        setReadyToGenerate(true);
        setMessages((prev) => {
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
        body: JSON.stringify({
          messages,
          premiumKey,
          device: selectedDevice,
        }),
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
    if (!generatedPreset?.preset) return;

    const json = JSON.stringify(generatedPreset.preset, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const baseName = generatedPreset.spec?.name || "HelixAI_Preset";
    const ext = generatedPreset.fileExtension || ".hlx";
    a.href = url;
    a.download = `${baseName.replace(/[^a-zA-Z0-9_()-]/g, "_")}${ext}`;
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
    // Phase 19: clear vision state
    setRigImages([]);
    setRigIntent(null);
    setVisionError(null);
  }

  async function callVision() {
    if (rigImages.length === 0) return;
    setIsVisionLoading(true);
    setVisionError(null);
    setRigIntent(null);

    try {
      // Dynamic import — browser-image-compression uses browser APIs (OffscreenCanvas, File, Blob).
      // Must NOT be a static top-level import: SSR would fail during Next.js build.
      const imageCompression = (await import("browser-image-compression")).default;

      const compressed = await Promise.all(
        rigImages.map(async (file) => {
          const compressedFile = await imageCompression(file, {
            maxSizeMB: 0.8,          // 800 KB target
            maxWidthOrHeight: 1568,  // Anthropic optimal: long edge ≤ 1568px
            useWebWorker: true,      // Non-blocking; falls back to main thread if OffscreenCanvas unavailable
            initialQuality: 0.8,
          });
          // getDataUrlFromFile returns "data:image/jpeg;base64,<data>"
          // The Anthropic SDK requires raw base64 — strip the prefix.
          const dataUrl = await imageCompression.getDataUrlFromFile(compressedFile);
          const base64Data = dataUrl.split(",")[1];
          const mediaType = compressedFile.type || "image/jpeg";
          return { data: base64Data, mediaType };
        })
      );

      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: compressed }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Vision API error: ${res.status}`);
      }

      const data = await res.json();
      setRigIntent(data.rigIntent);
    } catch (err) {
      setVisionError(
        err instanceof Error ? err.message : "Vision extraction failed"
      );
    } finally {
      setIsVisionLoading(false);
    }
  }

  return (
    <div className="relative z-10 flex flex-col h-screen max-w-5xl mx-auto">
      {/* --- Header --- */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3.5">
          <div className="hlx-tube hlx-tube-sm">
            <span className="text-sm font-bold text-white drop-shadow-sm select-none">H</span>
          </div>
          <div>
            <h1 className="hlx-font-display text-lg font-semibold tracking-tight text-[var(--hlx-text)]">
              HelixAI
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-[var(--hlx-text-muted)]">
                Helix Preset Builder
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

      <div className="hlx-rack" />

      {/* --- Messages --- */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          /* --- Welcome Screen --- */
          <div className="flex flex-col items-center justify-center h-full text-center gap-6 hlx-stagger">
            <div className="hlx-tube hlx-tube-lg">
              <span className="text-2xl font-bold text-white drop-shadow-sm select-none">H</span>
            </div>

            <div>
              <h2 className="hlx-font-display text-3xl font-semibold mb-2 hlx-hero-text">
                What tone are you after?
              </h2>
              <p className="text-[var(--hlx-text-sub)] max-w-md leading-relaxed text-[0.9375rem]">
                Describe an artist, a song, a genre, or just a vibe &mdash;
                I&apos;ll build you a studio-quality Helix preset.
              </p>
            </div>

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

            {/* --- Rig Photo Upload Panel (Phase 19) --- */}
            <div className="w-full max-w-xl mt-2 rounded-xl border border-[var(--hlx-border)] bg-[var(--hlx-surface)] p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-widest text-[var(--hlx-text-muted)] font-semibold">
                Or analyze your pedal rig
              </p>
              <p className="text-[0.8125rem] text-[var(--hlx-text-sub)]">
                Upload up to 3 pedal photos — we&apos;ll identify your gear automatically.
              </p>

              {/* File input */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setRigImages(files.slice(0, 3));
                    setRigIntent(null);
                    setVisionError(null);
                  }}
                />
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--hlx-border)] bg-[var(--hlx-elevated)] text-[0.8125rem] text-[var(--hlx-text-sub)] hover:border-[var(--hlx-border-warm)] hover:text-[var(--hlx-text)] transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Choose Photos
                </span>
                <span className="text-[0.8125rem] text-[var(--hlx-text-muted)]">
                  {rigImages.length === 0
                    ? "No files selected"
                    : `${rigImages.length} file${rigImages.length > 1 ? "s" : ""} selected`}
                </span>
              </label>

              {/* Selected file list */}
              {rigImages.length > 0 && (
                <ul className="space-y-1">
                  {rigImages.map((file, i) => (
                    <li key={i} className="text-[0.8125rem] text-[var(--hlx-text-sub)] flex items-center gap-2">
                      <span className="hlx-led" />
                      {file.name}
                      <span className="text-[var(--hlx-text-muted)] text-[11px]">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Analyze button */}
              <button
                onClick={callVision}
                disabled={rigImages.length === 0 || isVisionLoading}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-[0.8125rem] font-medium transition-all ${
                  rigImages.length === 0 || isVisionLoading
                    ? "border-[var(--hlx-border)] text-[var(--hlx-text-muted)] bg-[var(--hlx-surface)] cursor-not-allowed opacity-50"
                    : "border-[var(--hlx-amber)] text-[var(--hlx-text)] bg-[var(--hlx-elevated)] hover:bg-[var(--hlx-surface)] cursor-pointer shadow-[0_0_0_1px_var(--hlx-amber),0_0_12px_rgba(245,158,11,0.10)]"
                }`}
              >
                {isVisionLoading ? (
                  <>
                    <svg className="hlx-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing Photos&hellip;
                  </>
                ) : (
                  <>
                    <span className="w-4 h-4 rounded bg-[var(--hlx-void)] flex items-center justify-center text-[9px] font-bold text-[var(--hlx-amber)]">H</span>
                    Analyze Photos
                  </>
                )}
              </button>

              {/* Vision error */}
              {visionError && (
                <div className="text-[0.8125rem] text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2">
                  {visionError}
                </div>
              )}

              {/* RigIntent result — raw JSON display (Phase 19: display-only; Phase 20 wires into generate) */}
              {rigIntent && (
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-widest text-[var(--hlx-text-muted)] font-semibold">
                    Extraction Result
                  </p>

                  {/* Per-pedal confidence badges */}
                  {rigIntent.pedals.map((pedal, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-lg border border-[var(--hlx-border)] bg-[var(--hlx-elevated)] px-3 py-2"
                    >
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 mt-0.5 ${
                          pedal.confidence === "high"
                            ? "bg-green-950/40 text-green-400 border border-green-900/30"
                            : pedal.confidence === "medium"
                            ? "bg-yellow-950/40 text-yellow-400 border border-yellow-900/30"
                            : "bg-red-950/40 text-red-400 border border-red-900/30"
                        }`}
                      >
                        {pedal.confidence}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[0.8125rem] text-[var(--hlx-text)] truncate">
                          {pedal.fullName || "(unidentified pedal)"}
                        </p>
                        {pedal.confidence !== "high" && (
                          <p className="text-[11px] text-yellow-400/80 mt-0.5">
                            Confirm this identification before generating — type the correct pedal name in the chat.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Raw JSON for debugging (Phase 19 only — replaced by SubstitutionCard in Phase 21) */}
                  <details className="group">
                    <summary className="text-[11px] text-[var(--hlx-text-muted)] cursor-pointer hover:text-[var(--hlx-text-sub)] transition-colors">
                      Raw extraction data
                    </summary>
                    <pre className="mt-2 text-[10px] text-[var(--hlx-text-muted)] bg-[var(--hlx-void)] rounded-lg p-3 overflow-x-auto leading-relaxed">
                      {JSON.stringify(rigIntent, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* --- Chat Flow --- */
          <div className="space-y-5">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`hlx-msg flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" ? (
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
                  <div className="hlx-msg-user max-w-[80%]">
                    <div className="text-[0.9375rem] leading-relaxed text-[var(--hlx-text)]">
                      {msg.content}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* --- Device Selector + Generate --- */}
            {readyToGenerate && !generatedPreset && (
              <div className="flex flex-col items-center gap-4 py-6">
                {/* Device selector */}
                <div className="flex flex-col items-center gap-2.5">
                  <p className="text-xs text-[var(--hlx-text-muted)] tracking-wide uppercase">
                    Target Device
                  </p>
                  <div className="flex gap-2">
                    {(["helix_lt", "helix_floor", "pod_go"] as const).map((device) => (
                      <button
                        key={device}
                        onClick={() => setSelectedDevice(device)}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] border text-[0.8125rem] font-medium transition-all cursor-pointer ${
                          selectedDevice === device
                            ? "border-[var(--hlx-amber)] text-[var(--hlx-text)] bg-[var(--hlx-elevated)] shadow-[0_0_0_1px_var(--hlx-amber),0_0_12px_rgba(245,158,11,0.15)]"
                            : "border-[var(--hlx-border)] text-[var(--hlx-text-muted)] bg-[var(--hlx-surface)] hover:border-[var(--hlx-border-warm)] hover:text-[var(--hlx-text-sub)] hover:bg-[var(--hlx-elevated)]"
                        }`}
                      >
                        <span className={`hlx-led ${selectedDevice === device ? "hlx-led-warm" : ""}`} />
                        {device === "helix_lt" ? "Helix LT" : device === "helix_floor" ? "Helix Floor" : "Pod Go"}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={generatePreset} disabled={isGenerating} className="hlx-generate">
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
                      <span className="w-5 h-5 rounded-md bg-[var(--hlx-void)] flex items-center justify-center text-[10px] font-bold text-[var(--hlx-amber)]">H</span>
                      Generate Preset
                    </>
                  )}
                </button>
              </div>
            )}

            {/* --- Single Preset Result --- */}
            {generatedPreset && (() => {
              const spec = generatedPreset.spec as Record<string, unknown>;
              const chain = (spec.signalChain || []) as VizBlock[];
              const snaps = (spec.snapshots || []) as VizSnapshot[];
              const intent = generatedPreset.toneIntent as Record<string, unknown>;
              const ampBlock = chain.find((b) => b.type === "amp");
              const cabBlock = chain.find((b) => b.type === "cab");
              const effectBlocks = chain.filter(
                (b) => !["amp", "cab", "eq", "volume", "dynamics"].includes(b.type)
              );

              return (
                <div className="hlx-preset-card space-y-5 max-w-2xl mx-auto">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="hlx-led hlx-led-warm" />
                      <h3 className="hlx-font-display text-base font-semibold text-[var(--hlx-text)]">
                        {generatedPreset.spec?.name || "HelixAI Preset"}
                      </h3>
                    </div>
                    <button onClick={downloadPreset} className="hlx-download text-xs px-3 py-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download {generatedPreset.fileExtension || ".hlx"}
                    </button>
                  </div>

                  <div className="hlx-rack" />

                  {/* Signal Chain Visualization (FXUI-01) */}
                  {chain.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-[var(--hlx-text-muted)] font-semibold mb-2">
                        Signal Chain
                      </p>
                      <SignalChainViz blocks={chain} />
                    </div>
                  )}

                  <div className="hlx-rack" />

                  {/* Tone Description Card (FXUI-02) */}
                  <ToneDescriptionCard
                    name={(spec.name as string) || "Preset"}
                    description={(spec.description as string) || ""}
                    ampName={ampBlock?.modelName || (intent.ampName as string) || "Unknown Amp"}
                    cabName={cabBlock?.modelName || (intent.cabName as string) || "Unknown Cab"}
                    effects={effectBlocks}
                    snapshots={snaps}
                    guitarNotes={(spec.guitarNotes as string) || (intent.guitarNotes as string) || undefined}
                  />

                  <div className="hlx-rack" />

                  {/* Summary */}
                  <div className="text-[0.8125rem] text-[var(--hlx-text-sub)] leading-relaxed message-content">
                    <ReactMarkdown>{generatedPreset.summary || ""}</ReactMarkdown>
                  </div>
                </div>
              );
            })()}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* --- Error --- */}
      {error && (
        <div className="mx-6 mb-2 hlx-error">
          {error}
        </div>
      )}

      {/* --- Input Area --- */}
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
      </div>
    </div>
  );
}
