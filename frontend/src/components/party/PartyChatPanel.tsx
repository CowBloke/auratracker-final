import { FormEvent, useState } from 'react';
import { usePartySocket } from '@/contexts/PartySocketContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UsernameDisplay } from '@/components/ui/username-display';
import { TYPOGRAPHY } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useSmartScroll } from '@/hooks/useSmartScroll';

interface PartyChatPanelProps {
  title?: string;
  emptyLabel?: string;
  placeholder?: string;
  className?: string;
}

export default function PartyChatPanel({
  title = 'Chat de la party',
  emptyLabel = 'Aucun message pour le moment',
  placeholder = 'Écris à ta party',
  className,
}: PartyChatPanelProps) {
  const { currentParty, partyMessages, sendPartyMessage } = usePartySocket();
  const [message, setMessage] = useState('');
  const { messagesEndRef, hasNewMessage, scrollToBottom, setScrollAreaRef } = useSmartScroll({
    dependency: [partyMessages],
  });

  if (!currentParty) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;
    sendPartyMessage(trimmedMessage);
    setMessage('');
  };

  return (
    <Card className={className}>
      <CardHeader>
        <h3 className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground')}>
          {title}
        </h3>
      </CardHeader>
      <CardContent className="space-y-4">
        <div 
          className="max-h-80 overflow-y-auto rounded-lg border border-border/40 bg-muted/20 p-4 relative"
          ref={(el) => {
            if (el) setScrollAreaRef(el);
          }}
        >
          {partyMessages.length === 0 ? (
            <p className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground')}>
              {emptyLabel}
            </p>
          ) : (
            <div className="space-y-3">
              {partyMessages.map((partyMessage) => (
                <div key={partyMessage.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={TYPOGRAPHY.SMALL}>
                      <UsernameDisplay
                        username={partyMessage.username}
                        usernameColor={partyMessage.usernameColor}
                      />
                    </span>
                    <span className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                      {new Date(partyMessage.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className={cn(TYPOGRAPHY.SMALL, 'whitespace-pre-wrap break-words')}>
                    {partyMessage.message}
                  </p>
                </div>
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
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={placeholder}
            maxLength={500}
          />
          <Button type="submit" variant="outline" disabled={!message.trim()}>
            Envoyer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
