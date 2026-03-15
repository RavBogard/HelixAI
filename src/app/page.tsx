"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Footer } from "@/components/Footer";
import { DonationCard } from "@/components/DonationCard";
import { DevicePicker, DEVICE_OPTIONS, DEVICE_LABELS, type DeviceId } from "@/components/DevicePicker";
import { ChatMessage, type Message } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { SuggestionChips } from "@/components/chat/SuggestionChips";
import { PresetCard, SubstitutionCard, type PresetCardData, type SubstitutionEntryDisplay } from "@/components/PresetCard";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { usePresetAutoSave } from "@/lib/visualizer/use-preset-auto-save";

function HomeContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<string | null>(null);
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  // CHANGE 4-B: add substitutionMap? to generatedPreset state type
  const [generatedPreset, setGeneratedPreset] = useState<PresetCardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [premiumKey, setPremiumKey] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceId>("helix_lt");
  // Phase 66: device lock state — true after device is chosen for a conversation (lock-in UX)
  const [deviceLocked, setDeviceLocked] = useState(false);
  // Phase 66: needs-picker state — true when resuming a legacy conversation with null/empty device (FRONT-04)
  const [needsDevicePicker, setNeedsDevicePicker] = useState(false);
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
  const [substitutionMap, setSubstitutionMap] = useState<SubstitutionEntryDisplay[] | null>(null);
  // Phase 21: mapping loading state — true while /api/map is in flight
  const [isMappingLoading, setIsMappingLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Bug sweep #17: AbortController for SSE stream — abort on unmount or startOver
  const abortRef = useRef<AbortController | null>(null);
  // Phase 23: rig file input ref — camera button in prompt bar
  const rigFileInputRef = useRef<HTMLInputElement>(null);

  // Phase 27: Conversation persistence state
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  
  // Phase 16: Live sync visualizer dragging state to Supabase
  usePresetAutoSave(conversationId);
  
  const isFirstMessageRef = useRef(true);
  // Phase 27: stored preset path from resumed conversation (STORE-02)
  const [storedPresetPath, setStoredPresetPath] = useState<string | null>(null);

  // Phase 28: resume UX state
  const [isResumingConversation, setIsResumingConversation] = useState(false)
  // Phase 28: UXP-01 — sign-in banner state
  const [showSignInBanner, setShowSignInBanner] = useState(false)
  const [showDonation, setShowDonation] = useState(false)
  const [donationDismissed, setDonationDismissed] = useState(false)
  // Phase 9.1: Acoustic Empathy Toggle
  const [acousticEmpathyEnabled, setAcousticEmpathyEnabled] = useState(false)
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
      // One-time migration: carry forward any pre_oauth_state saved under the old key
      const legacyOauthState = sessionStorage.getItem('helixai_pre_oauth_state')
      if (legacyOauthState) {
        sessionStorage.setItem('helixtones_pre_oauth_state', legacyOauthState)
        sessionStorage.removeItem('helixai_pre_oauth_state')
      }
      const preserved = sessionStorage.getItem('helixtones_pre_oauth_state')
      if (preserved) {
        try {
          const parsed = JSON.parse(preserved)
          // Discard if older than 10 minutes
          if (parsed.timestamp && Date.now() - parsed.timestamp < 10 * 60 * 1000) {
            if (parsed.messages?.length > 0) setMessages(parsed.messages)
            if (parsed.device) setSelectedDevice(parsed.device)
          }
        } catch { /* corrupt state — ignore */ }
        sessionStorage.removeItem('helixtones_pre_oauth_state')
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

  // Phase 21: Re-run /api/map when the user changes device after vision extraction.
  // Ensures SubstitutionCard shows device-appropriate model names (Pod Go vs Helix LT).
  // callMap reads selectedDevice from closure at call time — safe because this effect
  // only fires when selectedDevice changes, so the closure value is always current.
  useEffect(() => {
    if (rigIntent) {
      callMap(rigIntent, selectedDevice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice, rigIntent]);

  // Phase 25: Serialize chat state to sessionStorage before OAuth redirect.
  // Called by AuthButton (Plan 02) before triggering OAuth redirect.
  const serializeChatState = useCallback(() => {
    sessionStorage.setItem('helixtones_pre_oauth_state', JSON.stringify({
      messages,
      device: selectedDevice,
      timestamp: Date.now(),
    }))
  }, [messages, selectedDevice])

  // Phase 25: Listen for AuthButton's pre-sign-in event (event-based decoupling
  // avoids React Context — AuthButton lives in layout.tsx, serializeChatState lives here).
  useEffect(() => {
    const handler = () => serializeChatState()
    window.addEventListener('helixtones:before-signin', handler)
    return () => window.removeEventListener('helixtones:before-signin', handler)
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
    window.addEventListener('helixtones:new-chat', handler)
    return () => window.removeEventListener('helixtones:new-chat', handler)
     
  }, []) // startOver is defined once, no deps

  // Phase 50: Listen for support button clicks from AuthButton / Footer
  useEffect(() => {
    const handler = () => setShowDonation(true)
    window.addEventListener('helixtones:show-support', handler)
    return () => window.removeEventListener('helixtones:show-support', handler)
  }, [])

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

    // Phase 66: Lock device on first message (FRONT-02)
    if (!deviceLocked) {
      setDeviceLocked(true);
    }

    // Add empty assistant message for streaming
    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMessage]);

    // Bug sweep #17: abort any in-flight SSE stream before starting a new one
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          premiumKey,
          device: selectedDevice,  // Phase 66: send device for per-family prompts (FRONT-02)
          ...(convId ? { conversationId: convId } : {}),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        let errMsg = `API error: ${res.status}`;
        try {
          const text = await res.text();
          const data = JSON.parse(text);
          if (data.error) errMsg = data.error;
          if (data.details) errMsg += "\n" + JSON.stringify(data.details, null, 2);
        } catch (_) {
          // Fallback to strict status string if body isn't JSON or readable
        }
        throw new Error(errMsg);
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
              window.dispatchEvent(new Event('helixtones:conversation-created'));
            }
          })
          .catch(() => {
            // Title failed but conversation exists — still notify sidebar so it appears
            window.dispatchEvent(new Event('helixtones:conversation-created'));
          });
      }
    } catch (err) {
      // Bug sweep #17: suppress AbortError — user intentionally cancelled the stream
      if (err instanceof DOMException && err.name === "AbortError") return;
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
  async function generatePreset(overrideMessages?: Message[], overrideDevice?: DeviceId) {
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
        const text = await res.text();
        try {
           const parsedData = JSON.parse(text);
           throw new Error(parsedData.error || `Generation failed: ${res.status}`);
        } catch(e) {
           throw new Error(`Generation failed: ${res.status}`);
        }
      }

      // Track 18C: Consume NDJSON stream with multi-stage updates
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      
      let finalData: any = null;
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\\n");
        buffer = lines.pop() || ""; // retain incomplete line in buffer
        
        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = JSON.parse(line);
          
          if (parsed.error) {
              throw new Error(parsed.error);
          } else if (parsed.type === "status") {
              setGenerationPhase(parsed.message);
          } else if (parsed.type === "result") {
              finalData = parsed.payload;
          }
        }
      }

      // Handle any trailing structured data
      if (buffer.trim()) {
         try {
             const parsed = JSON.parse(buffer);
             if (parsed.type === "result") finalData = parsed.payload;
         } catch(e) {}
      }

      if (!finalData) throw new Error("Server closed connection without sending result payload.");

      setGenerationPhase(null);
      const data = finalData;
      setGeneratedPreset(data);
      // Phase 20: store substitution map from generate response
      if (data.substitutionMap) {
        setSubstitutionMap(data.substitutionMap);
      }

      // Phase 30: persist messages for generate-only flow (SAVE-02)
      // /api/generate does not save messages — only /api/chat does.
      // Save user message + generate summary as assistant message so the
      // conversation has content when the user returns.
      if (convId) {
        const msgsToSave = overrideMessages ?? messages;
        const lastUserMsg = msgsToSave[msgsToSave.length - 1];

        // Save user message — fire-and-forget
        if (lastUserMsg?.role === "user") {
          fetch(`/api/conversations/${convId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "user", content: lastUserMsg.content }),
          }).catch(() => {}); // Non-fatal
        }

        // Save assistant summary as message — fire-and-forget
        if (data.summary) {
          fetch(`/api/conversations/${convId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "assistant", content: data.summary }),
          }).catch(() => {}); // Non-fatal
        }

        // Phase 30: auto-title and notify sidebar for generate-only conversations
        if (isFirstMessageRef.current) {
          isFirstMessageRef.current = false;
          const title = lastUserMsg?.content?.split(" ").slice(0, 7).join(" ") || "Tone Generation";
          fetch(`/api/conversations/${convId}/title`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
          })
            .then((res) => {
              if (res.ok) {
                window.dispatchEvent(new Event('helixtones:conversation-created'));
              }
            })
            .catch(() => {
              window.dispatchEvent(new Event('helixtones:conversation-created'));
            });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setError(message);
    } finally {
      setIsGenerating(false);
      setGenerationPhase(null);
    }
  }

  // handleRigGenerate — called from the welcome screen "Build Rig Preset" button.
  // Injects a synthetic user message so the /api/generate route's messages.length > 0
  // guard passes, then calls generatePreset() with the local message list before React
  // flushes state. Switches the UI to the chat flow by setting messages state.
  async function handleRigGenerate(overrideDevice?: DeviceId) {
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
    // Stadium .hsp files require an 8-byte ASCII magic header ("rpshnosj") before JSON content.
    // Without it, Helix Stadium rejects the file with "Failed to import preset".
    const isStadiumFile = generatedPreset.fileExtension === ".hsp";
    // All preset files use octet-stream to prevent browsers from overriding
    // the extension (e.g. Chrome changes .pgp to .json when type is application/json)
    const blob = isStadiumFile
      ? new Blob(["rpshnosj", json], { type: "application/octet-stream" })
      : new Blob([json], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const baseName = generatedPreset.spec?.name || "HelixTones_Preset";
    const ext = generatedPreset.fileExtension || ".hlx";
    // Include device in filename so users can spot a mismatch before importing
    const deviceSuffix =
      generatedPreset.device === "helix_lt" ? "_LT"
      : generatedPreset.device === "helix_floor" ? "_Floor"
      : generatedPreset.device === "pod_go" ? "_PodGo"
      : generatedPreset.device === "helix_stadium" ? "_Stadium"
      : generatedPreset.device === "helix_stomp" ? "_Stomp"
      : generatedPreset.device === "helix_stomp_xl" ? "_StompXL"
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

    // Phase 50: show donation card after first download (once per session)
    if (!donationDismissed) {
      setShowDonation(true)
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
      const ext = storedPresetPath.endsWith(".hsp") ? ".hsp"
        : storedPresetPath.endsWith(".pgp") ? ".pgp"
        : ".hlx";
      const deviceSuffix =
        selectedDevice === "helix_lt" ? "_LT"
        : selectedDevice === "helix_floor" ? "_Floor"
        : selectedDevice === "pod_go" ? "_PodGo"
        : selectedDevice === "helix_stadium" ? "_Stadium"
        : selectedDevice === "helix_stomp" ? "_Stomp"
        : selectedDevice === "helix_stomp_xl" ? "_StompXL"
        : "";
      const filename = `HelixTones_Preset${deviceSuffix}${ext}`;

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

      // Restore device — null-safe (FRONT-04): legacy rows have null/empty device
      if (data.device) {
        setSelectedDevice(data.device as DeviceId);
        setDeviceLocked(true);   // Resumed conversation = device already chosen
        setNeedsDevicePicker(false);
      } else {
        // Legacy row — show picker instead of silently defaulting to helix_lt (FRONT-04)
        setNeedsDevicePicker(true);
        setDeviceLocked(false);
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

  // CHANGE 4-D: clear substitutionMap on startOver
  function startOver() {
    // Bug sweep #17: abort any in-flight SSE stream
    abortRef.current?.abort();
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
    // Phase 66: reset device lock and picker state for new conversations
    setDeviceLocked(false);
    setNeedsDevicePicker(false);
    // Do NOT reset selectedDevice — keep last-used device pre-selected for UX convenience
  }

  // Phase 21: standalone mapping helper — called after callVision() and on device change.
  // Non-fatal: if /api/map fails, vision result is preserved and Generate still works.
  // Bug sweep #18: device param avoids stale closure over selectedDevice
  async function callMap(rigIntentData: NonNullable<typeof rigIntent>, device: DeviceId) {
    setIsMappingLoading(true);
    setSubstitutionMap(null);
    try {
      const mapRes = await fetch("/api/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rigIntent: rigIntentData,
          device,
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
      await callMap(data.rigIntent, selectedDevice);
    } catch (err) {
      setVisionError(
        err instanceof Error ? err.message : "Vision extraction failed"
      );
      setIsVisionLoading(false);
    }
  }

  // Shared handler for submitting chat from either welcome or chat input
  function handleChatSubmit() {
    if (!input.trim() || isStreaming) return;
    sendMessage();
  }

  return (
    <div className="relative z-10 flex flex-col h-screen max-w-4xl mx-auto">
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
                alt="HelixTones"
                width={26}
                height={26}
                className="rounded-md opacity-90"
              />
              <span
                className="text-[0.85rem] font-medium text-[var(--hlx-text-sub)]"
                style={{ letterSpacing: "0.18em" }}
              >
                helixtones
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
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-14">
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
          <WelcomeScreen
            selectedDevice={selectedDevice}
            onDeviceSelect={(id) => { setSelectedDevice(id); setNeedsDevicePicker(false); }}
          >
            {/* Inline input form — centered, matches card grid width */}
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={handleChatSubmit}
              onCameraClick={() => rigFileInputRef.current?.click()}
              onAnalyze={callVision}
              isStreaming={isStreaming}
              isVisionLoading={isVisionLoading}
              rigImageCount={rigImages.length}
              rigAnalyzed={!!rigIntent}
              inputRef={inputRef}
              formClassName="flex gap-2 items-end w-full max-w-2xl"
            />
            <div className="w-full max-w-2xl mt-3 flex justify-end"></div>

            {/* Suggestion cards — 2×3 grid */}
            <SuggestionChips
              onSelect={(text) => {
                setInput(text);
                inputRef.current?.focus();
              }}
            />

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
                      <DevicePicker
                        selected={selectedDevice}
                        onSelect={(id) => { setSelectedDevice(id); handleRigGenerate(id); }}
                        disabled={isGenerating}
                        showSpinner={isGenerating}
                        className="grid grid-cols-3 gap-2 w-full"
                      />
                      <p className="text-[11px] text-[var(--hlx-text-muted)] text-center leading-relaxed">
                        Or describe your tone in the chat below for a more tailored result
                      </p>
                    </div>
                  </>
                )}

              </div>
            )}
          </WelcomeScreen>
        ) : (
          /* --- Chat Flow --- */
          <div className="space-y-6" aria-live="polite" aria-atomic="false">
            {messages.map((msg, i) => (
              <ChatMessage
                key={i}
                message={msg}
                isLatest={i === messages.length - 1}
                isStreaming={isStreaming}
              />
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

            {/* --- Device Picker / Generate (Phase 66 refactor of Phase 23) --- */}
            {/* Shown after AI signals readyToGenerate — not on raw message count. */}
            {readyToGenerate && !isStreaming && !generatedPreset && (
              <div className="flex flex-col items-center gap-4 py-6">
                {needsDevicePicker ? (
                  /* Resume picker for legacy conversations with null device (FRONT-04) */
                  <>
                    <p className="text-[11px] text-[var(--hlx-text-muted)] uppercase tracking-widest font-semibold">
                      Select your device to generate
                    </p>
                    <DevicePicker
                      selected={selectedDevice}
                      onSelect={(id) => { setSelectedDevice(id); setNeedsDevicePicker(false); setDeviceLocked(true); generatePreset(undefined, id); }}
                      disabled={isGenerating}
                      showSpinner={isGenerating}
                      className="grid grid-cols-3 gap-3 w-full max-w-sm"
                    />
                  </>
                ) : (
                  /* Normal flow: device already locked — show badge + Generate button */
                  <>
                    <p className="text-[11px] text-[var(--hlx-text-muted)] uppercase tracking-widest font-semibold">
                      Generating for {DEVICE_LABELS[selectedDevice]}
                    </p>
                    <button
                      disabled={isGenerating}
                      onClick={() => generatePreset()}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl border font-semibold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                        isGenerating
                          ? "border-[var(--hlx-amber)] bg-[var(--hlx-elevated)] shadow-[0_0_22px_rgba(240,144,10,0.18)]"
                          : "border-[var(--hlx-amber)] bg-[rgba(240,144,10,0.06)] text-[var(--hlx-amber)] hover:bg-[rgba(240,144,10,0.12)]"
                      }`}
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {isGenerating ? (
                        <svg className="hlx-spin h-5 w-5 text-[var(--hlx-amber)]" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : null}
                      {isGenerating ? (generationPhase || "Generating...") : "Generate Preset"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* --- Single Preset Result --- */}
            {generatedPreset && (
              <PresetCard data={generatedPreset} onDownload={downloadPreset} />
            )}

            {/* Phase 28: UXP-01 — Sign-in prompt for anonymous users after preset download */}
            {showSignInBanner && (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-[var(--hlx-border-warm)] bg-[var(--hlx-elevated)] text-[0.8125rem] mx-auto max-w-2xl">
                <span className="text-[var(--hlx-text-sub)]">
                  Sign in to save this chat and come back to refine it later
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={async () => {
                      // Serialize chat state before OAuth redirect (same as AuthButton.handleSignIn)
                      window.dispatchEvent(new Event('helixtones:before-signin'))
                      const supabase = createSupabaseBrowserClient()
                      const { data: { user: currentUser } } = await supabase.auth.getUser()
                      const oauthOptions = {
                        provider: 'google' as const,
                        options: { redirectTo: `${window.location.origin}/auth/callback` },
                      }
                      if (currentUser?.is_anonymous) {
                        const { error } = await supabase.auth.linkIdentity(oauthOptions)
                        if (error) await supabase.auth.signInWithOAuth(oauthOptions)
                      } else {
                        await supabase.auth.signInWithOAuth(oauthOptions)
                      }
                    }}
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
                : "helix_lt" // pod_go, stadium, stomp, stomp_xl → helix_lt
              setSelectedDevice(otherDevice)
              generatePreset(undefined, otherDevice)
              setIsResumingConversation(false)
            }}
            className="px-3 py-1.5 rounded-full border border-[var(--hlx-border)] bg-[var(--hlx-surface)] text-[11px] text-[var(--hlx-text-sub)] hover:border-[var(--hlx-border-warm)] hover:bg-[var(--hlx-elevated)] transition-all"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            Generate for {selectedDevice === "helix_lt" ? "Helix Floor" : selectedDevice === "helix_floor" ? "Helix LT" : "Helix LT"}
          </button>
        </div>
      )}

      {/* --- Input Area (chat mode only) --- */}
      {messages.length > 0 && (
        <div className="hlx-input-bar">
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleChatSubmit}
            onCameraClick={() => rigFileInputRef.current?.click()}
            onAnalyze={callVision}
            isStreaming={isStreaming}
            isVisionLoading={isVisionLoading}
            rigImageCount={rigImages.length}
            rigAnalyzed={!!rigIntent}
            inputRef={inputRef}
          />
          <div className="w-full max-w-3xl mx-auto mt-3 px-6 flex justify-end"></div>
        </div>
      )}
      {/* Phase 50: Fixed donation card — triggered by Support link (header/footer) */}
      <DonationCard
        visible={showDonation}
        onDismiss={() => { setShowDonation(false); setDonationDismissed(true); }}
        fixed
      />
      <Footer />
    </div>
  );
}

// Set to true to show maintenance page instead of chat
const MAINTENANCE_MODE = false;

function MaintenancePage() {
  return (
    <div className="relative z-10 flex flex-col items-center justify-center h-screen max-w-2xl mx-auto px-6 text-center">
      <Image
        src="/logo.jpg"
        alt="HelixTones"
        width={80}
        height={80}
        className="rounded-xl mb-6 opacity-90"
      />
      <h1 className="text-2xl font-semibold text-[var(--hlx-text)] mb-3">
        We&apos;re Making Things Better
      </h1>
      <p className="text-[var(--hlx-text-sub)] text-lg leading-relaxed mb-6">
        We&apos;re reworking the preset engine to deliver even better tones
        for every device. Check back again in a few hours!
      </p>
      <div className="flex items-center gap-2 text-sm text-[var(--hlx-text-muted)]">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
        </span>
        Upgrading preset quality — back soon
      </div>
      <Footer />
    </div>
  );
}

export default function Home() {
  if (MAINTENANCE_MODE) {
    return <MaintenancePage />;
  }
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
