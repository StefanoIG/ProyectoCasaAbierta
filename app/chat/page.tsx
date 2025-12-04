"use client"

import Link from "next/link"
import { ChatContainer } from "@/components/chat-container"
import { ArrowLeft } from "lucide-react"

export default function ChatPage() {
  return (
    <main className="h-screen w-full bg-background flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 left-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Volver</span>
        </Link>
      </div>
      <ChatContainer />
    </main>
  )
}
