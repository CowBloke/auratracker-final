import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePartySocket } from '@/contexts/PartySocketContext';
import { useGameSocket } from '@/contexts/GameSocketContext';
import { useChatSocket } from '@/contexts/ChatSocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { Users, LogOut, Bomb, ChevronUp, ChevronDown, Gamepad2, Trash2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UsernameDisplay } from '@/components/ui/username-display';

export default function PartyBubble() {
  const { user } = useAuth();
  const location = useLocation();
  const { currentParty, partyMembers, leaveParty, deleteParty } = usePartySocket();
  const { bombPartyGame, petitBacGame } = useGameSocket();
  const { sendMessage } = useChatSocket();

  const [expanded, setExpanded] = useState(true);

  // Don't show if not in a party
  if (!currentParty) return null;

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const gameStatus = bombPartyGame
    ? `Bombe de mots - Manche ${bombPartyGame.round}`
    : petitBacGame
      ? `Petit Bac - Manche ${petitBacGame.round}/${petitBacGame.maxRounds}`
      : 'En attente';
  const inviteLabel = currentParty.name ? `Rejoins ${currentParty.name}` : 'Rejoins mon groupe';
  const inviteVisibility = currentParty.isPublic ? 'public' : 'private';

  const sendChatInvite = () => {
    sendMessage(`[[party-invite:${currentParty.id}:${inviteVisibility}]]${inviteLabel}`);
  };

  return (
    <Card className="min-w-[200px] max-w-[280px] overflow-hidden shadow-lg">
      <CardContent className="p-0">
        {/* Header - always visible */}
        <Button
          type="button"
          onClick={() => setExpanded(!expanded)}
          variant="ghost"
          className="h-auto w-full justify-between rounded-none px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">
              {currentParty.name || 'Groupe'}
            </span>
            <span className="text-xs text-muted-foreground">
              ({partyMembers.length}/{currentParty.maxSize})
            </span>
          </div>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t border-border/50">
            {/* Game Status */}
            <div className="px-4 py-2 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{gameStatus}</span>
              </div>
            </div>

            {/* Members */}
            <div className="px-4 py-2 space-y-1 max-h-32 overflow-y-auto">
              {partyMembers.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-2 text-xs"
                >
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      bombPartyGame?.currentPlayerId === member.userId
                        ? "bg-yellow-500"
                        : petitBacGame
                          ? (petitBacGame.players.find((p) => p.userId === member.userId)?.submitted
                              ? "bg-green-500"
                              : "bg-yellow-500")
                          : "bg-green-500"
                    )}
                  />
                  <span className={cn(member.userId === user?.id && "font-medium")}>
                    <UsernameDisplay
                      username={member.username}
                      usernameColor={member.usernameColor}
                    />
                    {member.isLeader && ' *'}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="px-3 py-2 border-t border-border/30 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={sendChatInvite}
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                title="Inviter via le chat"
              >
                <UserPlus className="h-3 w-3" />
                Inviter
              </Button>
              {/* Go to game */}
              {bombPartyGame && location.pathname !== '/games/bomb-party' && (
                <Button asChild size="sm" className="h-7 flex-1 gap-1 px-2 text-xs">
                  <Link to="/games/bomb-party">
                    <Bomb className="h-3 w-3" />
                    Rejoindre
                  </Link>
                </Button>
              )}
              {petitBacGame && location.pathname !== '/games/petit-bac' && (
                <Button asChild size="sm" className="h-7 flex-1 gap-1 px-2 text-xs">
                  <Link to="/games/petit-bac">
                    <Gamepad2 className="h-3 w-3" />
                    Rejoindre
                  </Link>
                </Button>
              )}

              {/* Leave or delete */}
              {isLeader ? (
                <Button
                  type="button"
                  onClick={deleteParty}
                  variant="destructive"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Trash2 className="h-3 w-3" />
                  Supprimer
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={leaveParty}
                  variant="destructive"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <LogOut className="h-3 w-3" />
                  Quitter
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
