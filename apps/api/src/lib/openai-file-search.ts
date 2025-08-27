// apps/api/src/lib/fileSearch.ts
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
// Persist a tiny docId -> vectorStoreId map so you don't reindex every reboot.
const ROOT = path.resolve(__dirname, '..')
const MAP_PATH = path.resolve(ROOT, 'vector-stores.json')

type MapFile = Record<string, string>

function loadMap(): MapFile {
  try { return JSON.parse(fs.readFileSync(MAP_PATH, 'utf8')) } catch { return {} }
}
function saveMap(m: MapFile) {
  fs.writeFileSync(MAP_PATH, JSON.stringify(m, null, 2), 'utf8')
}

let memo = loadMap()

export async function ensureVectorStoreForDoc(docId: string, pdfPath: string): Promise<string> {
  if (memo[docId]) return memo[docId]

  // 1) create a vector store for this doc
  const vs = await client.vectorStores.create({ name: `doc_${docId}` })
    
  // 2) upload the PDF into it (the API will parse/chunk/index)
  await client.vectorStores.fileBatches.uploadAndPoll(vs.id, {
    files: [fs.createReadStream(pdfPath)],
  })
  memo[docId] = vs.id
  saveMap(memo)
  return vs.id
}

export async function askWithFileSearch(opts: {
  docId: string
  uploadsDir: string
  question: string
}): Promise<{ answer: string, raw: any }> {
  const { docId, uploadsDir, question } = opts
  const pdfPath = path.join(uploadsDir, `${docId}.pdf`)
  const vectorStoreId = await ensureVectorStoreForDoc(docId, pdfPath)

  const resp = await client.responses.create({
    model: 'gpt-4o-mini',
    input: question,
    tools: [{ type: 'file_search' }],
    tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
  })

  const answer = (resp as any).output_text ?? JSON.stringify(resp)
  return { answer, raw: resp }
}
