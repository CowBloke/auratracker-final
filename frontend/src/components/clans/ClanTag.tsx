import { cn } from '@/lib/utils';

export interface ClanTagStyle {
  backgroundType: 'solid' | 'gradient';
  backgroundColor: string;
  backgroundGradient?: string | null; // JSON: {"from":"#hex","to":"#hex","direction":"to right"}
  textColor: string;
  borderColor: string;
}

export interface ClanTagData {
  text: string;
  style: ClanTagStyle;
}

export const DEFAULT_CLAN_TAG_STYLE: ClanTagStyle = {
  backgroundType: 'solid',
  backgroundColor: '#374151',
  textColor: '#ffffff',
  borderColor: '#6b7280',
};

export function parseClanTagStyle(styleJson: string | null | undefined): ClanTagStyle {
  if (!styleJson) return DEFAULT_CLAN_TAG_STYLE;
  try {
    return { ...DEFAULT_CLAN_TAG_STYLE, ...JSON.parse(styleJson) };
  } catch {
    return DEFAULT_CLAN_TAG_STYLE;
  }
}

/** Convert raw wire-format clan tag to ClanTagData for rendering. */
export function toClanTagData(raw: { text: string; style: string | null } | null | undefined): ClanTagData | null {
  if (!raw?.text) return null;
  return { text: raw.text, style: parseClanTagStyle(raw.style) };
}

function getClanTagBackground(style: ClanTagStyle): React.CSSProperties {
  if (style.backgroundType === 'gradient' && style.backgroundGradient) {
    try {
      const g = JSON.parse(style.backgroundGradient) as { from: string; to: string; direction: string };
      return { background: `linear-gradient(${g.direction ?? 'to right'}, ${g.from}, ${g.to})` };
    } catch {
      // fall through
    }
  }
  return { backgroundColor: style.backgroundColor };
}

interface ClanTagProps {
  tag: ClanTagData;
  className?: string;
}

export function ClanTag({ tag, className }: ClanTagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none flex-shrink-0 select-none',
        className,
      )}
      style={{
        ...getClanTagBackground(tag.style),
        color: tag.style.textColor,
        border: `1px solid ${tag.style.borderColor}`,
      }}
    >
      {tag.text}
    </span>
  );
}
