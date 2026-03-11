import { type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { PublicBadge } from '@/services/api';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

const getBadgeLabel = (badge: PublicBadge) => {
  const label = typeof badge.style?.label === 'string' ? badge.style.label.trim() : '';
  return label || badge.name;
};

const buildBadgeStyle = (badge: PublicBadge): { className: string; style: CSSProperties } => {
  const type = badge.style?.type ?? 'GRADIENT';

  const borderRadius = typeof badge.style?.borderRadius === 'number' ? badge.style.borderRadius : 999;
  const borderWidth = typeof badge.style?.borderWidth === 'number' ? badge.style.borderWidth : 1;
  const paddingX = typeof badge.style?.paddingX === 'number' ? badge.style.paddingX : 6;
  const paddingY = typeof badge.style?.paddingY === 'number' ? badge.style.paddingY : 2;
  const fontSize = typeof badge.style?.fontSize === 'number' ? badge.style.fontSize : 10;

  const style: CSSProperties = {
    borderRadius,
    borderWidth,
    paddingLeft: paddingX,
    paddingRight: paddingX,
    paddingTop: paddingY,
    paddingBottom: paddingY,
    fontSize,
  };

  if (badge.style?.textColor) {
    style.color = badge.style.textColor as string;
  }

  if (badge.style?.borderColor) {
    style.borderColor = badge.style.borderColor as string;
  }

  if (type === 'IMAGE' && badge.style?.imageUrl) {
    style.backgroundImage = `url(${badge.style.imageUrl})`;
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
  } else if (type === 'SOLID' && badge.style?.backgroundColor) {
    style.backgroundColor = badge.style.backgroundColor as string;
  } else if (badge.style?.gradient) {
    style.backgroundImage = badge.style.gradient as string;
  }

  return {
    className:
      'inline-flex shrink-0 items-center justify-center border border-border/70 bg-muted/40 font-semibold leading-none shadow-sm',
    style,
  };
};

export function UserBadgesInline({ badges, className }: { badges: PublicBadge[]; className?: string }) {
  if (!badges || badges.length === 0) return null;
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {badges.slice(0, 2).map((badge) => (
        <UserBadgeChip key={badge.id} badge={badge} />
      ))}
    </span>
  );
}

export function UserBadgeChip({ badge }: { badge: PublicBadge }) {
  const label = getBadgeLabel(badge);
  const { className, style } = buildBadgeStyle(badge);

  return (
    <HoverCard openDelay={250}>
      <HoverCardTrigger asChild>
        <span className={cn(className, 'cursor-help')} style={style}>
          {label}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold leading-tight">{badge.name}</p>
            {badge.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{badge.description}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Badge</p>
            )}
          </div>
          <span className={cn(className, 'mt-0.5')} style={style}>
            {label}
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

