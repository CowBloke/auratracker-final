import { FormEvent, useEffect, useRef, useState } from 'react';
import { usePartySocket } from '@/contexts/PartySocketContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UsernameDisplay } from '@/components/ui/username-display';
import { TYPOGRAPHY } from '@/lib/design-system';
import { cn } from '@/lib/utils';

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
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [partyMessages]);

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
        <div className="max-h-80 overflow-y-auto rounded-lg border border-border/40 bg-muted/20 p-4">
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
              <div ref={endRef} />
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
