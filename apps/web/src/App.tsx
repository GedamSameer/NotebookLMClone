import { useState, useRef } from 'react'
import PdfViewer, { PdfViewerRef } from './components/PdfViewer'
import ChatPanel from './components/ChatPanel'
import UploadCard from './components/UploadCard'

export default function App() {
  const [docId, setDocId] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const viewerRef = useRef<PdfViewerRef>(null)

  if (!docId) {
    return (
      <div className="min-h-screen bg-gray-100 grid place-items-center p-4">
        <UploadCard onUploaded={(id, url) => { setDocId(id); setPdfUrl(url) }} />
      </div>
    )
  }

  return (
    // Top-level needs to be full height and flex column:
    <div className="h-screen w-screen flex flex-col">
      {/* MAIN: Chat (left) | PDF (right) */}
      <div className="flex-1 min-h-0 flex flex-row">
        {/* LEFT: Chat */}
        <section className="w-[420px] shrink-0 flex flex-col min-h-0 border-r">
          <div className="px-4 py-2 text-sm text-gray-600 border-b bg-gray-50">
            Ask your document
          </div>
          <div className="flex-1 min-h-0">
            <ChatPanel
              docId={docId ?? undefined}
              onJumpToPage={(p) => viewerRef.current?.scrollToPage(p)}
            />
          </div>
        </section>

        {/* RIGHT: PDF */}
        <section className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-2 text-sm text-gray-600 border-b bg-gray-50">
            PDF Viewer
          </div>
          <div className="flex-1 min-h-0">
            <PdfViewer ref={viewerRef} fileUrl={pdfUrl ?? undefined} />
          </div>
        </section>
      </div>
    </div>
  )
}