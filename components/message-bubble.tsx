"use client"

import type { Message } from "./chat-container"
import { parseMarkdown } from "@/lib/markdown"

interface MessageBubbleProps {
  message: Message
  isUser: boolean
}

export function MessageBubble({ message, isUser }: MessageBubbleProps) {
  const parsedContent = parseMarkdown(message.content)

  return (
    <div className={`flex gap-3 animate-slide-up ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex flex-col gap-1 max-w-xs sm:max-w-md ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm sm:text-base leading-relaxed ${
            isUser
              ? "bg-primary text-primary-foreground rounded-br-none"
              : "bg-card border border-primary/30 text-foreground rounded-bl-none"
          }`}
        >
          {parsedContent}
        </div>
        <span className="text-xs text-muted-foreground px-2">
          {message.timestamp.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  )
}
