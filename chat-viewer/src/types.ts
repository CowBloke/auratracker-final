export interface ChatMessage {
  id: string
  timestamp: string
  username: string
  userId: string | null
  message: string
  imageUrl: string | null
  pinned: boolean
  type: 'user' | 'system'
  reactions: Reaction[]
}

export interface Reaction {
  emoji?: string
  count?: number
  users?: string[]
}

export interface ChatExport {
  exportedAt: string
  messageCount: number
  messages: ChatMessage[]
}

export interface Settings {
  // Display
  condensed: boolean
  showTimestamps: boolean
  showImages: boolean
  showSystemMessages: boolean
  groupMessages: boolean
  // Appearance
  fontSize: number
  theme: 'dark' | 'darker' | 'midnight' | 'slate'
  accentColor: string
  // Highlighting
  highlightedUsers: string[]
  pinnedOnly: boolean
}
