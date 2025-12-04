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

    try {
      // Preparar historial para enviar al API
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      // Call the Gemini API through our route
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          message: content,
          conversationHistory: conversationHistory
        }),
      })

      if (!response.ok) {
        throw new Error("Error en la respuesta del servidor")
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.text || "No se pudo procesar la respuesta",
        timestamp: new Date(),
      }
      addMessage(assistantMessage)

      // Si hay que preparar un cóctel
      if (data.shouldPrepare && data.raspberryPayload) {
        setState("preparing")

        // Log del payload (simulación hasta que Raspberry esté disponible)
        console.log("🍹 INICIANDO PREPARACIÓN:", data.raspberryPayload)

        // Simular tiempo de preparación
        setTimeout(() => {
          setState("ready")
        }, 3000)
      }
    } catch (error) {
      console.error("Error:", error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Lo siento, hubo un error procesando tu solicitud. Intenta de nuevo.",
        timestamp: new Date(),
      }
      addMessage(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl h-full max-h-screen flex flex-col bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
      <ChatHeader state={state} />

      <ChatMessages messages={messages} isLoading={isLoading} state={state} />

      <ChatInput onSendMessage={handleSendMessage} isDisabled={state === "preparing" || isLoading} />
    </div>
  )
}
