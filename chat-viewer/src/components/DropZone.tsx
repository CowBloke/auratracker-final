import { useRef, useState } from 'react'
import { Upload, FileJson } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatExport } from '@/types'

interface Props {
  onLoad: (data: ChatExport) => void
}

export function DropZone({ onLoad }: Props) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const parse = (file: File) => {
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as ChatExport
        if (!data.messages || !Array.isArray(data.messages)) throw new Error('Format invalide')
        onLoad(data)
      } catch {
        setError('Fichier JSON invalide ou format non reconnu.')
      }
    }
    reader.readAsText(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/json' || file?.name.endsWith('.json')) parse(file)
    else setError('Veuillez déposer un fichier .json')
  }

  return (
    <div className="flex items-center justify-center h-full bg-[hsl(var(--background))]">
      <div className="text-center max-w-md w-full px-6">
        {/* Logo area */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <FileJson className="w-8 h-8 text-[hsl(var(--primary))]" />
            <h1 className="text-2xl font-bold tracking-tight">Chat Viewer</h1>
          </div>
          <p className="text-[hsl(var(--muted-foreground))] text-sm">
            Visualisez vos exports de chat AuraTracker
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-12 cursor-pointer transition-all',
            dragging
              ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 scale-[1.02]'
              : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/50 hover:bg-white/5'
          )}
        >
          <Upload className={cn('w-10 h-10 mx-auto mb-4 transition-colors', dragging ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]')} />
          <p className="font-medium mb-1">
            {dragging ? 'Relâchez pour charger' : 'Glissez un fichier .json ici'}
          </p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            ou cliquez pour parcourir
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) parse(file)
            }}
          />
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400 bg-red-400/10 rounded-lg px-4 py-2">{error}</p>
        )}

        <p className="mt-6 text-xs text-[hsl(var(--muted-foreground))]">
          Fichier traité localement — aucune donnée envoyée.
        </p>
      </div>
    </div>
  )
}
