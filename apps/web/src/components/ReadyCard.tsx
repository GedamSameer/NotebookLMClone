// apps/web/src/components/ReadyCard.tsx
export default function ReadyCard({
  onClose,
  onUsePrompt,
}: {
  onClose: () => void
  onUsePrompt: (text: string) => void
}) {
  const prompts = [
    'What is the main topic of this document?',
    'Can you summarize the key points?',
    'What are the conclusions or recommendations?',
  ]

  return (
    <div className="relative rounded-xl bg-purple-50 text-purple-900 shadow-md border border-purple-100 p-4 md:p-5">
      {/* close */}
      <button
        onClick={onClose}
        className="absolute top-2.5 right-2.5 text-purple-500 hover:text-purple-700"
        aria-label="Dismiss"
      >
        ×
      </button>

      <div className="font-semibold mb-2">Your document is ready!</div>
      <div className="text-sm text-purple-800 mb-3">
        You can now ask questions about your document. For example:
      </div>

      <ul className="space-y-2 text-sm">
        {prompts.map((p, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 rounded-full bg-purple-400" />
            <button
              className="text-left hover:underline"
              onClick={() => onUsePrompt(p)}
            >
              “{p}”
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
