import { type Notification, type YouBusinessLoan, type YouJobOffer, type YouRelationship } from '@/services/api';

export type BusinessAction = 'invite' | 'loan' | 'invest' | 'deposit' | 'withdraw';

export type FeedItem =
  | { kind: 'notification'; date: string; id: string; notification: Notification }
  | { kind: 'job_offer'; date: string; id: string; offer: YouJobOffer }
  | { kind: 'marriage_proposal'; date: string; id: string; relationship: YouRelationship }
  | { kind: 'divorce_proposal'; date: string; id: string; relationship: YouRelationship }
  | { kind: 'active_loan'; date: string; id: string; businessName: string; loan: YouBusinessLoan }
  | { kind: 'relationship'; date: string; id: string; relationship: YouRelationship };
