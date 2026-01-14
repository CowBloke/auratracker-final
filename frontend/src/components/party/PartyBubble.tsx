import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { Users, LogOut, Bomb, ChevronUp, ChevronDown, Gamepad2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PartyBubble() {
  const { user } = useAuth();
  const location = useLocation();
  const {
    currentParty,
    partyMembers,
    leaveParty,
    deleteParty,
    bombPartyGame,
  } = useSocket();

  const [expanded, setExpanded] = useState(true);

  // Don't show if not in a party
  if (!currentParty) return null;

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const gameStatus = bombPartyGame
    ? `En jeu - Round ${bombPartyGame.round}`
    : 'En attente';

  return (
    <div className="fixed bottom-6 right-20 z-50">
      <div className="bg-background border border-border rounded-lg shadow-lg overflow-hidden min-w-[200px] max-w-[280px]">
        {/* Header - always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">
              {currentParty.name || 'Party'}
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
        </button>

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
                        : "bg-green-500"
                    )}
                  />
                  <span
                    style={member.usernameColor ? { color: member.usernameColor } : undefined}
                    className={cn(
                      member.userId === user?.id && "font-medium"
                    )}
                  >
                    {member.username}
                    {member.isLeader && ' *'}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="px-3 py-2 border-t border-border/30 flex gap-2">
              {/* Go to game */}
              {bombPartyGame && location.pathname !== '/games/bomb-party' && (
                <Link
                  to="/games/bomb-party"
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors rounded"
                >
                  <Bomb className="h-3 w-3" />
                  Rejoindre
                </Link>
              )}

              {/* Leave or delete */}
              {isLeader ? (
                <button
                  onClick={deleteParty}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs border border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors rounded"
                >
                  <Trash2 className="h-3 w-3" />
                  Supprimer
                </button>
              ) : (
                <button
                  onClick={leaveParty}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs border border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors rounded"
                >
                  <LogOut className="h-3 w-3" />
                  Quitter
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
