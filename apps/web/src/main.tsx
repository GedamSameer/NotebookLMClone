import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { pdfjs } from 'react-pdf'

// ✅ Vite-friendly way to load the worker
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url'
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
