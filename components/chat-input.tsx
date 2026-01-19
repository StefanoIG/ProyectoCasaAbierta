"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Send } from "lucide-react"

interface ChatInputProps {
  onSendMessage: (message: string) => void
  isDisabled: boolean
  language?: 'es' | 'en'
}

export function ChatInput({ onSendMessage, isDisabled, language = 'es' }: ChatInputProps) {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const placeholder = language === 'es' 
    ? "Cuéntame qué coctel deseas..."
    : "Tell me what cocktail you'd like..."

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isDisabled) {
      onSendMessage(input.trim())
      setInput("")
      if (inputRef.current) {
        inputRef.current.style.height = "auto"
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isDisabled) {
      e.preventDefault()
      if (input.trim()) {
        onSendMessage(input.trim())
        setInput("")
        if (inputRef.current) {
          inputRef.current.style.height = "auto"
        }
      }
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setInput(newValue)
    
    // Ajustar altura del textarea automáticamente
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      const scrollHeight = inputRef.current.scrollHeight
      inputRef.current.style.height = Math.min(scrollHeight, 120) + "px"
    }
  }

  useEffect(() => {
    // Focus en el input al montar
    inputRef.current?.focus()
  }, [])

  return (
    <form onSubmit={handleSubmit} className="border-t border-border/50 bg-card/30 backdrop-blur-sm px-4 sm:px-6 py-4 flex gap-3">
      <textarea
        ref={inputRef}
        placeholder={placeholder}
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        rows={1}
        className="flex-1 bg-background/50 border border-border/60 rounded-2xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-none max-h-[120px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-primary/30 hover:scrollbar-thumb-primary/50"
      />
      <button
        type="submit"
        disabled={isDisabled || !input.trim()}
        className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground px-5 py-3 rounded-full font-semibold hover:shadow-lg hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 self-end flex items-center justify-center min-w-[48px]"
        aria-label={language === 'es' ? 'Enviar mensaje' : 'Send message'}
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
  )
}
