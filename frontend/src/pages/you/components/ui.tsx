import { type ElementType, type ReactNode, useState } from 'react';
import { ChevronRight, Heart, Landmark, UserPlus, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TYPOGRAPHY } from '@/lib/design-system';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { type YouJobOffer, type YouPlayer } from '@/services/api';
import { type FeedItem } from '../types';
import { formatMoney, getRelationshipPill, getYouNotificationMeta } from '../utils';

export function Pill({ label, color }: { label: string; color: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', color)}>{label}</span>;
}

export function ProgressBar({ value, max = 100, color = 'bg-primary' }: { value: number; max?: number; color?: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/40">
      <div className={cn('h-full rounded-full transition-all duration-300', color)} style={{ width: `${Math.max(0, Math.min(100, Math.round((value / max) * 100)))}%` }} />
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <p className={cn(TYPOGRAPHY.XS, 'mb-2 font-medium uppercase tracking-wider text-muted-foreground/60')}>{children}</p>;
}

export function DashboardCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn('overflow-hidden border', tone)}>
      <CardContent className="space-y-4 px-5 py-4">
        <SectionTitle>{title}</SectionTitle>
        {children}
      </CardContent>
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
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  desc?: string;
  wide?: boolean;
  centerTitle?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className={wide ? 'max-w-5xl' : 'max-w-md'}>
        <DialogHeader className={centerTitle ? 'text-center' : undefined}>
          <DialogTitle className={centerTitle ? 'text-xl sm:text-2xl' : undefined}>{title}</DialogTitle>
          {desc ? <DialogDescription>{desc}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-4 py-1">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function SelectBox({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
      {children}
    </select>
  );
}

export function ActionRow({
  icon: Icon,
  label,
  sub,
  iconBg,
  iconColor,
  onClick,
}: {
  icon: ElementType;
  label: string;
  sub: string;
  iconBg: string;
  iconColor: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/20">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

export function ActionCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y divide-border/30">{children}</div>
      </CardContent>
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
}: {
  item: FeedItem;
  onRespondJobOffer: (offer: YouJobOffer, decision: 'accept' | 'reject') => Promise<void>;
  onRespondMarriage: (proposalId: string, decision: 'accept' | 'reject') => Promise<void>;
  onRespondDivorce: (proposalId: string, decision: 'accept' | 'reject') => Promise<void>;
}) {
  const [confirmMarriage, setConfirmMarriage] = useState(false);
  const dateStr = new Date(item.date).toLocaleString('fr-FR');

  if (item.kind === 'notification') {
    const meta = getYouNotificationMeta(item.notification);
    const Icon = meta.icon;
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-border/40 bg-background/60 px-4 py-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border', meta.tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{item.notification.title}</p>
            {!item.notification.isRead ? <Pill label="Nouveau" color="bg-foreground text-background" /> : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{item.notification.body}</p>
          <p className="mt-1.5 text-[11px] text-muted-foreground/60">{dateStr}</p>
        </div>
      </div>
    );
  }

  if (item.kind === 'job_offer') {
    const directionLabel = item.offer.initiatedByRole === 'EMPLOYER' ? 'Offre de contrat' : 'Candidature';
    const subtitle = item.offer.initiatedByRole === 'EMPLOYER'
      ? `${item.offer.inviter.username} te propose le role ${item.offer.role}`
      : `${item.offer.employee.username} candidate pour ${item.offer.role}`;
    return (
      <div className="rounded-2xl border border-violet-400/20 bg-violet-400/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-400/15">
            <UserPlus className="h-4 w-4 text-violet-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{item.offer.business.name}</p>
              <Pill label={directionLabel} color="bg-violet-400/15 text-violet-300" />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle} · {item.offer.salary.toLocaleString('fr-FR')} money/jour</p>
            <p className="mt-1.5 text-[11px] text-muted-foreground/60">{dateStr}</p>
            {item.offer.needsViewerAcceptance ? (
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={() => void onRespondJobOffer(item.offer, 'accept')}>Accepter</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void onRespondJobOffer(item.offer, 'reject')}>Refuser</Button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">En attente de validation par {item.offer.waitingOn === 'EMPLOYER' ? "l'employeur" : item.offer.waitingOn === 'EMPLOYEE' ? "l'employe" : "l'autre partie"}.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (item.kind === 'marriage_proposal') {
    const proposal = item.relationship.pendingProposal!;
    return (
      <div className="rounded-2xl border border-pink-400/20 bg-pink-400/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-400/15">
            <Heart className="h-4 w-4 text-pink-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{item.relationship.otherUser.username} te demande en mariage</p>
              <Pill label="Mariage" color="bg-pink-400/15 text-pink-300" />
            </div>
            {proposal.message ? <p className="mt-0.5 text-xs text-muted-foreground">{proposal.message}</p> : null}
            <p className="mt-1.5 text-[11px] text-muted-foreground/60">{dateStr}</p>
            {confirmMarriage ? (
              <div className="mt-2 space-y-2">
                <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200 space-y-1">
                  <p className="font-semibold">Consequences du mariage :</p>
                  <p>· Compte bancaire commun partage avec ton conjoint</p>
                  <p>· En cas de divorce, le compte commun est divise en deux</p>
                  <p>· Si ton conjoint triche, il peut perdre tout son argent au tribunal</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={() => void onRespondMarriage(proposal.id, 'accept')}>Confirmer</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setConfirmMarriage(false)}>Annuler</Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={() => setConfirmMarriage(true)}>Accepter</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void onRespondMarriage(proposal.id, 'reject')}>Refuser</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (item.kind === 'divorce_proposal') {
    const proposal = item.relationship.pendingDivorceProposal!;
    return (
      <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-400/15">
            <X className="h-4 w-4 text-rose-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{item.relationship.otherUser.username} demande le divorce</p>
              <Pill label="Divorce" color="bg-rose-400/15 text-rose-300" />
            </div>
            {proposal.message ? <p className="mt-0.5 text-xs text-muted-foreground">{proposal.message}</p> : null}
            <p className="mt-1.5 text-[11px] text-muted-foreground/60">{dateStr}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={() => void onRespondDivorce(proposal.id, 'accept')}>Valider</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void onRespondDivorce(proposal.id, 'reject')}>Refuser</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (item.kind === 'active_loan') {
    const dailyRepayment = Math.round((item.loan.amount * (1 + item.loan.interestRate / 100)) / Math.max(1, item.loan.termDays));
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15">
          <Landmark className="h-4 w-4 text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{item.businessName}</p>
            <Pill label="Remboursement" color="bg-amber-400/15 text-amber-300" />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatMoney(item.loan.amount)} money · {item.loan.termDays} jours</p>
          <p className="mt-1.5 text-[11px] text-muted-foreground/60">{dateStr}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tabular-nums text-amber-300">{formatMoney(dailyRepayment)}</p>
          <p className="text-[10px] text-muted-foreground">par jour</p>
        </div>
      </div>
    );
  }

  if (item.kind === 'relationship') {
    const pill = getRelationshipPill(item.relationship.status);
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-background/60 px-4 py-3">
        <UserAvatar player={item.relationship.otherUser} className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{item.relationship.otherUser.username}</p>
            <Pill label={pill.label} color={pill.color} />
            {item.relationship.pendingProposal?.direction === 'sent' ? <Pill label="Demande envoyee" color="bg-amber-400/15 text-amber-300" /> : null}
            {item.relationship.pendingDivorceProposal?.direction === 'sent' ? <Pill label="Divorce en attente" color="bg-rose-400/15 text-rose-300" /> : null}
          </div>
          <div className="mt-1.5">
            <ProgressBar value={item.relationship.connectionLevel} color="bg-pink-400" />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground/60">{dateStr}</p>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-pink-400">{item.relationship.connectionLevel}%</span>
      </div>
    );
  }

  return null;
}

export function FilterButton({
  active,
  label,
  icon: Icon,
  onClick,
  colorClass,
}: {
  active: boolean;
  label: string;
  icon: ElementType;
  onClick: () => void;
  colorClass: string;
}) {
  return <button type="button" onClick={onClick} className={cn('flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors', active ? `${colorClass} border-transparent text-white` : 'border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground')}><Icon className="h-3.5 w-3.5" /><span>{label}</span></button>;
}

export { Input };
