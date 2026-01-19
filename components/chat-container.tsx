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
  showConfirmButton?: boolean
  cocktailId?: string
  cocktailName?: string
  language?: 'es' | 'en'
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
      content: "¡Hola! 🍹 ¿Qué coctel te preparo hoy?",
      timestamp: new Date(),
      language: 'es'
    },
  ])
  const [state, setState] = useState<ChatState>("conversing")
  const [isLoading, setIsLoading] = useState(false)
  const [language, setLanguage] = useState<'es' | 'en'>('es')
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

  const handleConfirmCocktail = async (cocktailId: string) => {
    // Enviar confirmación al servidor usando el nuevo sistema
    const confirmMessage = `CONFIRM_ORDER_${cocktailId}`
    
    // Agregar mensaje de usuario (oculto visualmente)
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: confirmMessage,
      timestamp: new Date(),
      language
    }

    // No añadir el mensaje de confirmación a la UI
    setIsLoading(true)

    try {
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          message: confirmMessage,
          conversationHistory: conversationHistory,
          previousLanguage: language
        }),
      })

      if (!response.ok) {
        throw new Error("Error en la respuesta del servidor")
      }

      const data = await response.json()

      // Actualizar idioma si viene en la respuesta
      if (data.language) {
        setLanguage(data.language)
      }

      const preparingText = language === 'es' 
        ? '¡Perfecto! Preparando tu coctel... 🍹' 
        : 'Perfect! Preparing your cocktail... 🍹'

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: preparingText,
        timestamp: new Date(),
        language: data.language || language
      }
      addMessage(assistantMessage)

      if (data.shouldPrepare && data.raspberryPayload) {
        setState("preparing")
        console.log("🍹 INICIANDO PREPARACIÓN:", data.raspberryPayload)

        setTimeout(() => {
          setState("ready")
          const readyText = language === 'es'
            ? '✅ ¡Tu coctel está listo! Disfrútalo.'
            : '✅ Your cocktail is ready! Enjoy.'
          
          const readyMessage: Message = {
            id: (Date.now() + 2).toString(),
            role: "assistant",
            content: readyText,
            timestamp: new Date(),
            language: data.language || language
          }
          addMessage(readyMessage)
        }, 5000)
      }
    } catch (error) {
      console.error("Error:", error)
      const errorText = language === 'es'
        ? "Lo siento, hubo un error preparando tu coctel. Intenta de nuevo."
        : "Sorry, there was an error preparing your cocktail. Please try again."
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: errorText,
        timestamp: new Date(),
        language
      }
      addMessage(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
      language
    }

    addMessage(userMessage)
    setIsLoading(true)

    try {
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          message: content,
          conversationHistory: conversationHistory,
          previousLanguage: language
        }),
      })

      if (!response.ok) {
        throw new Error("Error en la respuesta del servidor")
      }

      const data = await response.json()

      // Actualizar idioma si viene en la respuesta
      if (data.language) {
        setLanguage(data.language)
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.text || "No se pudo procesar la respuesta",
        timestamp: new Date(),
        showConfirmButton: data.showConfirmButton,
        cocktailId: data.cocktailId,
        cocktailName: data.recipe?.name,
        language: data.language || language
      }
      addMessage(assistantMessage)

    } catch (error) {
      console.error("Error:", error)
      const errorText = language === 'es'
        ? "Lo siento, hubo un error procesando tu solicitud. Intenta de nuevo."
        : "Sorry, there was an error processing your request. Please try again."
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: errorText,
        timestamp: new Date(),
        language
      }
      addMessage(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-3xl h-full max-h-[90vh] flex flex-col bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
      <ChatHeader state={state} language={language} />

      <ChatMessages 
        messages={messages} 
        isLoading={isLoading} 
        state={state} 
        onConfirmCocktail={handleConfirmCocktail}
        language={language}
      />

      <ChatInput 
        onSendMessage={handleSendMessage} 
        isDisabled={state === "preparing" || isLoading} 
        language={language}
      />
    </div>
  )
}
