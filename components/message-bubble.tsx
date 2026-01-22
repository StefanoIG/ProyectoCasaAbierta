"use client"

import type { Message } from "./chat-container"
import { parseMarkdown } from "@/lib/markdown"
import { ConfirmButton } from "./confirm-button"
import { X } from "lucide-react"
import { useState } from "react"

interface MessageBubbleProps {
  message: Message
  isUser: boolean
  onConfirmCocktail?: (cocktailId: string) => void
  isLoading?: boolean
}

export function MessageBubble({ message, isUser, onConfirmCocktail, isLoading = false }: MessageBubbleProps) {
  const parsedContent = parseMarkdown(message.content)
  const [isCancelled, setIsCancelled] = useState(false)

  const handleCancel = () => {
    if (isLoading) return // No permitir cancelar durante preparación
    setIsCancelled(true)
  }

  return (
    <div className={`flex gap-3 animate-slide-up ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex flex-col gap-2 max-w-xs sm:max-w-md lg:max-w-lg ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm sm:text-base leading-relaxed shadow-md ${
            isUser
              ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-none"
              : "bg-card/80 backdrop-blur-sm border border-primary/20 text-foreground rounded-bl-none"
          }`}
        >
          {parsedContent}
        </div>
        
        {/* Botones de confirmación/cancelación si está disponible */}
        {message.showConfirmButton && message.cocktailId && message.cocktailName && onConfirmCocktail && !isCancelled && (
          <div className="flex gap-2 mt-1 animate-slide-up">
            <ConfirmButton
              cocktailId={message.cocktailId}
              cocktailName={message.cocktailName}
              onConfirm={onConfirmCocktail}
              language={message.language}
            />
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-red-600/20 text-red-400 border border-red-600/30 transition-all ${
                isLoading 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:bg-red-600/30 hover:border-red-600/50'
              }`}
              aria-label={message.language === 'es' ? 'Cancelar' : 'Cancel'}
            >
              <X className="w-4 h-4" />
              <span>{message.language === 'es' ? 'Cancelar' : 'Cancel'}</span>
            </button>
          </div>
        )}

        {isCancelled && message.showConfirmButton && (
          <div className="text-xs text-muted-foreground/70 px-2 italic">
            {message.language === 'es' ? 'Pedido cancelado' : 'Order cancelled'}
          </div>
        )}
        
        <span className="text-xs text-muted-foreground/70 px-2">
          {message.timestamp.toLocaleTimeString(message.language === 'en' ? 'en-US' : 'es-ES', {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  )
}
