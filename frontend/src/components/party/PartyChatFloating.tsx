import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Minimize2, Send, Users, ChevronDown } from 'lucide-react';
import { usePartySocket } from '@/contexts/PartySocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { MessageFormatToolbar } from '@/components/chat/MessageFormatToolbar';
import { Input } from '@/components/ui/input';
import { UsernameDisplay } from '@/components/ui/username-display';
import { cn } from '@/lib/utils';
import { useSmartScroll } from '@/hooks/use-smart-scroll';
import { FormattedMessageText, hasMessageFormatting } from '@/lib/message-formatting';
import { Card, CardContent } from '@/components/ui/card';

interface PartyChatFloatingProps {
  rightOffset: string;
}

export default function PartyChatFloating({ rightOffset }: PartyChatFloatingProps) {
  const { user } = useAuth();
  const { currentParty, partyMembers, partyMessages, sendPartyMessage } = usePartySocket();
  const [minimized, setMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [inputElement, setInputElement] = useState<HTMLInputElement | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const { messagesEndRef, hasNewMessage, scrollToBottom, setScrollAreaRef } = useSmartScroll({
    dependency: [partyMessages, minimized],
  });
  const lastMessageIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const partyIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (partyIdRef.current !== currentParty?.id) {
      partyIdRef.current = currentParty?.id ?? null;
      lastMessageIdRef.current = null;
      initializedRef.current = false;
      setUnreadCount(0);
    }
  }, [currentParty?.id]);

  useEffect(() => {
    const lastMessage = partyMessages[partyMessages.length - 1];

    if (!lastMessage) {
      initializedRef.current = true;
      if (!minimized) {
        setUnreadCount(0);
      }
      return;
    }

    if (!initializedRef.current) {
      lastMessageIdRef.current = lastMessage.id;
      initializedRef.current = true;
      if (!minimized) {
        setUnreadCount(0);
      }
      return;
    }

    if (!minimized) {
      setUnreadCount(0);
      lastMessageIdRef.current = lastMessage.id;
      return;
    }

    if (lastMessage.id !== lastMessageIdRef.current && lastMessage.userId !== user?.id) {
      setUnreadCount((prev) => prev + 1);
    }

    lastMessageIdRef.current = lastMessage.id;
  }, [partyMessages, minimized, user?.id]);

  if (!currentParty) return null;

  const isDuel = currentParty.maxSize === 2;
  const title = isDuel ? 'Chat duel' : 'Chat party';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;
    sendPartyMessage(trimmedMessage);
    setMessage('');
  };

  return (
    <div
      className="fixed bottom-24 z-50 transition-all"
      style={{ right: rightOffset }}
    >
      <div
        className={cn(
          'overflow-hidden rounded-xl border border-border/60 bg-background/95 ',
          minimized ? 'w-56' : 'w-[22rem]'
        )}
      >
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <Button variant="ghost" size="xs" type="button" onClick={() => setMinimized((value) => !value)}>
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted">
              <MessageCircle className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-destructive text-xs font-medium text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {currentParty.name || (isDuel ? 'Duel en cours' : 'Groupe actif')} · {partyMembers.length}/{currentParty.maxSize}
              </p>
            </div>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setMinimized((value) => !value)}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>

        {minimized ? null : (
          <>
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                {isDuel ? 'Conversation privée du duel' : 'Conversation privée de la party'}
              </span>
              <Link to="/party" className="underline underline-offset-2 hover:text-foreground">
                Ouvrir
              </Link>
            </div>

            <div 
              className="max-h-80 min-h-56 overflow-y-auto px-4 py-3 relative"
              ref={(el) => {
                if (el) setScrollAreaRef(el);
              }}
            >
              {partyMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun message pour le moment</p>
              ) : (
                <div className="space-y-3">
                  {partyMessages.map((partyMessage) => (
                    <div key={partyMessage.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          <UsernameDisplay
                            username={partyMessage.username}
                            usernameColor={partyMessage.usernameColor}
                          />
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(partyMessage.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm text-foreground/95">
                        <FormattedMessageText text={partyMessage.message} />
                      </p>
                    </div>
                  ))}
                  {hasNewMessage && (
                    <div className="sticky bottom-0 flex justify-center py-2">
                      <Button variant="ghost" size="xs" onClick={scrollToBottom} title="Aller au dernier message">
                        <ChevronDown className="h-3 w-3" />
                        <span>Nouveau message</span>
                      </Button>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-border/40 p-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    ref={setInputElement}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={isDuel ? 'Écris à ton adversaire' : 'Écris à ta party'}
                    maxLength={500}
                  />
                  <MessageFormatToolbar inputRef={{ current: inputElement }} value={message} onChange={setMessage} />
                  {hasMessageFormatting(message) && (
                    <Card className="gap-0 py-0 shadow-none mt-2"><CardContent className="px-2.5 py-1.5 text-sm text-foreground">
                      <FormattedMessageText text={message} />
                    </CardContent></Card>
                  )}
                </div>
                <Button type="submit" size="icon" disabled={!message.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
