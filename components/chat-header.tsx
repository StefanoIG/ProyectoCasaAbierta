"use client"

import type { ChatState } from "./chat-container"
import { StatusBadge } from "./status-badge"

interface ChatHeaderProps {
  state: ChatState
}

export function ChatHeader({ state }: ChatHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-card to-card/50 border-b border-border px-4 sm:px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="text-2xl">🍹</div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground">Cocktail AI</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Tu bartender IA</p>
        </div>
      </div>
      <StatusBadge state={state} />
    </div>
  )
}
