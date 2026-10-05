import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserBadges } from '@/components/badges/UserBadges';
import type { BadgeData } from '@/components/badges/BadgeIcon';
import { ClanTag, toClanTagData } from '@/components/clans/ClanTag';
import { PlayerHoverCard } from '@/components/ui/player-hover-card';
import { useHideGameLeaderboards } from '@/lib/game-preferences';
import { useAppDialog } from '@/contexts/AppDialogContext';

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
  scoreFormatter?: (value: number) => string;
  isAdmin?: boolean;
  onDeleteScore?: (userId: string, username: string) => void | Promise<void>;
  title?: string;
  maxHeight?: number | string;
  /** Masque toute la carte (ex. en plein écran). */
  hidden?: boolean;
  /** Affiche uniquement la liste, sans la carte (pour l'intégrer dans un panneau à onglets). */
  noCard?: boolean;
}

function LeaderboardList({
  entries,
  currentUserId,
  scoreFormatter,
  isAdmin,
  onDeleteScore,
  maxHeight,
}: Pick<GameLeaderboardProps, 'entries' | 'currentUserId' | 'scoreFormatter' | 'isAdmin' | 'onDeleteScore' | 'maxHeight'>) {
  const { confirm } = useAppDialog();

  const handleDeleteClick = async (userId: string, username: string) => {
    if (!onDeleteScore) return;

    const confirmed = await confirm({
      title: 'Supprimer le score',
      description: `Supprimer le score de ${username} ?`,
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      variant: 'destructive',
    });
    if (!confirmed) return;

    await onDeleteScore(userId, username);
  };

  if (entries.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Aucun score</EmptyTitle>
          <EmptyDescription>Soyez le premier à entrer au classement.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ScrollArea style={{ maxHeight }}>
      <Table>
        <TableBody>
          {entries.map((entry, index) => (
            <TableRow key={entry.id} data-state={entry.user.id === currentUserId ? 'selected' : undefined}>
              <TableCell className="w-10 text-center tabular-nums text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="max-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  {entry.badges && entry.badges.length > 0 ? (
                    <UserBadges badges={entry.badges} size="xs" showEmptySlots={false} tooltipSide="right" />
                  ) : null}
                  <PlayerHoverCard
                    userId={entry.user.id}
                    username={entry.user.username}
                    usernameColor={entry.user.usernameColor}
                    clanTag={toClanTagData(entry.user.clanTag)}
                  >
                    <span className="truncate" style={entry.user.usernameColor ? { color: entry.user.usernameColor } : undefined}>
                      {entry.user.username}
                    </span>
                    {entry.user.clanTag ? <ClanTag tag={toClanTagData(entry.user.clanTag)!} /> : null}
                  </PlayerHoverCard>
                  {entry.user.id === currentUserId ? (
                    <span className="shrink-0 text-xs text-muted-foreground">(vous)</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {scoreFormatter ? scoreFormatter(entry.highScore) : entry.highScore.toLocaleString()}
              </TableCell>
              {isAdmin && onDeleteScore ? (
                <TableCell className="w-10 p-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Supprimer ce score"
                        onClick={() => void handleDeleteClick(entry.user.id, entry.user.username)}
                      >
                        <X />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Supprimer ce score</TooltipContent>
                  </Tooltip>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

export function GameLeaderboard({
  entries,
  currentUserId,
  personalHighScore,
  scoreFormatter,
  isAdmin,
  onDeleteScore,
  title = 'Classement',
  maxHeight = 420,
  hidden,
  noCard,
}: GameLeaderboardProps) {
  const hideGameLeaderboards = useHideGameLeaderboards();

  if (hideGameLeaderboards || hidden) {
    return null;
  }

  const list = (
    <LeaderboardList
      entries={entries}
      currentUserId={currentUserId}
      scoreFormatter={scoreFormatter}
      isAdmin={isAdmin}
      onDeleteScore={onDeleteScore}
      maxHeight={maxHeight}
    />
  );

  if (noCard) return list;

  const format = (value: number | null) =>
    value === null ? '--' : scoreFormatter ? scoreFormatter(value) : value.toLocaleString();
  const record = entries.length > 0 ? entries[0].highScore : null;
  const personal =
    personalHighScore ?? (currentUserId ? entries.find((entry) => entry.user.id === currentUserId)?.highScore : null) ?? null;

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="flex gap-4">
          <span>
            Perso <span className="font-mono text-foreground">{format(personal)}</span>
          </span>
          <span>
            Top <span className="font-mono text-foreground">{format(record)}</span>
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">{list}</CardContent>
    </Card>
  );
}
