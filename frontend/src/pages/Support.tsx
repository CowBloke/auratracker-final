import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ChevronDown, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supportApi, SupportMessage, uploadUserImage } from '@/services/api';
import { useSocketBase } from '@/contexts/SocketContext';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/page-shell';
import { useSmartScroll } from '@/hooks/useSmartScroll';
import { prepareImageUploadPayload } from '@/lib/image-upload';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Support() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchMessages();
    supportApi.markRead().catch(() => {});
  }, [fetchMessages]);

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
    if ((!trimmed && images.length === 0) || sending || uploadingImage) return;

    setSending(true);
    try {
      const { data } = await supportApi.sendMessage(trimmed, images.length > 0 ? images : undefined);
      setMessages((prev) => [...prev, data.message]);
      setInput('');
      setImages([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
      console.error('Maximum 5 images allowed');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
    <PageShell>
      <div>
        <div className="flex h-[calc(100vh-16rem)] min-h-[520px] max-h-[760px] flex-col overflow-hidden rounded-2xl border bg-background">
          <div className="border-b px-6 py-4">
            <p className="text-sm font-medium text-foreground">Support</p>
          </div>

          <div 
            className="flex-1 overflow-y-auto px-5 py-5 relative"
            ref={(el) => {
              if (el) setScrollAreaRef(el);
            }}
          >
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
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t bg-muted/20 p-4">
            <div className="rounded-2xl border bg-background p-2">
              {images.length > 0 && (
                <div className="mb-2 flex gap-2 flex-wrap px-2 pt-1">
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
              <div className="flex gap-3 items-end">
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
                  disabled={(!input.trim() && images.length === 0) || sending || uploadingImage}
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
  const messageImages = msg.images ? JSON.parse(msg.images) : [];

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
        {messageImages.length > 0 && (
          <div className="mb-2 flex gap-1 flex-wrap">
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
        <p className="break-words whitespace-pre-wrap leading-relaxed">{msg.body}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {format(new Date(msg.createdAt), 'dd MMM, HH:mm', { locale: fr })}
        </p>
      </div>
    </div>
  );
}
