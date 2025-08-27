// apps/web/src/components/ChatPanel.tsx
import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import ReadyCard from './ReadyCard'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

type Citation = { page: number, preview: string }
type Msg = { role: 'user' | 'assistant', content: string, citations?: Citation[] }

export default function ChatPanel({
  docId,
  onJumpToPage,
}: {
  docId?: string
  onJumpToPage: (page: number) => void
}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReady, setShowReady] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Show the “ready” card when a doc first loads and chat is empty
  useEffect(() => {
    if (docId && messages.length === 0) setShowReady(true)
  }, [docId])

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, loading])

  async function ask() {
    if (!q.trim() || !docId) return
    setShowReady(false)
    const userMsg: Msg = { role: 'user', content: q }
    setMessages((m) => [...m, userMsg])
    setQ('')
    setLoading(true)
    try {
      const res = await axios.post(`${API_URL}/api/chat`, {
        docId,
        question: userMsg.content,
      })
      const { answer, citations } = res.data
      setMessages((m) => [...m, { role: 'assistant', content: answer, citations }])
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Sorry, I could not answer that. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* scroll area */}
      <div ref={scrollerRef} className="relative flex-1 overflow-auto p-4 bg-white">
        {/* Ready overlay */}
        {showReady && messages.length === 0 && (
          <div className="absolute top-2 left-2 right-2 md:right-auto md:w-[360px]">
            <ReadyCard
              onClose={() => setShowReady(false)}
              onUsePrompt={(text) => {
                setQ(text)
                inputRef.current?.focus()
              }}
            />
          </div>
        )}

        {/* messages */}
        <div className="mx-auto max-w-[720px] flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={
                  m.role === 'user'
                    ? 'inline-block max-w-[80%] px-3 py-2 rounded-2xl rounded-br-sm bg-blue-600 text-white shadow-sm'
                    : 'inline-block max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-sm bg-gray-100 text-gray-900 shadow-sm'
                }
              >
                {m.content}
                {m.citations && m.citations.length > 0 && (
                  <div className={`mt-2 flex flex-wrap gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.citations.map((c, idx) => (
                      <button
                        key={idx}
                        className="text-xs px-2 py-1 border rounded-md hover:bg-gray-100 bg-white shadow-sm"
                        title={c.preview}
                        onClick={() => onJumpToPage(c.page)}
                      >
                        Page{c.page}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border rounded-2xl px-3 py-2">
                <span className="inline-block h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
                Thinking…
              </div>
            </div>
          )}
        </div>
      </div>

      {/* sticky input */}
      <div className="p-3 border-t bg-white bottom-0">
        <div className="mx-auto max-w-[720px] flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Ask about the document..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            disabled={!docId || loading}
          />
          <button
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-2"
            onClick={ask}
            disabled={!docId || loading}
            title="Send"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
