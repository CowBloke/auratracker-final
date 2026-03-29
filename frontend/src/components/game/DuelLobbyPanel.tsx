import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UsernameDisplay } from '@/components/ui/username-display';
import { cn } from '@/lib/utils';

interface LobbyMember {
  userId: string;
  username: string;
  usernameColor?: string | null;
  isLeader: boolean;
}

interface DuelLobbyPanelProps {
  members: LobbyMember[];
  currentUserId?: string;
  title: string;
  minimumPlayers: number;
  requireExactPlayers?: boolean;
  isLeader?: boolean;
  notEnoughPlayersText: string;
  waitingForLeaderText?: string;
  onStart?: () => void;
  startLabel?: string;
}

export function DuelLobbyPanel({
  members,
  currentUserId,
  title,
  minimumPlayers,
  requireExactPlayers = true,
  isLeader = false,
  notEnoughPlayersText,
  waitingForLeaderText = 'En attente que le leader lance la partie...',
  onStart,
  startLabel = 'Lancer la partie',
}: DuelLobbyPanelProps) {
  const canStart = requireExactPlayers ? members.length === minimumPlayers : members.length >= minimumPlayers;

  return (
    <>
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-sm text-muted-foreground">{title}</h2>
          <div className="space-y-0">
            {members.map((member) => (
              <div
                key={member.userId}
                className={cn(
                  'flex items-center justify-between py-4 border-b border-border/30 last:border-0',
                  member.userId === currentUserId && 'bg-muted/30 -mx-4 px-4'
                )}
              >
                <span className="font-medium">
                  <UsernameDisplay username={member.username} usernameColor={member.usernameColor} />
                  {member.isLeader && <span className="ml-2 text-xs text-muted-foreground">leader</span>}
                  {member.userId === currentUserId && <span className="ml-2 text-xs text-muted-foreground">(toi)</span>}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!canStart && (
        <p className="text-center text-muted-foreground text-sm">{notEnoughPlayersText}</p>
      )}

      {isLeader && canStart && onStart && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={onStart}
            className="flex items-center gap-3 px-8 py-4 text-lg border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
          >
            <Play className="h-5 w-5" />
            {startLabel}
          </Button>
        </div>
      )}

      {!isLeader && canStart && (
        <div className="text-center text-muted-foreground py-8">{waitingForLeaderText}</div>
      )}
    </>
  );
}
