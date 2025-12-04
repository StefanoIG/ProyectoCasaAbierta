"use client"

import { useEffect, useRef } from "react"
import type { Message } from "./chat-container"
import { MessageBubble } from "./message-bubble"
import { PreparationIndicator } from "./preparation-indicator"
import type { ChatState } from "./chat-container"

interface ChatMessagesProps {
  messages: Message[]
  isLoading: boolean
  state: ChatState
}

export function ChatMessages({ messages, isLoading, state }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} isUser={message.role === "user"} />
      ))}

      {isLoading && state === "preparing" && <PreparationIndicator />}

      <div ref={messagesEndRef} />
    </div>
  )
}
