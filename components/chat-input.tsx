"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"

interface ChatInputProps {
  onSendMessage: (message: string) => void
  isDisabled: boolean
}

export function ChatInput({ onSendMessage, isDisabled }: ChatInputProps) {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
    <form onSubmit={handleSubmit} className="border-t border-border bg-card/50 px-4 sm:px-6 py-4 flex gap-3">
      <textarea
        ref={inputRef}
        placeholder="Cuéntame qué coctel deseas..."
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        rows={1}
        className="flex-1 bg-input border border-border rounded-2xl px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-none max-h-[120px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-primary/30 hover:scrollbar-thumb-primary/50"
      />
      <button
        type="submit"
        disabled={isDisabled || !input.trim()}
        className="bg-primary text-primary-foreground px-4 py-2.5 rounded-full font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 self-end"
      >
        <span className="text-lg">→</span>
      </button>
    </form>
  )
}
