import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Shield, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supportApi, SupportMessage } from '@/services/api';
import { useSocketBase } from '@/contexts/SocketContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SupportChatProps {
  rightOffset?: string;
}

export default function SupportChat({ rightOffset = '1.5rem' }: SupportChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocketBase();

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await supportApi.getMessages();
      setMessages(data.messages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await supportApi.getUnreadCount();
      setUnreadCount(data.count);
    } catch {
      // ignore
    }
  }, []);

  // Initial unread count fetch
  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  // Fetch messages when opened
  useEffect(() => {
    if (open) {
      fetchMessages();
      // Mark admin replies as read
      supportApi.markRead().catch(() => {});
      setUnreadCount(0);
    }
  }, [open, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Socket listener for real-time messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (data: { message: SupportMessage }) => {
      const msg = data.message;
      // Only care about messages for the current user (fromAdmin = true)
      if (!msg.fromAdmin) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      if (!open) {
        setUnreadCount((c) => c + 1);
      } else {
        // Already open: mark read immediately
        supportApi.markRead().catch(() => {});
      }
    };

    socket.on('support:message', handleMessage);
    return () => {
      socket.off('support:message', handleMessage);
    };
  }, [socket, open]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const { data } = await supportApi.sendMessage(trimmed);
      setMessages((prev) => [...prev, data.message]);
      setInput('');
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="fixed bottom-6 z-50 flex flex-col items-end gap-2 transition-all"
      style={{ right: rightOffset }}
    >
      {/* Chat panel */}
      {open && (
        <div className="w-80 rounded-xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '420px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/50">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Support</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0" style={{ minHeight: '200px', maxHeight: '280px' }}>
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Chargement…</p>
            ) : messages.length === 0 ? (
              <div className="text-center py-6 space-y-1">
                <p className="text-sm text-muted-foreground">Pas encore de messages.</p>
                <p className="text-xs text-muted-foreground">Envoie un message pour contacter le support.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Votre message…"
              className="resize-none text-sm min-h-[36px] max-h-24 py-2"
              rows={1}
              maxLength={1000}
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={!input.trim() || sending}
              onClick={handleSend}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <Button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title="Support"
        variant="outline"
        size="icon"
        className="relative h-11 w-11 rounded-full shadow-sm"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-6 h-6 px-1.5 flex items-center justify-center text-[11px] font-semibold tabular-nums rounded-full border-2 border-background bg-red-500 text-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>
    </div>
  );
}

function MessageBubble({ msg }: { msg: SupportMessage }) {
  const isAdmin = msg.fromAdmin;
  return (
    <div className={cn('flex', isAdmin ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
          isAdmin
            ? 'bg-muted text-foreground rounded-tl-sm'
            : 'bg-primary text-primary-foreground rounded-tr-sm'
        )}
      >
        {isAdmin && (
          <p className="text-[10px] font-semibold text-primary mb-0.5 flex items-center gap-1">
            <Shield className="h-3 w-3" /> Support
          </p>
        )}
        <p className="break-words whitespace-pre-wrap">{msg.body}</p>
        <p className={cn('text-[10px] mt-1', isAdmin ? 'text-muted-foreground' : 'text-primary-foreground/70')}>
          {format(new Date(msg.createdAt), 'HH:mm', { locale: fr })}
        </p>
      </div>
    </div>
  );
}
