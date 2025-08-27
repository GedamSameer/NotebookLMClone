import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Document, Page } from 'react-pdf'

export type PdfViewerRef = { scrollToPage: (page: number) => void }

export default forwardRef<PdfViewerRef, { fileUrl?: string }>(function PdfViewer({ fileUrl }, ref) {
  const [numPages, setNumPages] = useState<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  useImperativeHandle(ref, () => ({
    scrollToPage(page: number) {
      const el = pageRefs.current.get(page)
      if (el && containerRef.current) {
        const top = el.offsetTop - 8
        containerRef.current.scrollTo({ top, behavior: 'smooth' })
      }
    }
  }), [])

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-gray-50">
      {!fileUrl ? (
        <div className="p-6 text-gray-500">Upload a PDF to preview.</div>
      ) : (
        <Document file={fileUrl} onLoadSuccess={(info) => setNumPages(info.numPages)}>
          {Array.from(new Array(numPages), (_el, index) => (
            <div key={index} ref={(el) => { if (el) pageRefs.current.set(index + 1, el) }} className="flex justify-center py-4">
              <Page pageNumber={index + 1} width={720} renderTextLayer={false} renderAnnotationLayer={false} />
            </div>
          ))}
        </Document>
      )}
    </div>
  )
})