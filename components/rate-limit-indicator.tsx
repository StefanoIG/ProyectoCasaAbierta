"use client"

import { Clock } from "lucide-react"

interface RateLimitIndicatorProps {
  language?: 'es' | 'en'
}

export function RateLimitIndicator({ language = 'es' }: RateLimitIndicatorProps) {
  const text = language === 'es' 
    ? 'Esperando para evitar límite de API...' 
    : 'Waiting to avoid API rate limit...'
  
  return (
    <div className="flex gap-3 justify-start animate-slide-up">
      <div className="flex flex-col gap-2 max-w-xs sm:max-w-md">
        <div className="px-4 py-3 rounded-2xl rounded-bl-none bg-orange-500/10 backdrop-blur-sm border border-orange-500/30 flex items-center gap-3 shadow-md">
          <Clock className="w-5 h-5 text-orange-500 animate-pulse" />
          <span className="text-sm text-orange-500 font-medium">{text}</span>
        </div>
      </div>
    </div>
  )
}
