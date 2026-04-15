import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SettingsPanel } from '@/components/SettingsPanel'
import { ChatMessageRow } from '@/components/ChatMessage'
import { DropZone } from '@/components/DropZone'
import type { ChatExport, Settings } from '@/types'
import { Settings as SettingsIcon, MessageSquare, Search, X, ArrowDown, FileJson } from 'lucide-react'
import { cn } from '@/lib/utils'

const THEME_VARS: Record<Settings['theme'], Record<string, string>> = {
  dark: { '--background': '220 13% 9%', '--card': '220 13% 12%', '--secondary': '220 13% 18%', '--border': '220 13% 20%', '--muted': '220 13% 18%', '--muted-foreground': '215 15% 55%' },
  darker: { '--background': '220 13% 5%', '--card': '220 13% 8%', '--secondary': '220 13% 12%', '--border': '220 13% 15%', '--muted': '220 13% 12%', '--muted-foreground': '215 15% 50%' },
  midnight: { '--background': '240 20% 5%', '--card': '240 15% 9%', '--secondary': '240 15% 14%', '--border': '240 15% 16%', '--muted': '240 15% 14%', '--muted-foreground': '240 10% 50%' },
  slate: { '--background': '215 25% 8%', '--card': '215 20% 12%', '--secondary': '215 20% 17%', '--border': '215 20% 20%', '--muted': '215 20% 17%', '--muted-foreground': '215 12% 52%' },
}

const DEFAULT_SETTINGS: Settings = {
  condensed: false,
  showTimestamps: true,
  showImages: true,
  showSystemMessages: true,
  groupMessages: true,
  fontSize: 14,
  theme: 'dark',
  accentColor: '#7c3aed',
  highlightedUsers: [],
  pinnedOnly: false,
}

export default function App() {
  const [chatData, setChatData] = useState<ChatExport | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...partial }))
  }, [])

  // Apply theme + accent CSS variables
  const themeStyle = useMemo(() => {
    const vars = THEME_VARS[settings.theme]
    const accent = hexToHsl(settings.accentColor)
    const style: Record<string, string> = { ...vars, '--primary': accent, '--ring': accent }
    return style as React.CSSProperties
  }, [settings.theme, settings.accentColor])

  const allUsers = useMemo(() => {
    if (!chatData) return []
    const users = new Set<string>()
    for (const m of chatData.messages) {
      if (m.type === 'user') users.add(m.username)
    }
    return Array.from(users).sort()
  }, [chatData])

  const filteredMessages = useMemo(() => {
    if (!chatData) return []
    return chatData.messages.filter((m) => {
      if (!settings.showSystemMessages && m.type === 'system') return false
      if (settings.pinnedOnly && !m.pinned) return false
      if (search) {
        const q = search.toLowerCase()
        if (!m.message.toLowerCase().includes(q) && !m.username.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [chatData, settings.showSystemMessages, settings.pinnedOnly, search])

  useEffect(() => {
    if (chatData) {
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50)
    }
  }, [chatData])

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 100)
  }

  if (!chatData) {
    return (
      <div style={themeStyle} className="h-screen">
        <DropZone onLoad={setChatData} />
      </div>
    )
  }

  const exportDate = new Date(chatData.exportedAt).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div style={themeStyle} className="h-screen flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 h-14 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] flex-shrink-0">
        <FileJson className="w-5 h-5 text-[hsl(var(--primary))]" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm">Chat du {exportDate}</span>
          <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
            {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
            {search ? ' trouvés' : ''}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {showSearch ? (
            <div className="flex items-center gap-2 bg-[hsl(var(--secondary))] rounded-md px-3 h-8">
              <Search className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="bg-transparent outline-none text-sm w-48 text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
              {search && (
                <button onClick={() => setSearch('')}>
                  <X className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" />
                </button>
              )}
              <button onClick={() => { setShowSearch(false); setSearch('') }}>
                <X className="w-4 h-4 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" />
              </button>
            </div>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setShowSearch(true)}>
              <Search className="w-4 h-4" />
            </Button>
          )}

          <Button variant="ghost" size="icon" title="Charger un autre fichier" onClick={() => setChatData(null)}>
            <MessageSquare className="w-4 h-4" />
          </Button>

          <Button
            variant={showSettings ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setShowSettings((v) => !v)}
          >
            <SettingsIcon className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Chat area */}
        <div className="flex-1 min-w-0 relative flex flex-col">
          <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
            <div className={cn('py-2', settings.condensed ? '' : 'py-4')}>
              {filteredMessages.map((msg, i) => {
                const prev = filteredMessages[i - 1]
                const isGrouped =
                  settings.groupMessages &&
                  prev?.username === msg.username &&
                  prev?.type === msg.type &&
                  msg.type === 'user' &&
                  new Date(msg.timestamp).getTime() - new Date(prev.timestamp).getTime() < 5 * 60 * 1000

                return (
                  <ChatMessageRow
                    key={msg.id}
                    message={msg}
                    settings={settings}
                    isGrouped={isGrouped}
                    accentColor={settings.accentColor}
                  />
                )
              })}
              <div ref={bottomRef} />
            </div>
          </div>

          {!atBottom && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 w-9 h-9 rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity text-white"
              style={{ backgroundColor: settings.accentColor }}
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Settings panel */}
        {showSettings && (
          <>
            <Separator orientation="vertical" />
            <div className="w-72 flex-shrink-0 bg-[hsl(var(--card))] flex flex-col">
              <div className="flex items-center justify-between px-4 h-12 border-b border-[hsl(var(--border))]">
                <span className="font-semibold text-sm">Réglages</span>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ScrollArea className="flex-1">
                <SettingsPanel settings={settings} onChange={updateSettings} allUsers={allUsers} />
              </ScrollArea>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}
