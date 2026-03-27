import { useState, useEffect, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supportApi, SupportMessage } from '@/services/api';
import { useSocketBase } from '@/contexts/SocketContext';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/page-shell';
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
    supportApi.markRead().catch(() => {});
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (data: { message: SupportMessage }) => {
      const msg = data.message;
      if (!msg.fromAdmin) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      supportApi.markRead().catch(() => {});
    };

    socket.on('support:message', handleMessage);
    return () => {
      socket.off('support:message', handleMessage);
    };
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
      <div>
        <div className="flex h-[calc(100vh-16rem)] min-h-[520px] max-h-[760px] flex-col overflow-hidden rounded-2xl border bg-background">
          <div className="border-b px-6 py-4">
            <p className="text-sm font-medium text-foreground">Support</p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/70" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Aucun message</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t bg-muted/20 p-4">
            <div className="rounded-2xl border bg-background p-2">
              <div className="flex gap-3">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message"
                  className="min-h-[52px] max-h-40 resize-none border-0 bg-transparent px-3 py-3 text-sm shadow-none focus-visible:ring-0"
                  rows={1}
                  maxLength={1000}
                />
                <Button
                  size="icon"
                  className="mt-auto h-11 w-11 shrink-0 rounded-xl"
                  disabled={!input.trim() || sending}
                  onClick={handleSend}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
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
          'max-w-[75%] rounded-2xl border px-4 py-3 text-sm shadow-sm',
          isAdmin
            ? 'rounded-tl-sm bg-muted/40 text-foreground'
            : 'rounded-tr-sm bg-primary/5 text-foreground'
        )}
      >
        <p className="break-words whitespace-pre-wrap leading-relaxed">{msg.body}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {format(new Date(msg.createdAt), 'dd MMM, HH:mm', { locale: fr })}
        </p>
      </div>
    </div>
  );
}
