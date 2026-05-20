import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Shield, ChevronDown, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageFormatToolbar } from '@/components/chat/MessageFormatToolbar';
import { Textarea } from '@/components/ui/textarea';
import { supportApi, SupportMessage, uploadUserImage } from '@/services/api';
import { useSocketBase } from '@/contexts/SocketContext';
import { cn } from '@/lib/utils';
import { useSmartScroll } from '@/hooks/use-smart-scroll';
import { prepareImageUploadPayload } from '@/lib/image-upload';
import { FormattedMessageText, hasMessageFormatting } from '@/lib/message-formatting';
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
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [textareaElement, setTextareaElement] = useState<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { messagesEndRef, hasNewMessage, scrollToBottom, setScrollAreaRef } = useSmartScroll({
    dependency: [messages],
  });
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
    if ((!trimmed && images.length === 0) || sending) return;

    setSending(true);
    try {
      const { data } = await supportApi.sendMessage(trimmed, images.length > 0 ? images : undefined);
      setMessages((prev) => [...prev, data.message]);
      setInput('');
      setImages([]);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    if (images.length + files.length > 5) {
      // Show error - could be a toast in real app
      console.error('Maximum 5 images allowed');
      return;
    }

    setUploadingImage(true);

    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const { base64Data, mimeType } = await prepareImageUploadPayload(file);
        const { data } = await uploadUserImage({ base64Data, mimeType });
        uploadedUrls.push(data.imageUrl);
      }

      if (uploadedUrls.length > 0) {
        setImages((prev) => [...prev, ...uploadedUrls]);
      }
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
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
          <div 
            className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0 relative" 
            style={{ minHeight: '200px', maxHeight: '280px' }}
            ref={(el) => {
              if (el) setScrollAreaRef(el);
            }}
          >
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
            {hasNewMessage && (
              <div className="sticky bottom-0 flex justify-center py-2">
                <button
                  onClick={scrollToBottom}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-foreground/10 hover:bg-foreground/20 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="Aller au dernier message"
                >
                  <ChevronDown className="h-3 w-3" />
                  <span>Nouveau message</span>
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 space-y-2">
            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={img}
                      alt={`Upload ${idx}`}
                      className="h-12 w-12 object-cover rounded border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Supprimer l'image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 hover:bg-primary/10 hover:text-primary text-xs"
                  disabled={uploadingImage || images.length >= 5 || sending}
                  onClick={() => fileInputRef.current?.click()}
                  title="Ajouter une image"
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Image
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              <div className="flex-1">
                <Textarea
                  ref={setTextareaElement}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Votre message…"
                  className="resize-none text-sm min-h-[36px] max-h-24 py-2"
                  rows={1}
                  maxLength={1000}
                />
                <MessageFormatToolbar inputRef={{ current: textareaElement }} value={input} onChange={setInput} />
                {hasMessageFormatting(input) && (
                  <div className="mt-2 rounded-lg border border-border/50 bg-background/70 px-2.5 py-1.5 text-sm text-foreground">
                    <FormattedMessageText text={input} />
                  </div>
                )}
              </div>
              <Button
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={(!input.trim() && images.length === 0) || sending || uploadingImage}
                onClick={handleSend}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
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
  const messageImages = msg.images ? JSON.parse(msg.images) : [];
  
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
        {messageImages.length > 0 && (
          <div className="flex gap-1 mb-2 flex-wrap">
            {messageImages.map((img: string, idx: number) => (
              <img
                key={idx}
                src={img}
                alt={`Message ${idx}`}
                className="h-16 w-16 object-cover rounded"
              />
            ))}
          </div>
        )}
        <p className="break-words whitespace-pre-wrap">
          <FormattedMessageText text={msg.body} />
        </p>
        <p className={cn('text-[10px] mt-1', isAdmin ? 'text-muted-foreground' : 'text-primary-foreground/70')}>
          {format(new Date(msg.createdAt), 'HH:mm', { locale: fr })}
        </p>
      </div>
    </div>
  );
}
