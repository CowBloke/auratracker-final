import type { ChatMessage as ChatMessageType, Settings } from '@/types'
import { Pin } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  message: ChatMessageType
  settings: Settings
  isGrouped?: boolean
  accentColor: string
}

function formatTime(ts: string, condensed: boolean) {
  const d = new Date(ts)
  if (condensed) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })
}

// Deterministic color from username
const USER_COLORS = [
  '#60a5fa', '#34d399', '#f59e0b', '#f87171', '#a78bfa',
  '#38bdf8', '#4ade80', '#fb923c', '#e879f9', '#2dd4bf',
]
function getUserColor(username: string) {
  let hash = 0
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash)
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

export function ChatMessageRow({ message, settings, isGrouped = false, accentColor }: Props) {
  const isSystem = message.type === 'system'
  const isHighlighted = settings.highlightedUsers.includes(message.username)
  const py = settings.condensed ? 'py-0.5' : 'py-1.5'
  const px = 'px-4'

  if (isSystem) {
    return (
      <div className={cn('flex items-center gap-2', py, px, 'text-xs text-[hsl(var(--muted-foreground))] italic')}>
        <span className="flex-1 border-t border-dashed border-[hsl(var(--border))]" />
        <span className="shrink-0">{message.message}</span>
        <span className="flex-1 border-t border-dashed border-[hsl(var(--border))]" />
      </div>
    )
  }

  const showHeader = !isGrouped || !settings.groupMessages
  const userColor = isHighlighted ? accentColor : getUserColor(message.username)

  return (
    <div
      className={cn(
        'flex gap-3 group relative',
        py,
        px,
        isHighlighted && 'rounded-md',
        settings.condensed ? '' : 'hover:bg-white/5'
      )}
      style={
        isHighlighted
          ? { backgroundColor: `${accentColor}12`, borderLeft: `2px solid ${accentColor}` }
          : undefined
      }
    >
      {/* Avatar placeholder — shown only on first message of group */}
      <div className={cn('flex-shrink-0 w-8', settings.condensed ? 'w-5' : 'w-8')}>
        {showHeader && !settings.condensed && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white select-none"
            style={{ backgroundColor: userColor }}
          >
            {message.username[0]?.toUpperCase()}
          </div>
        )}
        {settings.condensed && settings.showTimestamps && (
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity leading-5">
            {formatTime(message.timestamp, true)}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {showHeader && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-semibold text-sm" style={{ color: userColor }}>
              {message.username}
            </span>
            {settings.showTimestamps && !settings.condensed && (
              <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                {formatTime(message.timestamp, false)}
              </span>
            )}
            {message.pinned && (
              <Pin className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
            )}
          </div>
        )}

        <p
          className="break-words leading-relaxed text-[hsl(var(--foreground))]"
          style={{ fontSize: settings.fontSize }}
        >
          {message.message}
        </p>

        {settings.showImages && message.imageUrl && (
          <img
            src={message.imageUrl}
            alt="attachment"
            className="mt-2 rounded-md max-w-xs max-h-64 object-cover border border-[hsl(var(--border))]"
            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          />
        )}
      </div>

      {/* Condensed timestamp on hover */}
      {settings.condensed && !settings.showTimestamps && false && null}
    </div>
  )
}
