"use client"

import { useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

interface ConfirmButtonProps {
  cocktailId: string
  cocktailName: string
  onConfirm: (cocktailId: string) => void
  isDisabled?: boolean
  language?: 'es' | 'en'
}

export function ConfirmButton({ 
  cocktailId, 
  cocktailName, 
  onConfirm, 
  isDisabled = false,
  language = 'es' 
}: ConfirmButtonProps) {
  const [isClicked, setIsClicked] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleClick = async () => {
    if (isClicked || isDisabled || isProcessing) return

    setIsClicked(true)
    setIsProcessing(true)

    // Pequeña demora para feedback visual
    await new Promise(resolve => setTimeout(resolve, 300))

    onConfirm(cocktailId)
    
    // Mantener estado de procesamiento
    setTimeout(() => {
      setIsProcessing(false)
    }, 1000)
  }

  const buttonText = language === 'es' 
    ? isProcessing ? 'Preparando...' : isClicked ? 'Confirmado' : `Confirmar ${cocktailName}`
    : isProcessing ? 'Preparing...' : isClicked ? 'Confirmed' : `Confirm ${cocktailName}`

  return (
    <button
      onClick={handleClick}
      disabled={isClicked || isDisabled || isProcessing}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
        transition-all duration-300 transform
        ${isClicked 
          ? 'bg-green-600 text-white cursor-not-allowed opacity-80' 
          : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95'
        }
        ${isDisabled && !isClicked ? 'opacity-50 cursor-not-allowed' : ''}
        ${isProcessing ? 'cursor-wait' : ''}
        disabled:cursor-not-allowed
      `}
      style={{
        boxShadow: isClicked 
          ? '0 0 20px rgba(34, 197, 94, 0.4)' 
          : '0 4px 12px rgba(0, 0, 0, 0.15)'
      }}
    >
      {isProcessing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isClicked ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <span className="text-lg">🍹</span>
      )}
      <span>{buttonText}</span>
    </button>
  )
}
