"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight, Globe } from "lucide-react"

export function HomePage() {
  const [language, setLanguage] = useState<'es' | 'en'>('es')

  const content = {
    es: {
      title: "Cocktail AI",
      subtitle: "Tu asistente bartender con inteligencia artificial",
      feature1: "IA Inteligente",
      feature2: "Preparación Automática",
      feature3: "Control IoT",
      cta: "Comenzar",
      footer: "Powered by Gemini AI",
    },
    en: {
      title: "Cocktail AI",
      subtitle: "Your AI-powered bartender assistant",
      feature1: "Smart AI",
      feature2: "Automatic Preparation",
      feature3: "IoT Control",
      cta: "Get Started",
      footer: "Powered by Gemini AI",
    }
  }

  const t = content[language]

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse-slow animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-slow animation-delay-1000" />
      </div>

      {/* Language Toggle */}
      <div className="absolute top-6 right-6 z-10">
        <button
          onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-full font-light transition-all text-sm"
          aria-label="Toggle language"
        >
          <Globe size={16} />
          <span>{language === 'es' ? 'EN' : 'ES'}</span>
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto text-center space-y-10">
        {/* Logo and title */}
        <div className="space-y-6 animate-fade-in">
          <div className="text-6xl md:text-7xl animate-bounce-slow">🍹</div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-light tracking-tight bg-gradient-to-r from-white via-white/90 to-white/80 bg-clip-text text-transparent">
            {t.title}
          </h1>
          <p className="text-lg md:text-xl text-white/70 font-light max-w-xl mx-auto">
            {t.subtitle}
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-8 animate-slide-up animation-delay-300">
          <div className="group p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all hover:scale-105">
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">✨</div>
            <p className="text-sm text-white/80 font-medium">{t.feature1}</p>
          </div>
          <div className="group p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all hover:scale-105">
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">⚡</div>
            <p className="text-sm text-white/80 font-medium">{t.feature2}</p>
          </div>
          <div className="group p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all hover:scale-105">
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🔧</div>
            <p className="text-sm text-white/80 font-medium">{t.feature3}</p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="animate-fade-in animation-delay-600">
          <Link
            href="/chat"
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white rounded-full font-medium text-lg transition-all hover:shadow-lg hover:shadow-primary/30 hover:scale-105 active:scale-95"
          >
            {t.cta}
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Footer text */}
        <p className="text-xs text-white/50 pt-8 animate-fade-in animation-delay-800">
          {t.footer}
        </p>
      </div>
    </main>
  )
}
