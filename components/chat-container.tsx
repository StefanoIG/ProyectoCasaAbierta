"use client"

import { useState, useRef, useEffect } from "react"
import { ChatMessages } from "./chat-messages"
import { ChatInput } from "./chat-input"
import { ChatHeader } from "./chat-header"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export type ChatState = "conversing" | "preparing" | "ready"

export interface ChatContextType {
  messages: Message[]
  state: ChatState
  addMessage: (message: Message) => void
  setState: (state: ChatState) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hola! Soy tu asistente bartender IA. ¿Qué coctel deseas preparar hoy? 🍹",
      timestamp: new Date(),
    },
  ])
  const [state, setState] = useState<ChatState>("conversing")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message])
  }

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    }

    addMessage(userMessage)
    setIsLoading(true)

    // Simulate API delay - Replace this with your actual LLM integration
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Perfecto, estoy preparando tu bebida... 🔄",
        timestamp: new Date(),
      }
      addMessage(assistantMessage)
      setState("preparing")
      setIsLoading(false)

      // Simulate preparation completion
      setTimeout(() => {
        setState("ready")
      }, 3000)
    }, 500)
  }

  return (
    <div className="w-full max-w-2xl h-full max-h-screen flex flex-col bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
      <ChatHeader state={state} />

      <ChatMessages messages={messages} isLoading={isLoading} state={state} />

      <ChatInput onSendMessage={handleSendMessage} isDisabled={state === "preparing" || isLoading} />
    </div>
  )
}
