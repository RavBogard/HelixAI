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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
        body: JSON.stringify({ messages: newMessages }),
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
        body: JSON.stringify({ messages }),
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
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white text-sm font-bold">
            H
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">HelixAI</h1>
            <p className="text-xs text-zinc-500">Helix LT Preset Builder</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={startOver}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 rounded-md hover:bg-white/5"
          >
            New Session
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white text-2xl font-bold">
              H
            </div>
            <div>
              <h2 className="text-2xl font-semibold mb-2">Welcome to HelixAI</h2>
              <p className="text-zinc-400 max-w-md">
                Tell me what tone you&apos;re after and I&apos;ll build you a Helix LT preset.
                Describe an artist, a song, a genre, or just a vibe.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {[
                "Mark Knopfler's Sultans of Swing Alchemy tone",
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
                  className="text-sm px-3 py-2 rounded-lg border border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20 hover:bg-white/5 transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-orange-600/90 text-white"
                      : "bg-white/5 text-zinc-200"
                  }`}
                >
                  <div className={`message-content text-sm leading-relaxed ${
                    isStreaming && i === messages.length - 1 && msg.role === "assistant" ? "typing-cursor" : ""
                  }`}>
                    {msg.role === "assistant" ? (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Generate button */}
            {readyToGenerate && !generatedPreset && (
              <div className="flex justify-center py-4">
                <button
                  onClick={generatePreset}
                  disabled={isGenerating}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold rounded-xl hover:from-orange-400 hover:to-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating Preset...
                    </>
                  ) : (
                    "Generate Helix LT Preset"
                  )}
                </button>
              </div>
            )}

            {/* Generated preset display */}
            {generatedPreset && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-orange-400">Preset Generated!</h3>
                  <button
                    onClick={downloadPreset}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download .hlx
                  </button>
                </div>
                <div className="text-sm text-zinc-300 leading-relaxed message-content">
                  <ReactMarkdown>{generatedPreset.summary}</ReactMarkdown>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-6 mb-2 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="px-6 pb-6 pt-2">
        <form onSubmit={sendMessage} className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the tone you're after..."
              rows={1}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition-all"
              disabled={isStreaming}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="p-3 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl transition-colors shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </form>
        <p className="text-xs text-zinc-600 mt-2 text-center">
          HelixAI uses Gemini with Google Search to research artist rigs and build accurate presets
        </p>
      </div>
    </div>
  );
}
