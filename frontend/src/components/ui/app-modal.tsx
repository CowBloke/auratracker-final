import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Token system ─────────────────────────────────────────────────────────────

export type AppModalTone =
  | 'aura'
  | 'money'
  | 'cyan'
  | 'pink'
  | 'orange'
  | 'green'
  | 'red'
  | 'blue'
  | 'neutral';

export const TONES: Record<AppModalTone, { fg: string; bg: string; ring: string }> = {
  aura:    { fg: '#a855f7', bg: 'rgba(168,85,247,0.14)',  ring: 'rgba(168,85,247,0.35)'  },
  money:   { fg: '#fbbf24', bg: 'rgba(251,191,36,0.13)',  ring: 'rgba(251,191,36,0.32)'  },
  cyan:    { fg: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  ring: 'rgba(34,211,238,0.30)'  },
  pink:    { fg: '#f472b6', bg: 'rgba(244,114,182,0.13)', ring: 'rgba(244,114,182,0.32)' },
  orange:  { fg: '#fb923c', bg: 'rgba(251,146,60,0.13)',  ring: 'rgba(251,146,60,0.32)'  },
  green:   { fg: '#4ade80', bg: 'rgba(74,222,128,0.13)',  ring: 'rgba(74,222,128,0.32)'  },
  red:     { fg: '#f87171', bg: 'rgba(248,113,113,0.14)', ring: 'rgba(248,113,113,0.34)' },
  blue:    { fg: '#60a5fa', bg: 'rgba(96,165,250,0.13)',  ring: 'rgba(96,165,250,0.32)'  },
  neutral: { fg: 'hsl(var(--foreground))', bg: 'hsl(var(--muted))', ring: 'hsl(var(--border))' },
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export type AppModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<AppModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

interface AppModalProps {
  open: boolean;
  onClose: () => void;
  tone?: AppModalTone;
  accent?: string | false;
  size?: AppModalSize;
  className?: string;
  children: React.ReactNode;
  description?: string;
}

function AppModalRoot({
  open,
  onClose,
  tone,
  accent,
  size = 'md',
  className,
  children,
  description,
}: AppModalProps) {
  const accentColor =
    accent === false
      ? null
      : accent ?? (tone && tone !== 'neutral' ? TONES[tone].fg : null);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={description ? 'app-modal-desc' : 'app-modal-no-desc'}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[calc(100vw-2rem)]',
            SIZE_CLASS[size],
            'max-h-[calc(100dvh-2rem)] overflow-hidden',
            'rounded-2xl border bg-card text-foreground',
            'duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            className,
          )}
          style={{
            boxShadow:
              '0 24px 60px -20px rgba(0,0,0,0.4), 0 0 0 1px hsl(var(--border) / 0.5) inset',
          }}
        >
          {accentColor && (
            <div
              className="pointer-events-none absolute left-0 right-0 top-0 h-px opacity-80"
              style={{
                background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
              }}
            />
          )}
          {description ? (
            <DialogPrimitive.Description id="app-modal-desc" className="sr-only">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <span id="app-modal-no-desc" className="sr-only" />
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

interface AppModalHeaderProps {
  icon?: React.ReactElement;
  iconSlot?: React.ReactNode;
  tone?: AppModalTone;
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  compact?: boolean;
  hideClose?: boolean;
}

function AppModalHeader({
  icon,
  iconSlot,
  tone = 'neutral',
  eyebrow,
  title,
  subtitle,
  compact,
  hideClose,
}: AppModalHeaderProps) {
  const t = TONES[tone];
  return (
    <div
      className={cn(
        'flex items-start gap-3',
        compact ? 'px-3.5 pb-2.5 pt-3.5' : 'px-4 pb-3 pt-4',
      )}
    >
      {(icon || iconSlot) && (
        iconSlot ? (
          <div className="flex-shrink-0">{iconSlot}</div>
        ) : (
          <div
            className="grid flex-shrink-0 place-items-center"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: t.bg,
              color: t.fg,
              boxShadow: `inset 0 0 0 1px ${t.ring}`,
            }}
          >
            {icon
              ? React.cloneElement(icon, { size: 18, strokeWidth: 2 } as Record<string, unknown>)
              : null}
          </div>
        )
      )}

      <div className="min-w-0 flex-1 pt-0.5">
        {eyebrow && (
          <div
            className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.05em]"
            style={{ color: t.fg }}
          >
            {eyebrow}
          </div>
        )}
        <DialogPrimitive.Title className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          {title}
        </DialogPrimitive.Title>
        {subtitle && (
          <div className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>

      {!hideClose && (
        <DialogPrimitive.Close className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

// ─── Body ─────────────────────────────────────────────────────────────────────

interface AppModalBodyProps {
  children: React.ReactNode;
  className?: string;
  scrollable?: boolean;
  maxHeight?: string;
}

function AppModalBody({ children, className, scrollable, maxHeight = '60vh' }: AppModalBodyProps) {
  return (
    <div
      className={cn('px-4 pb-3.5', scrollable && 'overflow-y-auto', className)}
      style={scrollable ? { maxHeight } : undefined}
    >
      {children}
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

interface AppModalFooterProps {
  children: React.ReactNode;
  left?: React.ReactNode;
  className?: string;
}

function AppModalFooter({ children, left, className }: AppModalFooterProps) {
  return (
    <div
      className={cn('flex items-center gap-2 border-t bg-muted/30 px-3.5 py-3', className)}
    >
      {left && (
        <div className="mr-auto text-[11.5px] text-muted-foreground/60">{left}</div>
      )}
      {children}
    </div>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

function AppModalDivider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-border', className)} />;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

interface AppModalTabDef {
  id: string;
  label: string;
  icon?: React.ReactElement;
  badge?: string | number;
  badgeTone?: AppModalTone;
}

interface AppModalTabsProps {
  tabs: AppModalTabDef[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

function AppModalTabs({ tabs, value, onChange, className }: AppModalTabsProps) {
  return (
    <div className={cn('flex gap-1 px-3.5 pb-2.5', className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === value;
        const badgeTone = TONES[tab.badgeTone ?? 'money'];
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex h-[30px] items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              isActive
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.icon &&
              React.cloneElement(tab.icon, {
                size: 13,
                strokeWidth: 2.2,
              } as Record<string, unknown>)}
            {tab.label}
            {tab.badge !== undefined && (
              <span
                className="rounded-full px-[5px] py-px text-[10.5px] leading-none"
                style={{
                  color: badgeTone.fg,
                  background: badgeTone.bg,
                  boxShadow: `inset 0 0 0 1px ${badgeTone.ring}`,
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Sidebar layout ───────────────────────────────────────────────────────────

function AppModalSidebarLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('grid border-t', className)}
      style={{ gridTemplateColumns: '160px 1fr' }}
    >
      {children}
    </div>
  );
}

function AppModalSidebarNav({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-px border-r p-2', className)}>
      {children}
    </div>
  );
}

function AppModalSidebarContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('min-w-0 p-4', className)}>{children}</div>;
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface AppModalRowProps {
  icon?: React.ReactElement;
  tone?: AppModalTone;
  title: React.ReactNode;
  sub?: React.ReactNode;
  meta?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  chevron?: boolean;
  className?: string;
}

function AppModalRow({
  icon,
  tone = 'neutral',
  title,
  sub,
  meta,
  right,
  onClick,
  active,
  chevron,
  className,
}: AppModalRowProps) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
        onClick ? 'cursor-pointer' : 'cursor-default',
        active
          ? 'bg-accent'
          : onClick
          ? 'hover:bg-accent/60'
          : '',
        className,
      )}
    >
      {icon && (
        <div
          className="grid flex-shrink-0 place-items-center"
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: t.bg,
            color: t.fg,
            boxShadow: `inset 0 0 0 1px ${t.ring}`,
          }}
        >
          {React.cloneElement(icon, { size: 13, strokeWidth: 2.2 } as Record<string, unknown>)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium text-foreground">{title}</div>
        {sub && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
        )}
      </div>
      {meta && (
        <div className="flex-shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {meta}
        </div>
      )}
      {right}
      {chevron && (
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/30" />
      )}
    </button>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

interface AppModalFieldProps {
  label?: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  type?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
}

function AppModalField({
  label,
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
  type = 'text',
  rows,
  disabled,
  className,
}: AppModalFieldProps) {
  const sharedInputStyle: React.CSSProperties = {
    background: 'transparent',
    outline: 'none',
    color: 'var(--foreground)',
    fontSize: 13,
    fontFamily: 'inherit',
    width: '100%',
    minWidth: 0,
  };

  return (
    <label className={cn('block', className)}>
      {label && (
        <div className="mb-1.5 text-[11.5px] font-medium tracking-[0.01em] text-muted-foreground">
          {label}
        </div>
      )}
      <div
        className={cn(
          'flex items-center gap-2 rounded-[9px] border border-input bg-muted/50 px-2.5 transition-colors',
          rows ? 'py-2' : 'h-9',
          'focus-within:border-ring/50',
        )}
      >
        {prefix && (
          <span className="flex-shrink-0 text-[12.5px] text-muted-foreground">
            {prefix}
          </span>
        )}
        {rows ? (
          <textarea
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            style={{
              ...sharedInputStyle,
              resize: 'none',
              lineHeight: '1.5',
            }}
            className="placeholder:text-muted-foreground/40"
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            style={sharedInputStyle}
            className="flex-1 placeholder:text-muted-foreground/40"
          />
        )}
        {suffix && (
          <span className="flex-shrink-0 text-[12px] text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

interface AppModalChipProps {
  children: React.ReactNode;
  tone?: AppModalTone;
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactElement;
}

function AppModalChip({ children, tone = 'neutral', active, onClick, icon }: AppModalChipProps) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      style={
        active
          ? { background: t.bg, color: t.fg, boxShadow: `inset 0 0 0 1px ${t.ring}` }
          : {
              background: 'transparent',
              color: 'var(--muted-foreground)',
              boxShadow: 'inset 0 0 0 1px hsl(var(--border))',
            }
      }
    >
      {icon &&
        React.cloneElement(icon, { size: 11, strokeWidth: 2.2 } as Record<string, unknown>)}
      {children}
    </button>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

interface AppModalToggleProps {
  on: boolean;
  onChange?: (on: boolean) => void;
  tone?: AppModalTone;
}

function AppModalToggle({ on, onChange, tone = 'aura' }: AppModalToggleProps) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange?.(!on)}
      className="flex-shrink-0 rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      style={{
        width: 32,
        height: 18,
        background: on ? t.fg : 'hsl(var(--input))',
      }}
    >
      <div
        className="h-3.5 w-3.5 rounded-full bg-white transition-transform duration-150"
        style={{ transform: `translateX(${on ? 14 : 0}px)` }}
      />
    </button>
  );
}

// ─── IconTile ─────────────────────────────────────────────────────────────────

interface AppModalIconTileProps {
  tone?: AppModalTone;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactElement;
}

function AppModalIconTile({ tone = 'neutral', size = 'md', children }: AppModalIconTileProps) {
  const t = TONES[tone];
  const dim = size === 'sm' ? 26 : size === 'lg' ? 42 : 34;
  const radius = size === 'sm' ? 7 : size === 'lg' ? 12 : 10;
  const iconSize = size === 'sm' ? 13 : size === 'lg' ? 20 : 18;
  return (
    <div
      className="grid flex-shrink-0 place-items-center"
      style={{
        width: dim,
        height: dim,
        borderRadius: radius,
        background: t.bg,
        color: t.fg,
        boxShadow: `inset 0 0 0 1px ${t.ring}`,
      }}
    >
      {React.cloneElement(children, { size: iconSize, strokeWidth: 2 } as Record<string, unknown>)}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

interface AppModalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: AppModalTone;
  variant?: 'solid' | 'soft' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactElement;
  full?: boolean;
}

function AppModalButton({
  tone = 'neutral',
  variant = 'ghost',
  size = 'md',
  icon,
  full,
  children,
  className,
  style,
  disabled,
  ...rest
}: AppModalButtonProps) {
  const t = TONES[tone];

  const heights: Record<string, number> = { sm: 28, md: 32, lg: 38 };
  const paddings: Record<string, string> = { sm: '0 10px', md: '0 12px', lg: '0 16px' };
  const fontSizes: Record<string, number> = { sm: 12, md: 12.5, lg: 13.5 };

  let bg = 'transparent';
  let color = 'var(--muted-foreground)';
  let boxShadow = 'inset 0 0 0 1px hsl(var(--border))';

  if (variant === 'solid') {
    bg = tone === 'neutral' ? 'hsl(var(--foreground))' : t.fg;
    color = 'hsl(var(--background))';
    boxShadow = 'none';
  } else if (variant === 'soft') {
    bg = t.bg;
    color = t.fg;
    boxShadow = `inset 0 0 0 1px ${t.ring}`;
  } else if (variant === 'ghost') {
    bg = 'transparent';
    color = 'var(--muted-foreground)';
    boxShadow = 'inset 0 0 0 1px hsl(var(--border))';
  } else if (variant === 'outline') {
    bg = 'transparent';
    color = t.fg;
    boxShadow = `inset 0 0 0 1px ${t.ring}`;
  }

  const iconSize = size === 'sm' ? 13 : 14;

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-[9px] font-semibold tracking-[-0.005em] transition-opacity',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        'hover:opacity-80 active:opacity-60',
        disabled && 'cursor-not-allowed opacity-50',
        full && 'w-full',
        className,
      )}
      style={{
        height: heights[size],
        padding: paddings[size],
        fontSize: fontSizes[size],
        background: bg,
        color,
        boxShadow,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      {...rest}
    >
      {icon &&
        React.cloneElement(icon, {
          size: iconSize,
          strokeWidth: 2.2,
        } as Record<string, unknown>)}
      {children}
    </button>
  );
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────

function AppModalSectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground/50',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─── Compound export ──────────────────────────────────────────────────────────

export const AppModal = Object.assign(AppModalRoot, {
  Header: AppModalHeader,
  Body: AppModalBody,
  Footer: AppModalFooter,
  Divider: AppModalDivider,
  Tabs: AppModalTabs,
  Row: AppModalRow,
  Field: AppModalField,
  Chip: AppModalChip,
  Toggle: AppModalToggle,
  Button: AppModalButton,
  IconTile: AppModalIconTile,
  SidebarLayout: AppModalSidebarLayout,
  SidebarNav: AppModalSidebarNav,
  SidebarContent: AppModalSidebarContent,
  SectionTitle: AppModalSectionTitle,
  tones: TONES,
});
