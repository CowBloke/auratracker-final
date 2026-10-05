import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Item, ItemContent, ItemMedia } from '@/components/ui/item';
import { Spinner } from '@/components/ui/spinner';
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
        <Item size="sm" className="rounded-none border-b">
          <ItemMedia>
            <Avatar className="size-10">
              <AvatarImage src={profilePicture ? resolveImageUrl(profilePicture) : undefined} alt={username} />
              <AvatarFallback>{username.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent>
            <UsernameDisplay
              username={username}
              usernameColor={usernameColor}
              firstName={firstName}
              clanTag={clanTag}
              usernameClassName="font-medium text-sm"
            />
          </ItemContent>
        </Item>

        {/* Badges */}
        <div className="px-4 py-3">
          {badges === null ? (
            <div className="flex justify-center py-2">
              <Spinner />
            </div>
          ) : badges.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-1">Aucun badge</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground/60 mb-2 font-medium ">
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
