import { Children, isValidElement, type ElementType, type ReactElement, type ReactNode, useState } from 'react';
import { ChevronRight, Heart, Landmark, UserPlus, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { resolveImageUrl } from '@/lib/images';
import { type YouJobOffer, type YouPlayer } from '@/services/api';
import { type FeedItem } from '../types';
import { formatMoney, getRelationshipPill, getYouNotificationMeta, relativeTime } from '../utils';

/** Pastille de statut : la teinte demandée est ramenée à une variante sémantique de Badge. */
export function Pill({ label, color }: { label: string; color: string }) {
  const variant = color.includes('destructive') ? 'destructive' : color.includes('warning') ? 'warning' : color.includes('success') ? 'success' : 'secondary';
  return <Badge variant={variant}>{label}</Badge>;
}

export function ProgressBar({ value, max = 100 }: { value: number; max?: number; color?: string }) {
  return <Progress value={Math.max(0, Math.min(100, Math.round((value / max) * 100)))} />;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h4 className="mb-2 text-sm font-medium text-muted-foreground">{children}</h4>;
}

export function DashboardCard({ title, children }: { title: string; tone?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

export function ModalWrap({
  open,
  onClose,
  title,
  desc,
  wide,
  centerTitle,
  contentDataTutorialId,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  desc?: string;
  wide?: boolean;
  centerTitle?: boolean;
  contentDataTutorialId?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className={wide ? 'sm:max-w-5xl' : 'sm:max-w-md'} data-tutorial-id={contentDataTutorialId}>
        <DialogHeader className={centerTitle ? 'text-center' : undefined}>
          <DialogTitle>{title}</DialogTitle>
          {desc ? <DialogDescription>{desc}</DialogDescription> : null}
        </DialogHeader>
        <div className="flex flex-col gap-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </Field>
  );
}

const EMPTY_OPTION = '__empty__';

/** Liste déroulante shadcn alimentée par des enfants <option>, pour conserver l'API historique. */
export function SelectBox({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: ReactNode }) {
  const options = Children.toArray(children).filter(
    (child): child is ReactElement<{ value?: string; disabled?: boolean; children?: ReactNode }> => isValidElement(child) && child.type === 'option',
  );
  const placeholder = options.find((option) => (option.props.value ?? '') === '')?.props.children;

  return (
    <Select value={value === '' ? EMPTY_OPTION : value} onValueChange={(next) => onChange(next === EMPTY_OPTION ? '' : next)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options
          .filter((option) => (option.props.value ?? '') !== '')
          .map((option, index) => (
            <SelectItem key={`${option.props.value}-${index}`} value={String(option.props.value)} disabled={option.props.disabled}>
              {option.props.children}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

export function ActionRow({
  icon: Icon,
  label,
  sub,
  onClick,
  dataTutorialId,
}: {
  icon: ElementType;
  label: string;
  sub: string;
  iconBg?: string;
  iconColor?: string;
  onClick: () => void;
  dataTutorialId?: string;
}) {
  return (
    <Item asChild>
      <button type="button" onClick={onClick} className="w-full text-left" data-tutorial-id={dataTutorialId}>
        <ItemMedia variant="icon">
          <Icon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{label}</ItemTitle>
          <ItemDescription>{sub}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <ChevronRight className="size-4 text-muted-foreground" />
        </ItemActions>
      </button>
    </Item>
  );
}

export function ActionCard({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <Card className="py-2">
      <ItemGroup>
        {rows.map((row, index) => (
          <div key={index}>
            {index > 0 ? <ItemSeparator /> : null}
            {row}
          </div>
        ))}
      </ItemGroup>
    </Card>
  );
}

export function UserAvatar({ player, className }: { player: Pick<YouPlayer, 'username' | 'profilePicture'>; className?: string }) {
  return (
    <Avatar className={className}>
      {player.profilePicture ? <AvatarImage src={resolveImageUrl(player.profilePicture)} alt={player.username} /> : null}
      <AvatarFallback>{player.username.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

export function FeedCard({
  item,
  onRespondJobOffer,
  onRespondMarriage,
  onRespondDivorce,
  onRepayLoan,
}: {
  item: FeedItem;
  onRespondJobOffer: (offer: YouJobOffer, decision: 'accept' | 'reject') => Promise<void>;
  onRespondMarriage: (proposalId: string, decision: 'accept' | 'reject') => Promise<void>;
  onRespondDivorce: (proposalId: string, decision: 'accept' | 'reject') => Promise<void>;
  onRepayLoan?: (loanId: string, percentage: number) => Promise<void>;
}) {
  const [confirmMarriage, setConfirmMarriage] = useState(false);
  const timeAgo = relativeTime(item.date);

  if (item.kind === 'notification') {
    const meta = getYouNotificationMeta(item.notification);
    const Icon = meta.icon;
    return (
      <Item variant="outline" size="sm">
        <ItemMedia variant="icon">
          <Icon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{item.notification.title}</ItemTitle>
          <ItemDescription>{item.notification.body}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </ItemActions>
      </Item>
    );
  }

  if (item.kind === 'job_offer') {
    const directionLabel = item.offer.initiatedByRole === 'EMPLOYER' ? 'Offre de contrat' : 'Candidature';
    const subtitle = item.offer.initiatedByRole === 'EMPLOYER'
      ? `${item.offer.inviter.username} te propose le rôle ${item.offer.role}`
      : `${item.offer.employee.username} candidate pour ${item.offer.role}`;
    return (
      <Item variant="outline">
        <ItemMedia variant="icon">
          <UserPlus />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            {item.offer.business.name}
            <Badge variant="secondary">{directionLabel}</Badge>
          </ItemTitle>
          <ItemDescription>
            {subtitle} · {item.offer.salary.toLocaleString('fr-FR')} money/jour
          </ItemDescription>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
          {item.offer.needsViewerAcceptance ? (
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => void onRespondJobOffer(item.offer, 'accept')}>
                Accepter
              </Button>
              <Button size="sm" variant="outline" onClick={() => void onRespondJobOffer(item.offer, 'reject')}>
                Refuser
              </Button>
            </div>
          ) : (
            <span className="pt-1 text-xs text-muted-foreground">
              En attente de validation par {item.offer.waitingOn === 'EMPLOYER' ? "l'employeur" : item.offer.waitingOn === 'EMPLOYEE' ? "l'employé" : "l'autre partie"}.
            </span>
          )}
        </ItemContent>
      </Item>
    );
  }

  if (item.kind === 'marriage_proposal') {
    const proposal = item.relationship.pendingProposal!;
    return (
      <Item variant="outline">
        <ItemMedia variant="icon">
          <Heart />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            {item.relationship.otherUser.username} te demande en mariage
            <Badge variant="secondary">Mariage</Badge>
          </ItemTitle>
          {proposal.message ? <ItemDescription>{proposal.message}</ItemDescription> : null}
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
          {confirmMarriage ? (
            <div className="flex flex-col gap-2 pt-1">
              <Alert variant="warning">
                <AlertTitle>Conséquences du mariage</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    <li>Compte bancaire commun partagé avec ton conjoint</li>
                    <li>En cas de divorce, le compte commun est divisé en deux</li>
                    <li>Si ton conjoint triche, il peut perdre tout son argent au tribunal</li>
                  </ul>
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void onRespondMarriage(proposal.id, 'accept')}>
                  Confirmer
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmMarriage(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => setConfirmMarriage(true)}>
                Accepter
              </Button>
              <Button size="sm" variant="outline" onClick={() => void onRespondMarriage(proposal.id, 'reject')}>
                Refuser
              </Button>
            </div>
          )}
        </ItemContent>
      </Item>
    );
  }

  if (item.kind === 'divorce_proposal') {
    const proposal = item.relationship.pendingDivorceProposal!;
    return (
      <Item variant="outline">
        <ItemMedia variant="icon">
          <X />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            {item.relationship.otherUser.username} demande le divorce
            <Badge variant="destructive">Divorce</Badge>
          </ItemTitle>
          {proposal.message ? <ItemDescription>{proposal.message}</ItemDescription> : null}
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => void onRespondDivorce(proposal.id, 'accept')}>
              Valider
            </Button>
            <Button size="sm" variant="outline" onClick={() => void onRespondDivorce(proposal.id, 'reject')}>
              Refuser
            </Button>
          </div>
        </ItemContent>
      </Item>
    );
  }

  if (item.kind === 'active_loan') {
    const totalOwed = Math.round(item.loan.amount * (1 + item.loan.interestRate / 100));
    const remaining = Math.max(0, totalOwed - (item.loan.repaidAmount ?? 0));
    return (
      <Item variant="outline">
        <ItemMedia variant="icon">
          <Landmark />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            {item.businessName}
            <Badge variant="warning">Prêt actif</Badge>
          </ItemTitle>
          <ItemDescription>
            {formatMoney(item.loan.amount)} principal · {item.loan.interestRate} % · {item.loan.termDays} jours
          </ItemDescription>
          <span className="text-xs text-muted-foreground">
            Reste à rembourser : <span className="font-semibold text-foreground">{formatMoney(remaining)}</span> · {timeAgo}
          </span>
          {onRepayLoan ? (
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => void onRepayLoan(item.loan.id, 50)}>
                50 %
              </Button>
              <Button size="sm" variant="outline" onClick={() => void onRepayLoan(item.loan.id, 100)}>
                Rembourser 100 % (si possible)
              </Button>
            </div>
          ) : null}
        </ItemContent>
      </Item>
    );
  }

  if (item.kind === 'relationship') {
    const pill = getRelationshipPill(item.relationship.status);
    return (
      <Item variant="outline" size="sm">
        <ItemMedia>
          <UserAvatar player={item.relationship.otherUser} className="size-9" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            {item.relationship.otherUser.username}
            <Pill label={pill.label} color={pill.color} />
            {item.relationship.pendingProposal?.direction === 'sent' ? <Badge variant="warning">Demande envoyée</Badge> : null}
            {item.relationship.pendingDivorceProposal?.direction === 'sent' ? <Badge variant="destructive">Divorce en attente</Badge> : null}
          </ItemTitle>
          <ProgressBar value={item.relationship.connectionLevel} />
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </ItemContent>
        <ItemActions>
          <span className="text-sm font-semibold tabular-nums">{item.relationship.connectionLevel}%</span>
        </ItemActions>
      </Item>
    );
  }

  return null;
}

export function FilterButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ElementType;
  onClick: () => void;
  colorClass?: string;
}) {
  return (
    <Button type="button" variant={active ? 'secondary' : 'outline'} size="sm" className="w-full justify-start" onClick={onClick} aria-pressed={active}>
      <Icon />
      {label}
    </Button>
  );
}

export { Input };
