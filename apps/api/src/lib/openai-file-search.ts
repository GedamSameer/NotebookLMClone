// apps/api/src/lib/openai-file-search.ts
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

// Persist a tiny docId -> vectorStoreId map so we don't re-index after each reboot.
// This lives next to the compiled dist files on Render (ephemeral on free plan).
const ROOT = path.resolve(__dirname, '..')
const MAP_PATH = path.resolve(ROOT, 'vector-stores.json')

type MapFile = Record<string, string>

function loadMap(): MapFile {
  try {
    return JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'))
  } catch {
    return {}
  }
}
function saveMap(map: MapFile) {
  try {
    fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2), 'utf8')
  } catch {
    /* ignore writes failing on truly read-only envs */
  }
}

async function ensureVectorStoreForDoc(docId: string, pdfPath: string): Promise<string> {
  const map = loadMap()
  if (map[docId]) return map[docId]

  // 1) Create a vector store
  const vs = await client.vectorStores.create({ name: `doc-${docId}` })

  // 2) Upload file and attach to store (createAndPoll waits for indexing)
  const file = await client.files.create({
    file: fs.createReadStream(pdfPath),
    purpose: 'assistants',
  })
  await client.vectorStores.files.createAndPoll(vs.id, { file_id: file.id })

  map[docId] = vs.id
  saveMap(map)
  return vs.id
}

export async function askWithFileSearch(opts: {
  docId: string
  uploadsDir: string
  question: string
}): Promise<{ answer: string; raw: any }> {
  const { docId, uploadsDir, question } = opts
  const pdfPath = path.join(uploadsDir, `${docId}.pdf`)

  // Ensure we have a store bound to this doc
  const vectorStoreId = await ensureVectorStoreForDoc(docId, pdfPath)

  // Build a body that satisfies both older/newer OpenAI SDK typings.
  const body: any = {
    model: 'gpt-4o-mini',
    input: question,
    // Some SDK versions expect vector_store_ids directly in the tool; others via tool_resources.
    tools: [{ type: 'file_search', vector_store_ids: [vectorStoreId] }],
    tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
  }

  const resp = await client.responses.create(body)
  const answer =
    (resp as any).output_text ??
    (resp as any).choices?.[0]?.message?.content ??
    'Sorry, no answer was produced.'
  return { answer, raw: resp }
}
