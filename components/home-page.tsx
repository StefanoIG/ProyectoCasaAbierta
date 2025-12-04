"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

export function HomePage() {
  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-slate-950 to-slate-900 text-white flex flex-col items-center justify-center p-4">
      {/* Animated background elements - muy sutiles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-64 h-64 bg-purple-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-2xl mx-auto text-center space-y-8">
        {/* Logo and title */}
        <div className="space-y-4">
          <div className="text-5xl md:text-6xl">🍹</div>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight">
            Cocktail AI
          </h1>
          <p className="text-lg text-white/60 font-light">
            Tu asistente bartender con inteligencia artificial
          </p>
        </div>

        {/* Features grid - minimalista */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-8">
          <div className="text-center">
            <div className="text-3xl mb-2">✨</div>
            <p className="text-sm text-white/70">IA Inteligente</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">⚡</div>
            <p className="text-sm text-white/70">Preparación Automática</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">🔧</div>
            <p className="text-sm text-white/70">Control IoT</p>
          </div>
        </div>

        {/* CTA Button */}
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg font-light transition-all hover:gap-3"
        >
          Comenzar
          <ChevronRight size={18} />
        </Link>

        {/* Footer text */}
        <p className="text-xs text-white/40 pt-8">
          Powered by IA
        </p>
      </div>
    </main>
  )
}
