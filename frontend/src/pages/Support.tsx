import { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supportApi, SupportMessage } from '@/services/api';
import { useSocketBase } from '@/contexts/SocketContext';
import { cn } from '@/lib/utils';
import { PageShell, PageHeader } from '@/components/layout/page-shell';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Support() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchMessages();
    // Mark admin replies as read when page opens
    supportApi.markRead().catch(() => {});
  }, [fetchMessages]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real-time messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (data: { message: SupportMessage }) => {
      const msg = data.message;
      if (!msg.fromAdmin) return; // own messages added on send
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Mark as read immediately since page is open
      supportApi.markRead().catch(() => {});
    };

    socket.on('support:message', handleMessage);
    return () => { socket.off('support:message', handleMessage); };
  }, [socket]);

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
    <PageShell>
      <PageHeader title="Support" description="Contacte l'équipe pour toute question ou problème." />
      <div className="flex flex-col h-[calc(100vh-12rem)] max-h-[700px] rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Support AuraTracker</p>
            <p className="text-xs text-muted-foreground">L'équipe vous répond dès que possible.</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 py-12 text-center">
              <Shield className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Aucun message pour l'instant.</p>
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
        <div className="border-t border-border p-4 flex gap-3 items-end bg-background">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Votre message… (Entrée pour envoyer, Shift+Entrée pour nouvelle ligne)"
            className="resize-none text-sm min-h-[40px] max-h-32"
            rows={1}
            maxLength={1000}
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            disabled={!input.trim() || sending}
            onClick={handleSend}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

function MessageBubble({ msg }: { msg: SupportMessage }) {
  const isAdmin = msg.fromAdmin;
  return (
    <div className={cn('flex', isAdmin ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-4 py-2.5 text-sm',
          isAdmin
            ? 'bg-muted text-foreground rounded-tl-sm'
            : 'bg-primary text-primary-foreground rounded-tr-sm'
        )}
      >
        {isAdmin && (
          <p className="text-[11px] font-semibold text-primary mb-1 flex items-center gap-1">
            <Shield className="h-3 w-3" /> Support
          </p>
        )}
        <p className="break-words whitespace-pre-wrap leading-relaxed">{msg.body}</p>
        <p className={cn('text-[11px] mt-1.5', isAdmin ? 'text-muted-foreground' : 'text-primary-foreground/60')}>
          {format(new Date(msg.createdAt), 'dd MMM, HH:mm', { locale: fr })}
        </p>
      </div>
    </div>
  );
}
