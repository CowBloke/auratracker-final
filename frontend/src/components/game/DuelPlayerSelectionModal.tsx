import { useEffect, useMemo, useState } from 'react';
import { Search, Swords } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UsernameDisplay } from '@/components/ui/username-display';
import type { OnlineUser } from '@/contexts/ChatSocketContext';
import { usePrioritizedDuelUsers } from '@/hooks/use-prioritized-duel-users';

type DuelGameType = 'chess' | 'battleship' | 'p4' | 'ballarena' | 'uno' | 'morpion';

interface OutgoingDuelChallenge {
  targetId: string;
  gameType: DuelGameType;
}

interface DuelPlayerSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  gameType: DuelGameType;
  onlineUsers: OnlineUser[];
  currentUserId?: string;
  outgoingDuelChallenge: OutgoingDuelChallenge | null;
  challengeUserToDuel: (targetId: string, targetUsername: string, gameType: DuelGameType) => void;
  requestOnlineUsers?: () => void;
}

export function DuelPlayerSelectionModal({
  open,
  onOpenChange,
  title,
  gameType,
  onlineUsers,
  currentUserId,
  outgoingDuelChallenge,
  challengeUserToDuel,
  requestOnlineUsers,
}: DuelPlayerSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setSearchQuery('');
    requestOnlineUsers?.();
  }, [open, requestOnlineUsers]);

  const challengeableUsers = usePrioritizedDuelUsers(onlineUsers, currentUserId, searchQuery);

  const hasOtherOnlineUsers = useMemo(
    () => onlineUsers.some((onlineUser) => onlineUser.userId !== currentUserId),
    [onlineUsers, currentUserId]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-normal flex items-center gap-2">
            <Swords className="h-4 w-4" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un joueur..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {challengeableUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {hasOtherOnlineUsers ? 'Aucun résultat' : 'Aucun joueur en ligne'}
              </p>
            ) : (
              challengeableUsers.map((onlineUser) => {
                const isPending = outgoingDuelChallenge?.targetId === onlineUser.userId && outgoingDuelChallenge.gameType === gameType;

                return (
                  <div
                    key={onlineUser.userId}
                    className="flex items-center justify-between py-2 px-3 rounded-md border border-border/40 hover:border-border/80 transition-colors"
                  >
                    <UsernameDisplay username={onlineUser.username} usernameColor={onlineUser.usernameColor} className="text-sm" />
                    <Button
                      size="sm"
                      variant={isPending ? 'outline' : 'default'}
                      disabled={isPending}
                      onClick={() => {
                        challengeUserToDuel(onlineUser.userId, onlineUser.username, gameType);
                        onOpenChange(false);
                      }}
                    >
                      {isPending ? 'Envoyé...' : 'Défier'}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
