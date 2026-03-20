import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { BadgeIcon } from '@/components/badges/BadgeIcon';
import { UsernameDisplay } from '@/components/ui/username-display';
import { badgesApi } from '@/services/api';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import type { ClanTagData } from '@/components/clans/ClanTag';
import type { BadgeData } from '@/components/badges/BadgeIcon';

const RARITY_ORDER: Record<string, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  uncommon: 3,
  common: 4,
};

interface PlayerHoverCardProps {
  userId: string;
  username: string;
  usernameColor?: string | null;
  firstName?: string | null;
  clanTag?: ClanTagData | null;
  /** Profile picture URL – if absent, initials are shown */
  profilePicture?: string | null;
  children: React.ReactNode;
  /** Extra classes applied to the clickable trigger wrapper */
  className?: string;
}

export function PlayerHoverCard({
  userId,
  username,
  usernameColor,
  firstName,
  clanTag,
  profilePicture,
  children,
  className,
}: PlayerHoverCardProps) {
  const navigate = useNavigate();
  const [badges, setBadges] = useState<BadgeData[] | null>(null);
  const fetchedRef = useRef(false);

  const handleOpenChange = async (open: boolean) => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    try {
      const res = await badgesApi.getUserBadges(userId);
      const sorted = [...res.data.badges]
        .sort((a, b) => (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99))
        .slice(0, 10);
      setBadges(sorted as BadgeData[]);
    } catch {
      setBadges([]);
    }
  };

  return (
    <HoverCard openDelay={400} closeDelay={150} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>
        <span
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/profile/${userId}`);
          }}
          className={cn('cursor-pointer inline-flex items-baseline gap-1', className)}
        >
          {children}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 p-0" align="start">
        {/* Profile header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
          {profilePicture ? (
            <img
              src={resolveImageUrl(profilePicture)}
              alt={username}
              className="h-10 w-10 rounded-full object-cover flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-muted-foreground">
                {username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <UsernameDisplay
              username={username}
              usernameColor={usernameColor}
              firstName={firstName}
              clanTag={clanTag}
              usernameClassName="font-medium text-sm"
            />
          </div>
        </div>

        {/* Badges */}
        <div className="px-4 py-3">
          {badges === null ? (
            <div className="flex justify-center py-2">
              <div className="w-1 h-4 bg-foreground/20 animate-pulse" />
            </div>
          ) : badges.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-1">Aucun badge</p>
          ) : (
            <>
              <p className="text-[10px] text-muted-foreground/60 mb-2 font-medium uppercase tracking-wide">
                Top badges
              </p>
              <div className="flex flex-wrap gap-1.5">
                {badges.map((badge) => (
                  <BadgeIcon key={badge.id} badge={badge} size="sm" tooltipSide="top" />
                ))}
              </div>
            </>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
