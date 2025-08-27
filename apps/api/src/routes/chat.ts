// apps/api/src/routes/chat.ts
import type { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import OpenAI from 'openai'
import { askWithFileSearch } from '../lib/openai-file-search'

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

type PageRec = { page: number; text: string }
type DocJson = { pages: (string | PageRec)[] } | (string | PageRec)[]

function tokens(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}
function limit(str: string, n: number) {
  return str && str.length > n ? str.slice(0, n) + ' …' : (str || '')
}

/** Rank local pages so we can show pN chips reliably */
function rankPages(pages: PageRec[], question: string, k = 3) {
  const qTokens = tokens(question)
  const N = pages.length
  const df: Record<string, number> = {}
  for (const p of pages) {
    const set = new Set(tokens(p.text))
    for (const t of qTokens) if (set.has(t)) df[t] = (df[t] || 0) + 1
  }
  return pages
    .map(p => {
      const tf: Record<string, number> = {}
      for (const t of tokens(p.text)) tf[t] = (tf[t] || 0) + 1
      let score = 0
      for (const t of qTokens) {
        const idf = Math.log((N + 1) / ((df[t] || 0) + 1)) + 1
        score += (tf[t] || 0) * idf
      }
      return { ...p, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
}

function buildMessages(question: string, top: PageRec[]) {
  const sources = top.map(p => `Page ${p.page}:\n"""${limit(p.text, 4000)}"""`).join('\n\n')
  return [
    {
      role: 'system' as const,
      content:
        'Answer strictly from the provided pages. Add inline [pX] citations next to claims.',
    },
    {
      role: 'user' as const,
      content: `Question: ${question}\n\nRelevant pages:\n${sources}\n\nWrite a clear answer with inline [pX] citations.`,
    },
  ]
}

export function chatHandler(UPLOAD_DIR: string) {
  return async function (req: Request, res: Response) {
    try {
      const { docId, question } = req.body || {}
      if (!docId || !question) return res.status(400).json({ error: 'Missing docId or question' })

      // 1) Load local per-page JSON (so we can rank pages + show pN chips)
      const jsonPath = path.join(UPLOAD_DIR, `${docId}.json`)
      if (!fs.existsSync(jsonPath)) {
        return res.status(404).json({ error: 'Document JSON not found', jsonPath })
      }

      const rawText = fs.readFileSync(jsonPath, 'utf8')
      let raw: DocJson
      try { raw = JSON.parse(rawText) } catch (e: any) {
        return res.status(400).json({ error: 'Invalid JSON file', jsonPath, detail: String(e?.message || e) })
      }

      const arr: (string | PageRec)[] =
        Array.isArray((raw as any).pages) ? (raw as any).pages :
        Array.isArray(raw) ? (raw as any) : []

      if (!Array.isArray(arr) || arr.length === 0) {
        return res.status(400).json({ error: 'No pages found in JSON', jsonPath })
      }

      const pages: PageRec[] = arr.map((p: any, i: number) =>
        typeof p === 'string' ? { page: i + 1, text: p } : { page: Number(p.page || i + 1), text: String(p.text || '') }
      )

      // 2) Rank for citations (always)
      const top = rankPages(pages, question, 3)
      const citations = top.map(p => ({ page: p.page, preview: limit(p.text, 160) }))

      // 3) Decide answering path
      const useFileSearch = process.env.USE_FILE_SEARCH === '1'

      // — A) File Search path (recommended)
      if (useFileSearch && process.env.OPENAI_API_KEY) {
        try {
          const result = await askWithFileSearch({ docId, uploadsDir: UPLOAD_DIR, question })
          // Answer from File Search; citations from our local ranker (clickable pages)
          return res.json({ answer: result.answer, citations })
        } catch (err: any) {
          console.error('FileSearch error:', err?.status || '', err?.code || '', err?.response?.data || err)
          // fall through to LLM/local or extractive
        }
      }

      // — B) Local pages + LLM (your previous behavior)
      if (client) {
        try {
          const messages = buildMessages(question, top)
          const completion = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            messages,
          })
          const answer =
            completion?.choices?.[0]?.message?.content?.trim() ||
            (top.length ? `Based on the document:\n${top.map(p => `• [p${p.page}] ${limit(p.text, 240)}`).join('\n')}` : 'Sorry, I could not find relevant content.')
          return res.json({ answer, citations })
        } catch (llmErr: any) {
          console.error('OpenAI error:', llmErr?.status || '', llmErr?.code || '', llmErr?.response?.data || llmErr)
          // continue to extractive fallback
        }
      }

      // — C) Extractive fallback (never 500)
      const answer = top.length
        ? `Based on the document:\n${top.map(p => `• [p${p.page}] ${limit(p.text, 240)}`).join('\n')}\n\n(LLM unavailable; extractive result.)`
        : 'Sorry, I could not find relevant content in the document.'
      return res.json({ answer, citations })

    } catch (err: any) {
      console.error('chatHandler fatal:', err)
      return res.status(500).json({ error: 'Failed to answer from document', detail: String(err?.message || err) })
    }
  }
}
