import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Modale applicative : fine couche de composition au-dessus de Dialog, Item, Field et Button (shadcn).
 * Les teintes (`tone`) sont conservées pour la compatibilité d'API mais n'influent que sur la sémantique
 * des boutons (rouge = destructif) : l'interface reste neutre.
 */

export type AppModalTone = 'aura' | 'money' | 'cyan' | 'pink' | 'orange' | 'green' | 'red' | 'blue' | 'neutral';
export type AppModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<AppModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
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

function AppModalRoot({ open, onClose, size = 'md', className, children, description }: AppModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn('max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0', SIZE_CLASS[size], className)}>
        {description ? <DialogDescription className="sr-only">{description}</DialogDescription> : null}
        {children}
      </DialogContent>
    </Dialog>
  );
}

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

function AppModalHeader({ icon, iconSlot, eyebrow, title, subtitle }: AppModalHeaderProps) {
  return (
    <DialogHeader className="flex-row items-start gap-3 p-4 pr-12 text-left">
      {iconSlot ? (
        <div className="shrink-0">{iconSlot}</div>
      ) : icon ? (
        <ItemMedia variant="icon">{icon}</ItemMedia>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {eyebrow ? <span className="text-xs font-medium text-muted-foreground">{eyebrow}</span> : null}
        <DialogTitle className="text-base">{title}</DialogTitle>
        {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
      </div>
    </DialogHeader>
  );
}

interface AppModalBodyProps {
  children: React.ReactNode;
  className?: string;
  scrollable?: boolean;
  maxHeight?: string;
}

function AppModalBody({ children, className, scrollable, maxHeight = '60vh' }: AppModalBodyProps) {
  return (
    <div className={cn('px-4 pb-4', scrollable && 'overflow-y-auto', className)} style={scrollable ? { maxHeight } : undefined}>
      {children}
    </div>
  );
}

interface AppModalFooterProps {
  children: React.ReactNode;
  left?: React.ReactNode;
  className?: string;
}

function AppModalFooter({ children, left, className }: AppModalFooterProps) {
  return (
    <DialogFooter className={cn('items-center border-t p-4', className)}>
      {left ? <div className="mr-auto text-xs text-muted-foreground">{left}</div> : null}
      {children}
    </DialogFooter>
  );
}

function AppModalDivider({ className }: { className?: string }) {
  return <Separator className={className} />;
}

function AppModalSidebarNav({ children, className }: { children: React.ReactNode; className?: string }) {
  return <nav className={cn('flex flex-col gap-1 border-r p-2', className)}>{children}</nav>;
}

function AppModalSidebarContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('min-w-0 p-4', className)}>{children}</div>;
}

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

function AppModalRow({ icon, title, sub, meta, right, onClick, active, className }: AppModalRowProps) {
  const content = (
    <>
      {icon ? <ItemMedia variant="icon">{icon}</ItemMedia> : null}
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        {sub ? <ItemDescription>{sub}</ItemDescription> : null}
      </ItemContent>
      {meta || right ? (
        <ItemActions>
          {meta ? <span className="text-xs tabular-nums text-muted-foreground">{meta}</span> : null}
          {right}
        </ItemActions>
      ) : null}
    </>
  );

  return onClick ? (
    <Item asChild size="sm" variant={active ? 'muted' : 'default'} className={className}>
      <button type="button" onClick={onClick} className="w-full text-left">
        {content}
      </button>
    </Item>
  ) : (
    <Item size="sm" variant={active ? 'muted' : 'default'} className={className}>
      {content}
    </Item>
  );
}

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

function AppModalField({ label, value, onChange, placeholder, prefix, suffix, type = 'text', rows, disabled, className }: AppModalFieldProps) {
  const id = React.useId();
  return (
    <Field className={className}>
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
      {rows ? (
        <Textarea id={id} value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} rows={rows} disabled={disabled} />
      ) : prefix || suffix ? (
        <InputGroup>
          {prefix ? (
            <InputGroupAddon>
              <InputGroupText>{prefix}</InputGroupText>
            </InputGroupAddon>
          ) : null}
          <InputGroupInput id={id} type={type} value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} disabled={disabled} />
          {suffix ? (
            <InputGroupAddon align="inline-end">
              <InputGroupText>{suffix}</InputGroupText>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      ) : (
        <Input id={id} type={type} value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} disabled={disabled} />
      )}
    </Field>
  );
}

interface AppModalButtonProps extends Omit<React.ComponentProps<typeof Button>, 'variant' | 'size'> {
  tone?: AppModalTone;
  variant?: 'solid' | 'soft' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactElement;
  full?: boolean;
}

function AppModalButton({ tone = 'neutral', variant = 'ghost', size = 'md', icon, full, children, className, ...rest }: AppModalButtonProps) {
  const destructive = tone === 'red' && (variant === 'solid' || variant === 'soft');
  const mapped = destructive ? 'destructive' : variant === 'solid' ? 'default' : variant === 'soft' ? 'secondary' : 'outline';
  return (
    <Button type="button" variant={mapped} size={size === 'md' ? 'default' : size} className={cn(full && 'w-full', className)} {...rest}>
      {icon}
      {children}
    </Button>
  );
}

function AppModalSectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h4 className={cn('mb-2 text-sm font-medium text-muted-foreground', className)}>{children}</h4>;
}

export const AppModal = Object.assign(AppModalRoot, {
  Header: AppModalHeader,
  Body: AppModalBody,
  Footer: AppModalFooter,
  Divider: AppModalDivider,
  Row: AppModalRow,
  Field: AppModalField,
  Button: AppModalButton,
  SidebarNav: AppModalSidebarNav,
  SidebarContent: AppModalSidebarContent,
  SectionTitle: AppModalSectionTitle,
});
