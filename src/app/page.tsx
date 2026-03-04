"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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

// ---------------------------------------------------------------------------
// SubstitutionCard (Phase 21)
// Renders the list of physical pedal → Helix model substitutions produced by
// /api/map. Shown in the upload panel after vision extraction, before Generate.
// ---------------------------------------------------------------------------

interface SubstitutionEntryDisplay {
  physicalPedal: string;
  helixModel: string;
  helixModelDisplayName: string;
  substitutionReason: string;
  confidence: "direct" | "close" | "approximate";
  parameterMapping?: Record<string, number>;
}

function SubstitutionCard({ entries }: { entries: SubstitutionEntryDisplay[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-widest text-[var(--hlx-text-muted)] font-semibold">
        Helix Substitutions
      </p>
      <div className="space-y-2">
        {entries.map((entry, i) => {
          const isApproximate = entry.confidence === "approximate";
          const isClose = entry.confidence === "close";
          const isDirect = entry.confidence === "direct";

          // Safety guard: never render an HD2_ internal ID in the UI.
          // helixModelDisplayName is always human-readable per rig-intent.ts,
          // but this guard protects against future regressions.
          const displayName = entry.helixModelDisplayName.startsWith("HD2_")
            ? entry.helixModel.replace(/^HD2_/, "").replace(/_/g, " ")
            : entry.helixModelDisplayName;

          return (
            <div
              key={i}
              className={`rounded-lg border px-3 py-2.5 transition-all ${
                isDirect
                  ? "border-[var(--hlx-border-warm)] bg-[var(--hlx-elevated)]"
                  : isClose
                  ? "border-yellow-900/40 bg-[var(--hlx-surface)]"
                  : "border-orange-900/30 bg-[var(--hlx-surface)] opacity-70"
              }`}
            >
              {/* Header row: Physical → Helix name + confidence badge */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[0.8125rem] text-[var(--hlx-text)] font-medium truncate">
                    {entry.physicalPedal}
                  </span>
                  <svg
                    className="w-3 h-3 text-[var(--hlx-text-muted)] flex-shrink-0"
                    fill="none"
                    viewBox="0 0 12 12"
                  >
                    <path
                      d="M2 6h8M7 3l3 3-3 3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span
                    className={`text-[0.8125rem] font-semibold flex-shrink-0 ${
                      isDirect
                        ? "text-[var(--hlx-amber)]"
                        : isClose
                        ? "text-yellow-400"
                        : "text-orange-400"
                    }`}
                  >
                    {displayName}
                  </span>
                </div>

                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${
                    isDirect
                      ? "bg-green-950/40 text-green-400 border border-green-900/30"
                      : isClose
                      ? "bg-yellow-950/40 text-yellow-400 border border-yellow-900/30"
                      : "bg-orange-950/30 text-orange-400 border border-orange-900/30"
                  }`}
                >
                  {isDirect ? "Exact match" : isClose ? "Best match" : "Approximate"}
                </span>
              </div>

              {/* Substitution reason */}
              <p className="text-[11px] text-[var(--hlx-text-muted)] mt-1.5 leading-relaxed">
                {entry.substitutionReason}
              </p>

              {/* Escape hatch panel — only for approximate (unknown pedal) entries */}
              {isApproximate && (
                <div className="mt-2 rounded-md bg-orange-950/20 border border-orange-900/20 px-2.5 py-2">
                  <p className="text-[11px] text-orange-300/90 leading-relaxed">
                    We don&apos;t have <strong>{entry.physicalPedal}</strong> in our
                    database. You can describe its sound instead, or we&apos;ll treat it
                    as an overdrive-type pedal.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HomeContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  // CHANGE 4-B: add substitutionMap? to generatedPreset state type
  const [generatedPreset, setGeneratedPreset] = useState<{
    preset: Record<string, unknown>;
    summary: string;
    spec: Record<string, unknown> & { name?: string };
    toneIntent: Record<string, unknown>;
    device: string;
    fileExtension?: string;
    substitutionMap?: Array<{
      physicalPedal: string;
      helixModel: string;
      helixModelDisplayName: string;
      substitutionReason: string;
      confidence: "direct" | "close" | "approximate";
      parameterMapping?: Record<string, number>;
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [premiumKey, setPremiumKey] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<"helix_lt" | "helix_floor" | "pod_go">("helix_lt");
  // Auth state (Phase 25)
  const [user, setUser] = useState<{ id: string; is_anonymous?: boolean; email?: string; user_metadata?: Record<string, string> } | null>(null);

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
  // CHANGE 4-A: rig mapping state (Phase 20) — populated after generate when rigIntent was provided
  const [substitutionMap, setSubstitutionMap] = useState<Array<{
    physicalPedal: string;
    helixModel: string;
    helixModelDisplayName: string;
    substitutionReason: string;
    confidence: "direct" | "close" | "approximate";
    parameterMapping?: Record<string, number>;
  }> | null>(null);
  // Phase 21: mapping loading state — true while /api/map is in flight
  const [isMappingLoading, setIsMappingLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Phase 23: rig file input ref — camera button in prompt bar
  const rigFileInputRef = useRef<HTMLInputElement>(null);

  // Phase 27: Conversation persistence state
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const isFirstMessageRef = useRef(true);
  // Phase 27: stored preset path from resumed conversation (STORE-02)
  const [storedPresetPath, setStoredPresetPath] = useState<string | null>(null);

  // Phase 28: resume UX state
  const [isResumingConversation, setIsResumingConversation] = useState(false)
  // Phase 28: UXP-01 — sign-in banner state
  const [showSignInBanner, setShowSignInBanner] = useState(false)
  // Phase 28: UXP-02 — loading state during conversation resume
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationParam = searchParams.get("conversation");

  // Check for premium key in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("pro");
    if (key) {
      setPremiumKey(key);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Phase 25: Combined anonymous session init + sessionStorage state restoration.
  // Single useEffect to prevent race conditions between session init and state restoration.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    let unsubscribe: (() => void) | undefined

    const init = async () => {
      // 1. Get or create session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        await supabase.auth.signInAnonymously()
      }
      // Set initial user state
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      // 2. Restore pre-OAuth chat state if redirected back from Google
      const preserved = sessionStorage.getItem('helixai_pre_oauth_state')
      if (preserved) {
        try {
          const parsed = JSON.parse(preserved)
          // Discard if older than 10 minutes
          if (parsed.timestamp && Date.now() - parsed.timestamp < 10 * 60 * 1000) {
            if (parsed.messages?.length > 0) setMessages(parsed.messages)
            if (parsed.device) setSelectedDevice(parsed.device)
          }
        } catch { /* corrupt state — ignore */ }
        sessionStorage.removeItem('helixai_pre_oauth_state')
      }

      // 3. Subscribe to auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          setUser(session?.user ?? null)
        }
      )
      unsubscribe = () => subscription.unsubscribe()
    }

    init()
    return () => unsubscribe?.()
  }, [])

  // Phase 25: Handle auth_error URL param from failed OAuth callback.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('auth_error') === 'true') {
      setError('Sign in failed — please try again')
      // Clean up URL without reload
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

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

  // Phase 21: Re-run /api/map when the user changes device after vision extraction.
  // Ensures SubstitutionCard shows device-appropriate model names (Pod Go vs Helix LT).
  // callMap reads selectedDevice from closure at call time — safe because this effect
  // only fires when selectedDevice changes, so the closure value is always current.
  useEffect(() => {
    if (rigIntent) {
      callMap(rigIntent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice]);

  // Phase 25: Serialize chat state to sessionStorage before OAuth redirect.
  // Called by AuthButton (Plan 02) before triggering OAuth redirect.
  const serializeChatState = useCallback(() => {
    sessionStorage.setItem('helixai_pre_oauth_state', JSON.stringify({
      messages,
      device: selectedDevice,
      timestamp: Date.now(),
    }))
  }, [messages, selectedDevice])

  // Phase 25: Listen for AuthButton's pre-sign-in event (event-based decoupling
  // avoids React Context — AuthButton lives in layout.tsx, serializeChatState lives here).
  useEffect(() => {
    const handler = () => serializeChatState()
    window.addEventListener('helixai:before-signin', handler)
    return () => window.removeEventListener('helixai:before-signin', handler)
  }, [serializeChatState])

  // Phase 28: SIDE-04 — resume conversation from URL param
  // When sidebar navigates to /?conversation=<id>, load that conversation
  useEffect(() => {
    if (conversationParam && conversationParam !== conversationId) {
      loadConversation(conversationParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationParam])
  // Note: intentional — we only want to trigger on conversationParam change,
  // not on conversationId changes (would cause re-load loop).
  // loadConversation is stable (async function declared in component, no deps that change).

  // Phase 28: SIDE-03 — New Chat button in sidebar calls startOver() via event
  useEffect(() => {
    const handler = () => {
      startOver()
      // conversationId and storedPresetPath are cleared by startOver()
    }
    window.addEventListener('helixai:new-chat', handler)
    return () => window.removeEventListener('helixai:new-chat', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // startOver is defined once, no deps

  // Phase 27: Create conversation on first authenticated message
  const ensureConversation = useCallback(async (): Promise<string | null> => {
    // Already have a conversation — return immediately
    if (conversationIdRef.current) return conversationIdRef.current;

    // Check auth state — anonymous users don't get conversations
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || currentUser.is_anonymous) return null;
    } catch {
      return null;
    }

    // Create conversation via Phase 26 endpoint
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device: selectedDevice }),
      });
      if (!res.ok) return null;
      const conv = await res.json();
      conversationIdRef.current = conv.id;
      setConversationId(conv.id);
      isFirstMessageRef.current = true;

      // Phase 30: sidebar notification DEFERRED to after auto-title completes
      // (was Phase 28 SIDE-06 — moved to sendMessage() and generatePreset() success paths)

      return conv.id;
    } catch {
      return null;
    }
  }, [selectedDevice]);

  async function sendMessage(e?: React.FormEvent) {
    setIsResumingConversation(false); // User is now active in this conversation
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    setError(null);

    // Phase 27: ensure conversation exists for authenticated users
    const convId = await ensureConversation();

    // Add empty assistant message for streaming
    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMessage]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          premiumKey,
          ...(convId ? { conversationId: convId } : {}),
        }),
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

      // Phase 30: auto-title conversation after first AI response, then notify sidebar
      if (convId && isFirstMessageRef.current) {
        isFirstMessageRef.current = false;
        const title = userMessage.content.split(" ").slice(0, 7).join(" ");
        fetch(`/api/conversations/${convId}/title`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        })
          .then((res) => {
            if (res.ok) {
              // Phase 30: notify sidebar AFTER title is set — shows real title, not "New Chat"
              window.dispatchEvent(new Event('helixai:conversation-created'));
            }
          })
          .catch(() => {
            // Title failed but conversation exists — still notify sidebar so it appears
            window.dispatchEvent(new Event('helixai:conversation-created'));
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

  // CHANGE 4-C: pass rigIntent in generate body; store substitutionMap from response
  // overrideMessages: used by handleRigGenerate() when calling from the welcome screen,
  // where React state hasn't flushed yet. Falls back to messages state for the chat flow.
  async function generatePreset(overrideMessages?: Message[], overrideDevice?: "helix_lt" | "helix_floor" | "pod_go") {
    setIsResumingConversation(false); // User is regenerating
    setIsGenerating(true);
    setError(null);

    // Phase 27: ensure conversation for direct-generate paths (e.g., handleRigGenerate)
    const convId = conversationIdRef.current ?? await ensureConversation();

    try {
      setSubstitutionMap(null);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: overrideMessages ?? messages,
          premiumKey,
          device: overrideDevice ?? selectedDevice,
          // Phase 20: pass rigIntent if vision extraction was performed
          ...(rigIntent ? { rigIntent } : {}),
          ...(convId ? { conversationId: convId } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Generation failed: ${res.status}`);
      }

      const data = await res.json();
      setGeneratedPreset(data);
      // Phase 20: store substitution map from generate response
      if (data.substitutionMap) {
        setSubstitutionMap(data.substitutionMap);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  // handleRigGenerate — called from the welcome screen "Build Rig Preset" button.
  // Injects a synthetic user message so the /api/generate route's messages.length > 0
  // guard passes, then calls generatePreset() with the local message list before React
  // flushes state. Switches the UI to the chat flow by setting messages state.
  async function handleRigGenerate(overrideDevice?: "helix_lt" | "helix_floor" | "pod_go") {
    const syntheticMsg: Message = {
      role: "user",
      content: "Build a preset from my pedal rig",
    };
    setMessages([syntheticMsg]);
    await generatePreset([syntheticMsg], overrideDevice);
  }

  function downloadPreset() {
    if (!generatedPreset?.preset) return;

    const json = JSON.stringify(generatedPreset.preset, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const baseName = generatedPreset.spec?.name || "HelixAI_Preset";
    const ext = generatedPreset.fileExtension || ".hlx";
    // Include device in filename so users can spot a mismatch before importing
    const deviceSuffix =
      generatedPreset.device === "helix_lt" ? "_LT"
      : generatedPreset.device === "helix_floor" ? "_Floor"
      : generatedPreset.device === "pod_go" ? "_PodGo"
      : "";
    a.href = url;
    a.download = `${baseName.replace(/[^a-zA-Z0-9_()-]/g, "_")}${deviceSuffix}${ext}`;
    a.click();
    URL.revokeObjectURL(url);

    // Phase 28: UXP-01 — prompt anonymous users to sign in after first download
    // conversationId is null for anonymous users (ensureConversation returns null for them)
    if (!conversationId) {
      setShowSignInBanner(true)
    }
  }

  // Phase 27: re-download stored preset from Supabase Storage (STORE-02)
  async function downloadStoredPreset() {
    if (!storedPresetPath) return;

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.storage
        .from("presets")
        .createSignedUrl(storedPresetPath, 3600); // 1-hour signed URL

      if (error || !data?.signedUrl) {
        setError("Could not retrieve stored preset");
        return;
      }

      // Determine filename from stored path
      const ext = storedPresetPath.endsWith(".pgp") ? ".pgp" : ".hlx";
      const deviceSuffix =
        selectedDevice === "helix_lt" ? "_LT"
        : selectedDevice === "helix_floor" ? "_Floor"
        : selectedDevice === "pod_go" ? "_PodGo"
        : "";
      const filename = `HelixAI_Preset${deviceSuffix}${ext}`;

      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = filename;
      a.click();
    } catch {
      setError("Failed to download stored preset");
    }
  }

  // Phase 27: load a resumed conversation from API
  async function loadConversation(convId: string) {
    // Phase 28: UXP-02 — show loading state during resume
    setIsLoadingConversation(true)
    setMessages([]) // Clear immediately so stale messages don't flash

    try {
      const res = await fetch(`/api/conversations/${convId}`);
      if (!res.ok) {
        setError("Failed to load conversation");
        return;
      }
      const data = await res.json();

      // Restore conversation state
      conversationIdRef.current = convId;
      setConversationId(convId);
      isFirstMessageRef.current = false; // Not the first message — title already exists

      // Restore messages
      if (data.messages && Array.isArray(data.messages)) {
        setMessages(data.messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })));
      }

      // Restore device
      if (data.device) {
        setSelectedDevice(data.device as "helix_lt" | "helix_floor" | "pod_go");
      }

      // Check for stored preset
      if (data.preset_url) {
        setStoredPresetPath(data.preset_url);
      } else {
        setStoredPresetPath(null);
      }

      // Check if ready to generate from conversation history
      const lastMsg = data.messages?.[data.messages.length - 1];
      if (lastMsg?.content?.includes("[READY_TO_GENERATE]") || lastMsg?.role === "assistant") {
        setReadyToGenerate(true);
      }

      // Phase 28: mark as resumed for UXP-03 continuation chips
      setIsResumingConversation(true);
      // Clean URL param — hard refresh will show clean state
      router.replace("/", { scroll: false });
    } catch {
      setError("Failed to load conversation");
    } finally {
      // Phase 28: UXP-02 — always clear loading state
      setIsLoadingConversation(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // CHANGE 4-D: clear substitutionMap on startOver
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
    // Phase 20: clear substitution map
    setSubstitutionMap(null);
    // Phase 21: clear mapping loading state
    setIsMappingLoading(false);
    // Phase 27: clear conversation state
    setConversationId(null);
    conversationIdRef.current = null;
    isFirstMessageRef.current = true;
    // Phase 27: clear stored preset path
    setStoredPresetPath(null);
    // Phase 28: clear resume state
    setIsResumingConversation(false);
    // Phase 28: clear sign-in banner on new chat
    setShowSignInBanner(false);
  }

  // Phase 21: standalone mapping helper — called after callVision() and on device change.
  // Non-fatal: if /api/map fails, vision result is preserved and Generate still works.
  async function callMap(rigIntentData: NonNullable<typeof rigIntent>) {
    setIsMappingLoading(true);
    setSubstitutionMap(null);
    try {
      const mapRes = await fetch("/api/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rigIntent: rigIntentData,
          device: selectedDevice,
        }),
      });
      if (mapRes.ok) {
        const mapData = await mapRes.json();
        if (mapData.substitutionMap) {
          setSubstitutionMap(mapData.substitutionMap);
        }
      }
      // Mapping failure is non-fatal: SubstitutionCard simply doesn't show.
    } catch {
      // Non-fatal — silently continue.
    } finally {
      setIsMappingLoading(false);
    }
  }

  async function callVision() {
    if (rigImages.length === 0) return;
    setIsVisionLoading(true);
    setVisionError(null);
    setRigIntent(null);
    setSubstitutionMap(null); // Clear stale map on re-analyze

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

      // Phase 21: End the vision phase label before mapping begins.
      // This allows "Mapping to Helix models…" to show as a distinct second phase (SC-5).
      setIsVisionLoading(false);

      // Phase 21: Automatically chain into /api/map. Non-fatal — vision result is preserved
      // even if mapping fails. isMappingLoading takes over the loading indicator.
      await callMap(data.rigIntent);
    } catch (err) {
      setVisionError(
        err instanceof Error ? err.message : "Vision extraction failed"
      );
      setIsVisionLoading(false);
    }
  }

  return (
    <div className="relative z-10 flex flex-col h-screen max-w-5xl mx-auto">
      {/* Hidden file input — always in DOM so rigFileInputRef is never null */}
      <input
        ref={rigFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          setRigImages(files.slice(0, 3));
          setRigIntent(null);
          setVisionError(null);
          if (rigFileInputRef.current) rigFileInputRef.current.value = "";
        }}
      />
      {/* --- Header --- */}
      <header className="flex items-center justify-between px-6 py-3.5">
        {/* Left: compact logo + wordmark — only visible in chat mode */}
        <div className="flex items-center gap-2.5">
          {messages.length > 0 && (
            <>
              <Image
                src="/logo.jpg"
                alt="HelixAI"
                width={26}
                height={26}
                className="rounded-md opacity-90"
              />
              <span
                className="text-[0.85rem] font-medium text-[var(--hlx-text-sub)]"
                style={{ letterSpacing: "0.18em" }}
              >
                helix ai
              </span>
            </>
          )}
          {premiumKey && (
            <span className="hlx-pro">
              <span className="hlx-led hlx-led-warm" style={{ width: 4, height: 4 }} />
              Pro
            </span>
          )}
        </div>

        {/* Right: New Session */}
        <div className="flex">
          {messages.length > 0 && (
            <button
              onClick={startOver}
              className="text-xs text-[var(--hlx-text-muted)] hover:text-[var(--hlx-text-sub)] transition-colors px-3 py-1.5 rounded-lg border border-[var(--hlx-border)] hover:border-[var(--hlx-border-warm)] hover:bg-[var(--hlx-surface)]"
            >
              New Session
            </button>
          )}
        </div>
      </header>

      <div className="hlx-rack" />

      {/* --- Messages --- */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isLoadingConversation ? (
          /* Phase 28: UXP-02 — conversation resume loading state */
          <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16">
            <svg className="hlx-spin h-5 w-5 text-[var(--hlx-amber)]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-[0.8125rem] text-[var(--hlx-text-muted)]">Loading conversation&hellip;</p>
          </div>
        ) : messages.length === 0 ? (
          /* --- Welcome Screen --- */
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
                    alt="HelixAI"
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
                  helix ai
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

            {/* Inline input form — centered, matches card grid width */}
            <form onSubmit={sendMessage} className="flex gap-2 items-end w-full max-w-2xl">
              {/* Camera button */}
              <button
                type="button"
                title="Analyze my pedal rig"
                onClick={() => rigFileInputRef.current?.click()}
                className={`relative flex-shrink-0 w-[44px] h-[44px] rounded-[11px] border flex items-center justify-center transition-all ${
                  rigIntent
                    ? "border-[var(--hlx-amber)] bg-[rgba(240,144,10,0.08)] text-[var(--hlx-amber)]"
                    : rigImages.length > 0
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
                {rigImages.length > 0 && !isVisionLoading && !rigIntent && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[var(--hlx-amber)] rounded-full text-[9px] text-[var(--hlx-void)] flex items-center justify-center font-bold leading-none">
                    {rigImages.length}
                  </span>
                )}
              </button>

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

              {rigImages.length > 0 && !rigIntent && !isVisionLoading && (
                <button
                  type="button"
                  onClick={callVision}
                  className="flex-shrink-0 h-[44px] px-3 rounded-[11px] border border-[var(--hlx-amber)] bg-[rgba(240,144,10,0.06)] text-[var(--hlx-amber)] text-[0.8125rem] font-semibold transition-all hover:bg-[rgba(240,144,10,0.12)] whitespace-nowrap"
                >
                  Analyze
                </button>
              )}

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

            {/* Suggestion cards — 2×3 grid */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-2xl">
              {[
                "Mark Knopfler\u2019s Sultans of Swing tone",
                "SRV Texas blues crunch",
                "Modern worship ambient clean",
                "80s new wave jangly clean",
                "Metallica Black Album rhythm",
                "Edge of U2 dotted-eighth delays",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="text-left p-4 rounded-xl border border-[var(--hlx-border)] bg-[var(--hlx-surface)] text-[0.8rem] leading-snug text-[var(--hlx-text-sub)] hover:border-[rgba(240,144,10,0.22)] hover:bg-[var(--hlx-elevated)] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.35)] transition-all duration-200"
                  style={{ fontFamily: "var(--font-mono), monospace" }}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* --- Rig analysis results (Phase 23: shown after camera upload + analyze) --- */}
            {(isVisionLoading || rigIntent || visionError) && (
              <div className="w-full max-w-xl space-y-3 text-left">

                {/* Vision loading */}
                {isVisionLoading && (
                  <div className="flex items-center gap-2 text-[0.8125rem] text-[var(--hlx-text-muted)]">
                    <svg className="hlx-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing rig photos&hellip;
                  </div>
                )}

                {/* Vision error */}
                {visionError && (
                  <div className="text-[0.8125rem] text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2">
                    {visionError}
                  </div>
                )}

                {/* Per-pedal detection badges */}
                {rigIntent && (
                  <div className="space-y-1.5">
                    {rigIntent.pedals.map((pedal, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2.5 rounded-lg border border-[var(--hlx-border)] bg-[var(--hlx-elevated)] px-3 py-2"
                      >
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${
                            pedal.confidence === "high"
                              ? "bg-green-950/40 text-green-400 border border-green-900/30"
                              : pedal.confidence === "medium"
                              ? "bg-yellow-950/40 text-yellow-400 border border-yellow-900/30"
                              : "bg-red-950/40 text-red-400 border border-red-900/30"
                          }`}
                        >
                          {pedal.confidence}
                        </span>
                        <p className="text-[0.8125rem] text-[var(--hlx-text)] truncate flex-1 min-w-0">
                          {pedal.fullName || "(unidentified pedal)"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mapping loading */}
                {isMappingLoading && (
                  <div className="flex items-center gap-2 text-[0.8125rem] text-[var(--hlx-text-muted)]">
                    <svg className="hlx-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Mapping to Helix models&hellip;
                  </div>
                )}

                {/* Substitution map + device picker CTA */}
                {substitutionMap && !isMappingLoading && (
                  <>
                    <SubstitutionCard entries={substitutionMap} />
                    <div className="space-y-3 pt-2 border-t border-[var(--hlx-border)]">
                      <p className="text-[11px] text-[var(--hlx-text-muted)] uppercase tracking-widest font-semibold text-center">
                        Which device are you building for?
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { id: "helix_lt" as const, label: "LT", desc: "Helix LT" },
                          { id: "helix_floor" as const, label: "FLOOR", desc: "Helix Floor" },
                          { id: "pod_go" as const, label: "POD GO", desc: "Pod Go" },
                        ]).map(({ id, label, desc }) => (
                          <button
                            key={id}
                            disabled={isGenerating}
                            onClick={() => { setSelectedDevice(id); handleRigGenerate(id); }}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                              isGenerating && selectedDevice === id
                                ? "border-[var(--hlx-amber)] bg-[var(--hlx-elevated)] shadow-[0_0_18px_rgba(240,144,10,0.15)]"
                                : "border-[var(--hlx-border)] bg-[var(--hlx-surface)] hover:border-[var(--hlx-border-warm)] hover:bg-[var(--hlx-elevated)]"
                            }`}
                          >
                            {isGenerating && selectedDevice === id ? (
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
                      <p className="text-[11px] text-[var(--hlx-text-muted)] text-center leading-relaxed">
                        Or describe your tone in the chat below for a more tailored result
                      </p>
                    </div>
                  </>
                )}

              </div>
            )}

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

            {/* --- Phase 27: Download Stored Preset (resumed conversation) --- */}
            {/* Shown when resuming a conversation that had a preset generated previously */}
            {storedPresetPath && !generatedPreset && (
              <div className="flex flex-col items-center gap-3 py-4 max-w-sm mx-auto w-full">
                <button
                  onClick={downloadStoredPreset}
                  className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Stored Preset
                </button>
              </div>
            )}

            {/* --- Device Picker + Generate (Phase 23) --- */}
            {/* Shown after interview completes. User picks their device → generate fires. */}
            {messages.length >= 2 && !isStreaming && !generatedPreset && (
              <div className="flex flex-col items-center gap-4 py-6">
                <p className="text-[11px] text-[var(--hlx-text-muted)] uppercase tracking-widest font-semibold">
                  Which device are you building for?
                </p>
                <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
                  {([
                    { id: "helix_lt" as const, label: "LT", desc: "Helix LT" },
                    { id: "helix_floor" as const, label: "FLOOR", desc: "Helix Floor" },
                    { id: "pod_go" as const, label: "POD GO", desc: "Pod Go" },
                  ]).map(({ id, label, desc }) => (
                    <button
                      key={id}
                      disabled={isGenerating}
                      onClick={() => { setSelectedDevice(id); generatePreset(undefined, id); }}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                        isGenerating && selectedDevice === id
                          ? "border-[var(--hlx-amber)] bg-[var(--hlx-elevated)] shadow-[0_0_22px_rgba(240,144,10,0.18)]"
                          : "border-[var(--hlx-border)] bg-[var(--hlx-surface)] hover:border-[var(--hlx-border-warm)] hover:bg-[var(--hlx-elevated)] hover:shadow-[0_0_14px_rgba(240,144,10,0.07)]"
                      }`}
                    >
                      {isGenerating && selectedDevice === id ? (
                        <svg className="hlx-spin h-5 w-5 text-[var(--hlx-amber)]" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <span className="text-[13px] font-bold tracking-wider text-[var(--hlx-text)]" style={{ fontFamily: "var(--font-mono)" }}>{label}</span>
                      )}
                      <span className="text-[11px] text-[var(--hlx-text-muted)]">{desc}</span>
                    </button>
                  ))}
                </div>
                {!readyToGenerate && (
                  <p className="text-[11px] text-[var(--hlx-text-muted)] text-center">
                    Ready when you are &mdash; or keep chatting to refine the tone
                  </p>
                )}
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
                      {/* Device badge — tells user which device this preset targets */}
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border border-[var(--hlx-border)] text-[var(--hlx-text-muted)] bg-[var(--hlx-elevated)]"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {generatedPreset.device === "helix_lt" ? "LT"
                          : generatedPreset.device === "helix_floor" ? "FLOOR"
                          : "POD GO"}
                      </span>
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

            {/* Phase 28: UXP-01 — Sign-in prompt for anonymous users after preset download */}
            {showSignInBanner && (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-[var(--hlx-border-warm)] bg-[var(--hlx-elevated)] text-[0.8125rem] mx-auto max-w-2xl">
                <span className="text-[var(--hlx-text-sub)]">
                  Sign in to save this chat and come back to refine it later
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => window.dispatchEvent(new Event('helixai:before-signin'))}
                    className="text-[var(--hlx-amber)] hover:text-[var(--hlx-text)] font-medium transition-colors text-[0.8125rem]"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => setShowSignInBanner(false)}
                    className="text-[var(--hlx-text-muted)] hover:text-[var(--hlx-text-sub)] transition-colors"
                    aria-label="Dismiss"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

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

      {/* Phase 28: UXP-03 — Continuation suggestion chips after conversation resume */}
      {isResumingConversation && !isStreaming && !isGenerating && messages.length > 0 && (
        <div className="flex gap-2 flex-wrap px-6 pb-2">
          <button
            onClick={() => {
              setInput("Refine this tone")
              inputRef.current?.focus()
              setIsResumingConversation(false)
            }}
            className="px-3 py-1.5 rounded-full border border-[var(--hlx-border)] bg-[var(--hlx-surface)] text-[11px] text-[var(--hlx-text-sub)] hover:border-[var(--hlx-border-warm)] hover:bg-[var(--hlx-elevated)] transition-all"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            Refine this tone
          </button>
          <button
            onClick={() => {
              setInput("Try a different amp, keeping the same style")
              inputRef.current?.focus()
              setIsResumingConversation(false)
            }}
            className="px-3 py-1.5 rounded-full border border-[var(--hlx-border)] bg-[var(--hlx-surface)] text-[11px] text-[var(--hlx-text-sub)] hover:border-[var(--hlx-border-warm)] hover:bg-[var(--hlx-elevated)] transition-all"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            Try a different amp
          </button>
          <button
            onClick={() => {
              const otherDevice = selectedDevice === "helix_lt" ? "helix_floor"
                : selectedDevice === "helix_floor" ? "helix_lt"
                : "helix_lt"
              setSelectedDevice(otherDevice)
              generatePreset(undefined, otherDevice)
              setIsResumingConversation(false)
            }}
            className="px-3 py-1.5 rounded-full border border-[var(--hlx-border)] bg-[var(--hlx-surface)] text-[11px] text-[var(--hlx-text-sub)] hover:border-[var(--hlx-border-warm)] hover:bg-[var(--hlx-elevated)] transition-all"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            Generate for {selectedDevice === "pod_go" ? "Helix LT" : selectedDevice === "helix_lt" ? "Helix Floor" : "Helix LT"}
          </button>
        </div>
      )}

      {/* --- Input Area (chat mode only) --- */}
      {messages.length > 0 && (
      <div className="px-6 pb-6 pt-2">
        <form onSubmit={sendMessage} className="flex gap-2 items-end">
          {/* Camera button — opens file picker for rig photo upload */}
          <button
            type="button"
            title="Analyze my pedal rig"
            onClick={() => rigFileInputRef.current?.click()}
            className={`relative flex-shrink-0 w-[44px] h-[44px] rounded-[11px] border flex items-center justify-center transition-all ${
              rigIntent
                ? "border-[var(--hlx-amber)] bg-[rgba(240,144,10,0.08)] text-[var(--hlx-amber)]"
                : rigImages.length > 0
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
            {rigImages.length > 0 && !isVisionLoading && !rigIntent && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[var(--hlx-amber)] rounded-full text-[9px] text-[var(--hlx-void)] flex items-center justify-center font-bold leading-none">
                {rigImages.length}
              </span>
            )}
          </button>

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

          {/* Analyze button — appears when photos are staged but not yet analyzed */}
          {rigImages.length > 0 && !rigIntent && !isVisionLoading && (
            <button
              type="button"
              onClick={callVision}
              className="flex-shrink-0 h-[44px] px-3 rounded-[11px] border border-[var(--hlx-amber)] bg-[rgba(240,144,10,0.06)] text-[var(--hlx-amber)] text-[0.8125rem] font-semibold transition-all hover:bg-[rgba(240,144,10,0.12)] whitespace-nowrap"
            >
              Analyze
            </button>
          )}

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
        <p className="text-[11px] text-[var(--hlx-text-muted)] mt-3 text-center tracking-wide" style={{ fontFamily: "var(--font-mono), monospace" }}>
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
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
