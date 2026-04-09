import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Building2, Globe, Heart, RotateCcw, ShoppingBasket, TrendingUp, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNotifications } from '@/contexts/NotificationContext';
import { AdBanner } from '@/components/ads/AdBanner';
import { cn } from '@/lib/utils';
import { type Ad, adsApi, type YouJobOffer, type YouState, youApi } from '@/services/api';
import { FeedCard, DashboardCard } from '../components/ui';
import { type FeedItem } from '../types';
import { isYouNotification, withRouteError } from '../utils';

const TUTORIAL_DONE_KEY = 'you_tutorial_done_v2';

const TUTORIAL_STEPS = [
  {
    icon: Building2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/15',
    title: 'Creer ta premiere epicerie',
    body: "Va dans l'onglet Travail et clique sur \"Creer une entreprise\". Choisis \"Epicerie\" (niveau 1, capital minimum 1 500€). Donne-lui un nom unique — c'est ton premier business !",
    cta: 'Aller dans Travail',
    tab: 'travail',
  },
  {
    icon: ShoppingBasket,
    color: 'text-lime-400',
    bg: 'bg-lime-400/15',
    title: 'Collecter les recettes NPC',
    body: "Depuis l'onglet Travail, ouvre ta nouvelle epicerie et clique \"Collecter les recettes\". Des clients NPC visitent ton shop — recupere leurs paiements toutes les 6 heures.",
    cta: 'Aller dans Travail',
    tab: 'travail',
  },
  {
    icon: Globe,
    color: 'text-sky-400',
    bg: 'bg-sky-400/15',
    title: 'Explorer les businesses',
    body: "Dans l'onglet Explorer tu vois tous les businesses des autres joueurs. Clique sur n'importe lequel pour interagir : investir, emprunter, transferer de l'argent, acheter des formations...",
    cta: 'Aller dans Explorer',
    tab: 'explore',
  },
  {
    icon: TrendingUp,
    color: 'text-amber-400',
    bg: 'bg-amber-400/15',
    title: 'Faire fructifier ton argent',
    body: "Investis dans des startups ou coffee shops depuis Explorer. Choisis ton niveau de risque (faible/moyen/eleve) et empoches un rendement. Tu peux aussi deposer dans une banque pour des interets quotidiens.",
    cta: 'Aller dans Explorer',
    tab: 'explore',
  },
  {
    icon: Heart,
    color: 'text-pink-400',
    bg: 'bg-pink-400/15',
    title: 'Etablir des relations',
    body: "L'onglet Social te permet de creer des liens avec d'autres joueurs. Amitie, amour, mariage... Plus tu interagis, plus ton niveau de connexion monte. Les couples partagent un compte commun !",
    cta: 'Aller dans Social',
    tab: 'social',
  },
] as const;

function YouTutorial() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(() => localStorage.getItem(TUTORIAL_DONE_KEY) === '1');

  const finish = () => {
    localStorage.setItem(TUTORIAL_DONE_KEY, '1');
    setDone(true);
  };

  const replay = () => {
    localStorage.removeItem(TUTORIAL_DONE_KEY);
    setStep(0);
    setDone(false);
  };

  const current = TUTORIAL_STEPS[step];
  const Icon = current.icon;
  const isLast = step === TUTORIAL_STEPS.length - 1;

  if (done) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/30 bg-muted/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground/50">Guide de demarrage termine</p>
        </div>
        <button
          type="button"
          onClick={replay}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Rejouer
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-muted/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
          Guide de demarrage · {step + 1}/{TUTORIAL_STEPS.length}
        </p>
        <button
          type="button"
          onClick={finish}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
          Passer
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-4 flex gap-1.5">
        {TUTORIAL_STEPS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              'h-1 flex-1 rounded-full transition-all',
              i === step ? 'bg-foreground/40' : i < step ? 'bg-foreground/20' : 'bg-muted/20',
            )}
          />
        ))}
      </div>

      <div className="flex gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', current.bg)}>
          <Icon className={cn('h-5 w-5', current.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{current.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{current.body}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {step > 0 ? (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setStep(step - 1)}>
              Retour
            </Button>
          ) : null}
          {!isLast ? (
            <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setStep(step + 1)}>
              Suivant <ArrowRight className="h-3 w-3" />
            </Button>
          ) : (
            <Button size="sm" className="h-7 text-xs" onClick={finish}>
              Terminer le guide
            </Button>
          )}
        </div>
        <a
          href={`?tab=${current.tab}`}
          className="flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          {current.cta} →
        </a>
      </div>
    </div>
  );
}

export function OverviewTab({ data, userId, onReload }: { data: YouState; userId: string; onReload: (refreshBalance?: boolean) => Promise<void> }) {
  const { notifications } = useNotifications();
  const youNotifications = useMemo(() => notifications.filter(isYouNotification).slice(0, 8), [notifications]);
  const [bannerAd, setBannerAd] = useState<Ad | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    void adsApi.listPublic({ limit: 3 })
      .then((response) => {
        if (response.data.ads[0]) {
          setBannerAd(response.data.ads[0]);
        }
      })
      .catch(() => {});
  }, []);

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    const seenLoanIds = new Set<string>();

    for (const n of youNotifications) {
      items.push({ kind: 'notification', date: n.createdAt, id: `notif-${n.id}`, notification: n });
    }
    for (const offer of data.jobOffers) {
      items.push({ kind: 'job_offer', date: offer.createdAt, id: `offer-${offer.id}`, offer });
    }
    for (const r of data.relationships) {
      if (r.pendingProposal?.canRespond) {
        items.push({ kind: 'marriage_proposal', date: r.pendingProposal.createdAt, id: `marry-${r.id}`, relationship: r });
      }
      if (r.pendingDivorceProposal?.canRespond) {
        items.push({ kind: 'divorce_proposal', date: r.pendingDivorceProposal.createdAt, id: `divorce-${r.id}`, relationship: r });
      }
      items.push({ kind: 'relationship', date: r.createdAt, id: `rel-${r.id}`, relationship: r });
    }
    for (const business of [...data.ownedBusinesses, ...data.exploreBusinesses]) {
      for (const loan of business.recentLoans) {
        if (loan.status === 'ACTIVE' && loan.borrower.id === userId && !seenLoanIds.has(loan.id)) {
          seenLoanIds.add(loan.id);
          items.push({ kind: 'active_loan', date: loan.createdAt, id: `loan-${loan.id}`, businessName: business.name, loan });
        }
      }
    }

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data, userId, youNotifications]);

  const respondToJobOffer = async (offer: YouJobOffer, decision: 'accept' | 'reject') => {
    await withRouteError(() => youApi.respondToBusinessInvitation(offer.id, decision), 'Impossible de traiter cette offre.');
    toast.success(decision === 'accept' ? 'Offre acceptee' : 'Offre refusee');
    await onReload();
  };

  const respondToMarriage = async (proposalId: string, decision: 'accept' | 'reject') => {
    await withRouteError(() => youApi.respondToMarriageProposal(proposalId, decision), 'Impossible de traiter la demande.');
    toast.success(decision === 'accept' ? 'Mariage valide' : 'Demande refusee');
    await onReload();
  };

  const respondToDivorce = async (proposalId: string, decision: 'accept' | 'reject') => {
    await withRouteError(() => youApi.respondToDivorceProposal(proposalId, decision), 'Impossible de traiter la demande de divorce.');
    toast.success(decision === 'accept' ? 'Divorce valide' : 'Divorce refuse');
    await onReload();
  };

  const repayLoan = async (loanId: string, percentage: number) => {
    await withRouteError(() => youApi.borrowerRepayLoan(loanId, percentage), 'Impossible de rembourser ce pret. Verifie que tu as assez de money.');
    toast.success(percentage === 100 ? 'Remboursement effectue' : `${percentage} % rembourse`);
    await onReload();
  };

  return (
    <div className="space-y-5">
      {/* Tutorial — always visible at the top */}
      <Card>
        <CardContent className="px-5 py-4">
          <YouTutorial />
        </CardContent>
      </Card>

      {bannerAd && !bannerDismissed ? <AdBanner ad={bannerAd} onDismiss={() => setBannerDismissed(true)} /> : null}

      <DashboardCard
        title={feedItems.length > 0 ? `Fil d'actualite (${feedItems.length})` : "Fil d'actualite"}
        tone="border-border/30 bg-background/30"
      >
        {feedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun evenement recent pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {feedItems.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                onRespondJobOffer={respondToJobOffer}
                onRespondMarriage={respondToMarriage}
                onRespondDivorce={respondToDivorce}
                onRepayLoan={repayLoan}
              />
            ))}
          </div>
        )}
      </DashboardCard>
    </div>
  );
}
