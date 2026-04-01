import { useMemo } from 'react';
import { toast } from 'sonner';
import { useNotifications } from '@/contexts/NotificationContext';
import { type YouJobOffer, type YouState, youApi } from '@/services/api';
import { FeedCard, DashboardCard } from '../components/ui';
import { type FeedItem } from '../types';
import { isYouNotification, withRouteError } from '../utils';

export function OverviewTab({ data, userId, onReload }: { data: YouState; userId: string; onReload: (refreshBalance?: boolean) => Promise<void> }) {
  const { notifications } = useNotifications();
  const youNotifications = useMemo(() => notifications.filter(isYouNotification).slice(0, 8), [notifications]);

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

  return (
    <div className="space-y-5">
      <DashboardCard title={feedItems.length > 0 ? `Fil d'actualite (${feedItems.length})` : "Fil d'actualite"} tone="border-border/30 bg-background/30">
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
              />
            ))}
          </div>
        )}
      </DashboardCard>
    </div>
  );
}
