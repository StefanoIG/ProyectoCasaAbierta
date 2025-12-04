"use client"

export function PreparationIndicator() {
  return (
    <div className="flex gap-3 justify-start animate-slide-up">
      <div className="flex flex-col gap-2 max-w-xs sm:max-w-md">
        <div className="px-4 py-3 rounded-2xl rounded-bl-none bg-card border border-primary/30 flex items-center gap-3">
          <span className="animate-rotate-smooth text-xl">⚙️</span>
          <span className="text-sm text-muted-foreground">Preparando tu coctel...</span>
        </div>
      </div>
    </div>
  )
}
