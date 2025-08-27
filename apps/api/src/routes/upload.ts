import type { Request, Response } from 'express'
import type { UploadedFile } from 'express-fileupload'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import pdf from 'pdf-parse'

// Build a pagerender fn to capture text page-by-page
function makePageCollector() {
  const pages: string[] = []
  const pagerender = async (pageData: any) => {
    const textContent = await pageData.getTextContent()
    const strings = textContent.items.map((it: any) => (it.str ?? '') as string)
    const pageText = strings.join(' ').replace(/\s+/g, ' ').trim()
    pages.push(pageText)
    // return value is still required by pdf-parse internals
    return pageText
  }
  return { pages, pagerender }
}

export function uploadHandler(UPLOAD_DIR: string) {
  return async function (req: Request, res: Response) {
    try {
      const file = req.files?.file as UploadedFile | undefined
      if (!file) return res.status(400).json({ error: 'No file provided' })

      // Basic type/extension guard
      const isPdf =
        file.mimetype === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (!isPdf) return res.status(400).json({ error: 'Only PDF files are allowed' })

      // Prepare IDs/paths
      const docId = uuidv4()
      const pdfPath = path.join(UPLOAD_DIR, `${docId}.pdf`)
      const jsonPath = path.join(UPLOAD_DIR, `${docId}.json`)

      // Move temp file to our uploads dir
      // (express-fileupload with useTempFiles gives us tempFilePath)
      const tempPath = (file as any).tempFilePath as string | undefined
      if (tempPath) {
        fs.renameSync(tempPath, pdfPath)
      } else {
        // Fallback: write buffer
        const data: Buffer = (file as any).data
        fs.writeFileSync(pdfPath, data)
      }

      // Parse per-page text with pdf-parse
      const dataBuffer = fs.readFileSync(pdfPath)
      const collector = makePageCollector()

      await pdf(dataBuffer, {
        pagerender: collector.pagerender,
      })

      const pages = collector.pages.map((t, i) => ({ page: i + 1, text: t }))
      const payload = {
        meta: { filename: file.name, pages: pages.length, docId },
        pages,
      }

      fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8')

      return res.json({ docId, filename: file.name, pages: pages.length })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Failed to upload/parse PDF' })
    }
  }
}
