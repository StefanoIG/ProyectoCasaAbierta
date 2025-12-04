"use client"

import type { ChatState } from "./chat-container"

interface StatusBadgeProps {
  state: ChatState
}

export function StatusBadge({ state }: StatusBadgeProps) {
  const statusConfig = {
    conversing: {
      label: "Listo",
      icon: "✨",
      colors: "bg-primary/20 text-primary border border-primary/50",
    },
    preparing: {
      label: "Preparando",
      icon: "⏳",
      colors: "bg-secondary/20 text-secondary border border-secondary/50 animate-pulse-neon",
    },
    ready: {
      label: "¡Listo!",
      icon: "✅",
      colors: "bg-primary/20 text-primary border border-primary/50 animate-pulse-neon",
    },
  }

  const config = statusConfig[state]

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${config.colors}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  )
}
