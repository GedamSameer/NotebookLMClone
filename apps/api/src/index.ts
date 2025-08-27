// apps/api/src/index.ts
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fileUpload from 'express-fileupload'
import path from 'path'
import fs from 'fs'
import { uploadHandler } from './routes/upload'
import { chatHandler } from './routes/chat'

const app = express()

// ✅ Resolve from API root (../ from src)
const ROOT = path.resolve(__dirname, '..')
const UPLOAD_DIR = path.resolve(ROOT, process.env.UPLOAD_DIR || 'uploads')
const TMP_DIR = path.resolve(ROOT, 'tmp')

fs.mkdirSync(UPLOAD_DIR, { recursive: true })
fs.mkdirSync(TMP_DIR, { recursive: true })

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: TMP_DIR,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  })
)

// Optional: serve raw PDFs (handy for manual checks)
app.use('/uploads', express.static(UPLOAD_DIR))

// Routes (both get the SAME UPLOAD_DIR)
app.post('/api/upload', uploadHandler(UPLOAD_DIR))
app.post('/api/chat', chatHandler(UPLOAD_DIR))

// 🔎 Debug: confirm where a JSON lives for a given docId
app.get('/api/_debug/:docId', (req, res) => {
  const p = path.join(UPLOAD_DIR, `${req.params.docId}.json`)
  res.json({ exists: fs.existsSync(p), path: p })
})

const PORT = Number(process.env.PORT || 8080)
app.listen(PORT, () => {
  console.log(`API running on ${PORT}`)
  console.log('UPLOAD_DIR:', UPLOAD_DIR)
  console.log('TMP_DIR:', TMP_DIR)
  if (process.env.USE_FILE_SEARCH === '1') {
    console.log('File Search: ENABLED')
  }
})
