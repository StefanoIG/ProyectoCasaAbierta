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
    // ✅ CONFIRMACIÓN DIRECTA A RASPBERRY PI - SIN IA - SIN RATE LIMIT
    setIsLoading(true)

    try {
      // Importar recetas desde pi.json
      const piConfig = await import("@/pi.json")
      
      // Buscar la receta en el array de menu por ID
      const recipeId = parseInt(cocktailId)
      const recipe = piConfig.default.menu.find((r: any) => r.id === recipeId)
      
      if (!recipe) {
        throw new Error(language === 'es' 
          ? "Receta no encontrada" 
          : "Recipe not found")
      }
      
      console.log('🍸 Receta encontrada:', recipe)

      // Mensaje de preparación
      const preparingText = language === 'es' 
        ? '¡Perfecto! Preparando tu coctel... 🍹' 
        : 'Perfect! Preparing your cocktail... 🍹'

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: preparingText,
        timestamp: new Date(),
        language
      }
      addMessage(assistantMessage)
      setState("preparing")

      // Generar payload simplificado para Raspberry Pi (solo ID)
      const payload = {
        recipe_id: recipeId
      }

      console.log('═══════════════════════════════════════')
      console.log('🍹 ENVIANDO A RASPBERRY PI')
      console.log('═══════════════════════════════════════')
      console.log('URL:', `http://${process.env.NEXT_PUBLIC_RASPBERRY_PI_HOST}:${process.env.NEXT_PUBLIC_RASPBERRY_PI_PORT}/hacer_trago`)
      console.log('Payload:', JSON.stringify(payload, null, 2))
      console.log('═══════════════════════════════════════')

      // Enviar directo a Raspberry Pi
      const raspberryUrl = `http://${process.env.NEXT_PUBLIC_RASPBERRY_PI_HOST}:${process.env.NEXT_PUBLIC_RASPBERRY_PI_PORT}/hacer_trago`
      const response = await fetch(raspberryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ Respuesta de Raspberry Pi:', result)

      // Simular tiempo de preparación (5 segundos)
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
          language
        }
        addMessage(readyMessage)
      }, 5000)

    } catch (error) {
      console.error("Error:", error)
      
      const errorText = error instanceof Error 
        ? error.message 
        : (language === 'es'
            ? "Lo siento, hubo un error preparando tu coctel. Intenta de nuevo."
            : "Sorry, there was an error preparing your cocktail. Please try again.")
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: errorText,
        timestamp: new Date(),
        language
      }
      addMessage(errorMessage)
      setState("conversing")
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
        const errorData = await response.json()
        
        // Manejar rate limit específicamente
        if (response.status === 429 && errorData.isRateLimit) {
          throw new Error(errorData.error)
        }
        
        throw new Error(errorData.error || "Error en la respuesta del servidor")
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
      
      // Obtener mensaje de error (puede venir del rate limit o error genérico)
      const errorText = error instanceof Error 
        ? error.message 
        : (language === 'es'
            ? "Lo siento, hubo un error procesando tu solicitud. Intenta de nuevo."
            : "Sorry, there was an error processing your request. Please try again.")
      
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
