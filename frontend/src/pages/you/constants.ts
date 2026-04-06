import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle, BarChart3, Briefcase, Building2, Coffee, CreditCard, GraduationCap, Landmark, Scale, ShoppingBasket, Store, TrendingUp, UserPlus } from 'lucide-react';
import { type BusinessAction } from './types';

export const BUSINESS_ICON_MAP = {
  startup: Building2,
  bank: Landmark,
  agency: BarChart3,
  formation: GraduationCap,
  transfer: ArrowLeftRight,
  lemonade: Store,
  epicerie: ShoppingBasket,
  coffee_shop: Coffee,
  supreme_court: Scale,
  law_firm: Briefcase,
} as const;

export const BUSINESS_STYLE_MAP = {
  startup: { card: 'border-sky-400/30 bg-sky-400/10', badge: 'bg-sky-400/15 text-sky-400', iconWrap: 'bg-sky-400/15', icon: 'text-sky-400' },
  bank: { card: 'border-emerald-400/30 bg-emerald-400/10', badge: 'bg-emerald-400/15 text-emerald-400', iconWrap: 'bg-emerald-400/15', icon: 'text-emerald-400' },
  agency: { card: 'border-violet-400/30 bg-violet-400/10', badge: 'bg-violet-400/15 text-violet-400', iconWrap: 'bg-violet-400/15', icon: 'text-violet-400' },
  formation: { card: 'border-amber-400/30 bg-amber-400/10', badge: 'bg-amber-400/15 text-amber-400', iconWrap: 'bg-amber-400/15', icon: 'text-amber-400' },
  transfer: { card: 'border-cyan-400/30 bg-cyan-400/10', badge: 'bg-cyan-400/15 text-cyan-400', iconWrap: 'bg-cyan-400/15', icon: 'text-cyan-400' },
  lemonade: { card: 'border-yellow-400/30 bg-yellow-400/10', badge: 'bg-yellow-400/15 text-yellow-400', iconWrap: 'bg-yellow-400/15', icon: 'text-yellow-400' },
  epicerie: { card: 'border-lime-400/30 bg-lime-400/10', badge: 'bg-lime-400/15 text-lime-400', iconWrap: 'bg-lime-400/15', icon: 'text-lime-400' },
  coffee_shop: { card: 'border-orange-400/30 bg-orange-400/10', badge: 'bg-orange-400/15 text-orange-400', iconWrap: 'bg-orange-400/15', icon: 'text-orange-400' },
  supreme_court: { card: 'border-indigo-400/30 bg-indigo-400/10', badge: 'bg-indigo-400/15 text-indigo-300', iconWrap: 'bg-indigo-400/15', icon: 'text-indigo-300' },
  law_firm: { card: 'border-purple-400/30 bg-purple-400/10', badge: 'bg-purple-400/15 text-purple-400', iconWrap: 'bg-purple-400/15', icon: 'text-purple-400' },
} as const;

export const ACTION_META: Record<BusinessAction, { label: string; help: string; icon: typeof UserPlus; tone: string }> = {
  invite: { label: 'Inviter des joueurs', help: 'Envoyer des invitations de recrutement.', icon: UserPlus, tone: 'bg-purple-400/15 text-purple-400' },
  loan: { label: 'Demander un pret', help: 'Envoyer une demande de pret au proprietaire du business.', icon: CreditCard, tone: 'bg-amber-400/15 text-amber-400' },
  invest: { label: 'Investir', help: 'Transferer du money vers la tresorerie d un autre joueur.', icon: TrendingUp, tone: 'bg-sky-400/15 text-sky-400' },
  deposit: { label: 'Deposer', help: 'Envoyer ton argent personnel dans la tresorerie du business.', icon: ArrowDownCircle, tone: 'bg-emerald-400/15 text-emerald-400' },
  withdraw: { label: 'Retirer', help: 'Sortir du money de la tresorerie vers ton argent personnel.', icon: ArrowUpCircle, tone: 'bg-red-400/15 text-red-400' },
};
