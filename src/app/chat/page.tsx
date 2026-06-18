'use client'
import { useState, useRef, useEffect } from 'react'
import { useLocation } from '@/hooks/useLocation'
import Link from 'next/link'

interface Message { role: 'user' | 'assistant'; content: string }

export default function ChatPage() {
  const { location } = useLocation()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    if (!input.trim() || streaming) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setStreaming(true)

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMsg, locationContext: location, history: messages.slice(-6) }),
    })

    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      fullText += decoder.decode(value)
      setMessages(prev => { const updated = [...prev]; updated[updated.length - 1] = { role: 'assistant', content: fullText }; return updated })
    }
    setStreaming(false)
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-white">
        <Link href="/" className="text-gray-400">←</Link>
        <h1 className="text-base font-bold text-gray-900">🤖 Travel Assistant</h1>
        {location && <span className="text-xs text-gray-400 ml-auto">{location.city}</span>}
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">🗺️</p>
            <p className="text-gray-500 text-sm">Ask me anything about your surroundings.</p>
            <p className="text-gray-400 text-xs mt-1">&quot;What should I do for the next 2 hours?&quot;</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              {msg.content || (streaming && msg.role === 'assistant' ? '…' : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-4 border-t border-gray-100 bg-white flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask your travel assistant…"
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
        <button onClick={send} disabled={streaming || !input.trim()}
          className="bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-medium disabled:opacity-50">Send</button>
      </div>
    </div>
  )
}
