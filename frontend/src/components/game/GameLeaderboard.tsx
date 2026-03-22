import { cn } from '@/lib/utils';
import { Trophy, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserBadges } from '@/components/badges/UserBadges';
import type { BadgeData } from '@/components/badges/BadgeIcon';
import { ClanTag, toClanTagData } from '@/components/clans/ClanTag';
import { PlayerHoverCard } from '@/components/ui/player-hover-card';

export interface GameLeaderboardEntry {
  id: string;
  highScore: number;
  user: {
    id: string;
    username: string;
    usernameColor?: string | null;
    clanTag?: { text: string; style: string | null } | null;
  };
  badges?: BadgeData[];
}

interface GameLeaderboardProps {
  entries: GameLeaderboardEntry[];
  currentUserId?: string;
  personalHighScore?: number | null;
  isAdmin?: boolean;
  onDeleteScore?: (userId: string, username: string) => void;
  title?: string;
  maxHeight?: number | string;
  /** Hide the whole card (e.g. when fullscreen) */
  hidden?: boolean;
  /** Render only the list, without the Card wrapper (for embedding in tabbed panels) */
  noCard?: boolean;
}

function LeaderboardList({
  entries,
  currentUserId,
  isAdmin,
  onDeleteScore,
  maxHeight,
}: Pick<GameLeaderboardProps, 'entries' | 'currentUserId' | 'isAdmin' | 'onDeleteScore' | 'maxHeight'>) {
  if (entries.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        Aucun score enregistré
      </p>
    );
  }

  return (
    <div
      className="divide-y divide-border/20 overflow-y-auto"
      style={{ maxHeight }}
    >
      {entries.map((entry, index) => (
        <div
          key={entry.id}
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 group',
            entry.user.id === currentUserId && 'bg-muted/30',
          )}
        >
          <span
            className={cn(
              'w-5 text-center text-xs tabular-nums shrink-0',
              index === 0 ? 'text-yellow-500 font-bold' :
              index === 1 ? 'text-muted-foreground' :
              index === 2 ? 'text-amber-600 font-bold' : 'text-muted-foreground',
            )}
          >
            {index + 1}
          </span>
          <span className="flex-1 truncate text-sm flex items-center gap-1.5 min-w-0">
            {entry.badges && entry.badges.length > 0 && (
              <UserBadges
                badges={entry.badges}
                size="xs"
                showEmptySlots={false}
                tooltipSide="right"
              />
            )}
            <PlayerHoverCard
              userId={entry.user.id}
              username={entry.user.username}
              usernameColor={entry.user.usernameColor}
              clanTag={toClanTagData(entry.user.clanTag)}
            >
              <span
                className="truncate"
                style={entry.user.usernameColor ? { color: entry.user.usernameColor } : undefined}
              >
                {entry.user.username}
              </span>
              {entry.user.clanTag ? <ClanTag tag={toClanTagData(entry.user.clanTag)!} /> : null}
            </PlayerHoverCard>
            {entry.user.id === currentUserId && (
              <span className="text-xs text-muted-foreground shrink-0">(toi)</span>
            )}
          </span>
          <span className="font-mono text-sm tabular-nums text-muted-foreground shrink-0">
            {entry.highScore.toLocaleString()}
          </span>
          {isAdmin && onDeleteScore && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDeleteScore(entry.user.id, entry.user.username)}
              className="opacity-0 group-hover:opacity-100 h-6 w-6 text-destructive hover:bg-destructive/10 shrink-0"
              title="Supprimer ce score"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

export function GameLeaderboard({
  entries,
  currentUserId,
  personalHighScore,
  isAdmin,
  onDeleteScore,
  title = 'Classement',
  maxHeight = 420,
  hidden,
  noCard,
}: GameLeaderboardProps) {
  const recordDuJeu = entries.length > 0 ? entries[0].highScore : null;
  const recordPersonnelFromEntries = currentUserId
    ? entries.find((entry) => entry.user.id === currentUserId)?.highScore
    : null;
  const recordPersonnel = personalHighScore ?? recordPersonnelFromEntries ?? null;

  const recordsSummary = (
    <div className="grid grid-cols-2 gap-2 border-b border-border/20 px-4 py-3">
      <div className="rounded-md bg-muted/40 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Record perso</p>
        <p className="text-sm font-medium tabular-nums">
          {recordPersonnel !== null ? recordPersonnel.toLocaleString() : '--'}
        </p>
      </div>
      <div className="rounded-md bg-muted/40 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Record du jeu</p>
        <p className="text-sm font-medium tabular-nums">
          {recordDuJeu !== null ? recordDuJeu.toLocaleString() : '--'}
        </p>
      </div>
    </div>
  );

  const list = (
    <LeaderboardList
      entries={entries}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
      onDeleteScore={onDeleteScore}
      maxHeight={maxHeight}
    />
  );

  if (noCard) {
    return (
      <>
        {recordsSummary}
        {list}
      </>
    );
  }

  return (
    <Card className={cn(hidden && 'hidden')}>
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {recordsSummary}
        {list}
      </CardContent>
    </Card>
  );
}
