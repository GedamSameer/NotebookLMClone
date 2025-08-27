import axios from 'axios'
import { useRef, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export default function UploadCard({
  onUploaded,
}: {
  onUploaded: (docId: string, localUrl: string) => void
}) {
  const [hover, setHover] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [percent, setPercent] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  async function onFiles(files?: FileList | null) {
    const file = files?.[0]
    if (!file || uploading) return

    setUploading(true)
    setPercent(0)

    try {
      const form = new FormData()
      form.append('file', file)

      const res = await axios.post(`${API_URL}/api/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          const total = e.total || file.size || 0
          if (total > 0) {
            const p = Math.min(100, Math.round((e.loaded / total) * 100))
            setPercent(p)
          }
        },
      })

      const { docId } = res.data
      const localUrl = URL.createObjectURL(file)

      //I want to add here File uploaded parsing file
      onUploaded(docId, localUrl)
    } catch (err) {
      console.error(err)
      setUploading(false)
      setPercent(0)
      alert('Upload failed. Please try again.')
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true) }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files) }}
      className={`card-upload ${hover ? 'card-upload--hover' : ''}`}
    >
      {!uploading ? (
        <>
          <div
            className="upload-icon"
            role="button"
            aria-label="Upload PDF"
            onClick={() => inputRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
              <path fill="currentColor" d="M12 3l4 4h-3v6h-2V7H8l4-4zm-7 14h14v2H5v-2z" />
            </svg>
          </div>
          <div className="upload-title">Upload PDF to start chatting</div>
          <div className="upload-sub">Drag and drop your file here</div>

          <input
            ref={inputRef}
            style={{ display: 'none' }}
            type="file"
            accept="application/pdf"
            onChange={(e) => onFiles(e.target.files)}
          />
        </>
      ) : (
        <div className="space-y-3">
          <div className="progress-row">
            <span className="progress-spinner" aria-hidden />
            <span className="progress-title">{percent<100 ? 'Uploading PDF' : 'File Uploaded - Parsing File'}</span>
            <span className="progress-percent">{percent}%</span>
          </div>
          <div
            className="progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="progress-bar__fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}
