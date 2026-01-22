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
  onConfirmCocktail: (cocktailId: string) => void
  language?: 'es' | 'en'
}

export function ChatMessages({ messages, isLoading, state, onConfirmCocktail, language = 'es' }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4 scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent hover:scrollbar-thumb-primary/50">
      {messages.map((message) => (
        <MessageBubble 
          key={message.id} 
          message={message} 
          isUser={message.role === "user"} 
          onConfirmCocktail={onConfirmCocktail}
          isLoading={isLoading || state === "preparing"}
        />
      ))}

      {isLoading && state === "preparing" && <PreparationIndicator language={language} />}

      <div ref={messagesEndRef} />
    </div>
  )
}
