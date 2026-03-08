"use client";

import ReactMarkdown from "react-markdown";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatMessageProps {
  message: Message;
  isLatest: boolean;
  isStreaming: boolean;
}

export function ChatMessage({ message, isLatest, isStreaming }: ChatMessageProps) {
  return (
    <div
      role="article"
      aria-label={message.role === "assistant" ? "AI message" : "Your message"}
      className={`hlx-msg flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
    >
      {message.role === "assistant" ? (
        <div className="hlx-msg-ai max-w-[88%]">
          <div
            className={`message-content text-[var(--hlx-text-sub)] ${
              isStreaming && isLatest ? "typing-cursor" : ""
            }`}
          >
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="hlx-msg-user max-w-[80%]">
          <div className="text-[0.9375rem] leading-relaxed text-[var(--hlx-text)]">
            {message.content}
          </div>
        </div>
      )}
    </div>
  );
}
