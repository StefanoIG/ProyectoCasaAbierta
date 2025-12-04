"use client"

import { ChatContainer } from "@/components/chat-container"

export default function Home() {
  return (
    <main className="h-screen w-full bg-background flex items-center justify-center p-4">
      <ChatContainer />
    </main>
  )
}
