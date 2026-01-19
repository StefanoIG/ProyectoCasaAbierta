"use client"

import type { ChatState } from "./chat-container"
import { StatusBadge } from "./status-badge"

interface ChatHeaderProps {
  state: ChatState
  language?: 'es' | 'en'
}

export function ChatHeader({ state, language = 'es' }: ChatHeaderProps) {
  const title = "Cocktail AI"
  const subtitle = language === 'es' ? 'Tu bartender IA' : 'Your AI bartender'

  return (
    <div className="bg-gradient-to-r from-card/80 to-card/60 backdrop-blur-md border-b border-border/50 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="text-3xl animate-bounce-slow">🍹</div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground/80">{subtitle}</p>
        </div>
      </div>
      <StatusBadge state={state} language={language} />
    </div>
  )
}
