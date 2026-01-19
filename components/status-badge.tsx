"use client"

import type { ChatState } from "./chat-container"

interface StatusBadgeProps {
  state: ChatState
  language?: 'es' | 'en'
}

export function StatusBadge({ state, language = 'es' }: StatusBadgeProps) {
  const statusConfig = {
    conversing: {
      label: language === 'es' ? "Listo" : "Ready",
      icon: "✨",
      colors: "bg-primary/20 text-primary border border-primary/50",
    },
    preparing: {
      label: language === 'es' ? "Preparando" : "Preparing",
      icon: "⏳",
      colors: "bg-orange-500/20 text-orange-500 border border-orange-500/50 animate-pulse",
    },
    ready: {
      label: language === 'es' ? "¡Listo!" : "Ready!",
      icon: "✅",
      colors: "bg-green-500/20 text-green-500 border border-green-500/50 animate-pulse",
    },
  }

  const config = statusConfig[state]

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all shadow-sm ${config.colors}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  )
}
