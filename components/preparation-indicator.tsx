"use client"

interface PreparationIndicatorProps {
  language?: 'es' | 'en'
}

export function PreparationIndicator({ language = 'es' }: PreparationIndicatorProps) {
  const text = language === 'es' ? 'Preparando tu coctel...' : 'Preparing your cocktail...'
  
  return (
    <div className="flex gap-3 justify-start animate-slide-up">
      <div className="flex flex-col gap-2 max-w-xs sm:max-w-md">
        <div className="px-4 py-3 rounded-2xl rounded-bl-none bg-card/80 backdrop-blur-sm border border-primary/30 flex items-center gap-3 shadow-md">
          <span className="animate-spin text-xl">⚙️</span>
          <span className="text-sm text-muted-foreground">{text}</span>
        </div>
      </div>
    </div>
  )
}
