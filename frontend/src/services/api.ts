import axios from 'axios';
import { storeBanInfo } from './ban';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_BASE = API_URL.endsWith('/api/')
  ? API_URL.slice(0, -1)
  : API_URL.endsWith('/api')
    ? API_URL
    : `${API_URL.replace(/\/$/, '')}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 && error.response?.data?.banned) {
      const banData = error.response.data;
      storeBanInfo({
        reason: banData.ban?.reason ?? null,
        type: banData.ban?.type ?? null,
        expiresAt: banData.ban?.expiresAt ?? null,
        message: banData.error,
        banId: banData.ban?.id ?? null,
        userId: banData.userId ?? null,
      });
      localStorage.removeItem('token');
      window.location.href = '/banned';
      return Promise.reject(error);
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: (data: { username: string; firstName: string; schoolLevel: 'SECONDE' | 'PREMIERE' | 'TERMINALE'; classLetter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'; email: string; password: string; motivationMessage: string; referralCode?: string }) =>
    api.post('/auth/register', data),
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data),
  refresh: () => api.post('/auth/refresh'),
  me: () => api.get('/auth/me'),
  getReferralSummary: () => api.get<ReferralSummary>('/auth/referral-summary'),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data),
};

export interface ReferralSummary {
  referralCode: string;
  rewardAmount: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalRewardsEarned: number;
}

// Uploads API - Deprecated: File uploads are no longer supported, only URL-based images are allowed

// Users API
export const usersApi = {
  getAll: () => api.get('/users'),
  getSocialOverview: () => api.get<{ stats: SocialStats; friends: SocialUser[] }>('/users/social/overview'),
  follow: (targetUserId: string) =>
    api.post<{ relationship: SocialRelationship; stats: SocialStats }>(`/users/social/follow/${targetUserId}`),
  unfollow: (targetUserId: string) =>
    api.delete<{ relationship: SocialRelationship; stats: SocialStats }>(`/users/social/follow/${targetUserId}`),
  getAnnouncement: () => api.get<{ message: string }>('/users/announcement'),
  getPendingUpdatePopups: () => api.get<{ popups: UserUpdatePopup[] }>('/users/update-popups/pending'),
  markUpdatePopupViewed: (id: string) => api.post<{ success: boolean }>(`/users/update-popups/${id}/viewed`),
  getById: (id: string) => api.get(`/users/${id}`),
  update: (id: string, data: { username?: string; bio?: string }) => api.put(`/users/${id}`, data),
  requestNameChange: (data: { requestedUsername: string; reason?: string }) =>
    api.post<{ request: NameChangeRequest }>('/users/name-change-request', data),
  // Admin warnings (user-facing)
  getPendingWarnings: () => api.get<{ warnings: UserPendingWarning[] }>('/users/warnings/pending'),
  acknowledgeWarning: (id: string) => api.post<{ success: boolean; message: string }>(`/users/warnings/${id}/acknowledge`),
};

export interface UserUpdatePopup {
  id: string;
  title: string;
  summary: string | null;
  message: string;
  imageUrl: string | null;
  type: 'UPDATE' | 'CLAN_PROMPT';
  releaseDate: string;
  createdAt: string;
}

export interface UserPendingWarning {
  id: string;
  type: 'AVERTISSEMENT' | 'AMENDE'; // AVERTISSEMENT or AMENDE
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  amount?: number | null; // Amount for amende
  createdAt: string;
  issuedBy: {
    id: string;
    username: string;
  };
}

export interface SocialRelationship {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isConnection: boolean;
}

export interface SocialStats {
  followerCount: number;
  followingCount: number;
  connectionCount: number;
}

export interface SocialUser {
  id: string;
  username: string;
  firstName?: string | null;
  usernameColor?: string | null;
  profilePicture?: string | null;
  profileBanner?: string | null;
  bio?: string | null;
  createdAt: string;
  social?: SocialRelationship & Partial<SocialStats>;
}

export interface YouPlayer {
  id: string;
  username: string;
  firstName?: string | null;
  profilePicture?: string | null;
  bio?: string | null;
  aura: number | string;
  money: number;
  alreadyInRelationship: boolean;
}

export interface YouBusinessType {
  key: string;
  label: string;
  category: string;
  description: string;
  minCapital: number;
  creationFee: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  satisfaction: number;
  level: number;
  actions: Array<'invite' | 'loan' | 'invest' | 'deposit' | 'withdraw' | 'start_research' | 'deploy_product' | 'collect_npc' | 'purchase_item'>;
  isAdminOnly?: boolean;
  isStateOwned?: boolean;
}

export interface YouSkill {
  key: 'affaires' | 'social' | 'intelligence' | 'charisme' | 'finance' | 'illegalite' | string;
  label: string;
  color: 'emerald' | 'purple' | 'sky' | 'pink' | 'amber' | 'rose';
  description: string;
  level: number;
  xp: number;
  maxXp: number;
  trainingCost: number;
  trainable: boolean;
  canTrain: boolean;
  unlocks: string[];
}

export interface YouBusinessMember {
  id: string;
  role: string;
  status: string;
  salary: number;
  specialty?: string | null;
  isPrimaryLawyer?: boolean;
  displayOrder?: number;
  user: Omit<YouPlayer, 'alreadyInRelationship'>;
}

export interface YouBankAccount {
  id: string;
  accountType: 'COURANT' | 'EPARGNE';
  balance: number;
  createdAt: string;
}

export interface YouBusinessTransaction {
  id: string;
  type: string;
  amount: number;
  label: string;
  actorId: string | null;
  createdAt: string;
}

export interface YouBusinessInvitation {
  id: string;
  role: string;
  salary: number;
  message: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
  initiatedByRole: 'EMPLOYER' | 'EMPLOYEE' | string;
  employerAcceptedAt: string | null;
  employeeAcceptedAt: string | null;
  viewerRole: 'EMPLOYER' | 'EMPLOYEE' | null;
  needsViewerAcceptance: boolean;
  waitingOn: 'EMPLOYER' | 'EMPLOYEE' | 'BOTH' | 'NONE' | string;
  inviter: Omit<YouPlayer, 'alreadyInRelationship'>;
  employee: Omit<YouPlayer, 'alreadyInRelationship'>;
  employer: Omit<YouPlayer, 'alreadyInRelationship'>;
  invitee: Omit<YouPlayer, 'alreadyInRelationship'>;
}

export interface YouBusinessLoan {
  id: string;
  amount: number;
  termDays: number;
  interestRate: number;
  motivationMessage: string | null;
  collateralAura: number;
  collateralAuraHeld: number;
  status: string;
  repaidAmount: number;
  decidedAt: string | null;
  collateralClaimedAt: string | null;
  createdAt: string;
  borrower: Omit<YouPlayer, 'alreadyInRelationship'>;
}

export interface YouBusinessInvestment {
  id: string;
  amount: number;
  riskLevel: 'low' | 'medium' | 'high' | string;
  expectedReturnMin: number;
  expectedReturnMax: number;
  createdAt: string;
  investor: Omit<YouPlayer, 'alreadyInRelationship'>;
}

export interface YouBusinessShareholder {
  id: string;
  sharePercent: number;
  investedAmount: number;
  averagePrice: number;
  createdAt: string;
  user: Omit<YouPlayer, 'alreadyInRelationship'>;
}

export interface YouBusinessShareProposal {
  id: string;
  businessId: string;
  sharePercent: number;
  amount: number;
  suggestedAmount: number;
  message: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | string;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  direction: 'sent' | 'received';
  investor: Omit<YouPlayer, 'alreadyInRelationship'>;
  owner: Omit<YouPlayer, 'alreadyInRelationship'>;
  business?: {
    id: string;
    name: string;
    typeKey: string;
  };
}

export interface YouBusinessBuyoutOffer {
  id: string;
  businessId: string;
  amount: number;
  message: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | string;
  createdAt: string;
  decidedAt: string | null;
  direction: 'sent' | 'received';
  bidder: Omit<YouPlayer, 'alreadyInRelationship'>;
  owner: Omit<YouPlayer, 'alreadyInRelationship'>;
  business?: {
    id: string;
    name: string;
    typeKey: string;
  };
}

export interface YouBusinessTransferHistoryEntry {
  id: string;
  amount: number;
  fee: number;
  feeRate: number;
  createdAt: string;
  sender: Omit<YouPlayer, 'alreadyInRelationship'>;
  recipient: Omit<YouPlayer, 'alreadyInRelationship'>;
}

export interface YouStartupProduct {
  id: string;
  slotIndex: number;
  name: string;
  deployedLevel: number;
  currentRevenue: number;
  isResearchActive: boolean;
  canDeploy: boolean;
  activeResearchLevel: number | null;
  researchStartedAt: string | null;
  researchEndsAt: string | null;
  researchCost: number | null;
  nextResearchCost: number | null;
  nextResearchDurationMinutes: number | null;
  progressPercent: number;
  canStartResearch: boolean;
  isMaxLevel: boolean;
}

export interface YouFormationProduct {
  id: string;
  title: string;
  description: string | null;
  price: number;
  url: string | null;
  imageUrl: string | null;
  createdAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewerNote: string | null;
  attachmentOriginalName?: string | null;
  attachmentMimeType?: string | null;
  attachmentPath?: string | null;
  attachmentSizeBytes?: number | null;
  hasAttachment?: boolean;
  accessMode?: 'EXTERNAL_URL' | 'FILE' | 'HYBRID' | 'UNAVAILABLE' | string;
  avgRating?: number | null;
  ratingCount?: number;
  ratings?: YouBusinessRating[];
  canReview?: boolean;
  viewerHasPurchased?: boolean;
  viewerPurchasedAt?: string | null;
  viewerLastAccessedAt?: string | null;
  hasPurchased?: boolean;
  hasAccess?: boolean;
  reviewPromptAt?: string | null;
  reviewPromptedAt?: string | null;
  purchasedAt?: string | null;
  lastAccessedAt?: string | null;
}

export interface BusinessSupportAgentSummary {
  id: string;
  username: string;
  profilePicture?: string | null;
  usernameColor?: string | null;
}

export interface YouBusinessRating {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  user: Omit<YouPlayer, 'alreadyInRelationship'>;
}

export interface YouBusiness {
  id: string;
  name: string;
  typeKey: string;
  type: YouBusinessType | null;
  ownerId: string;
  owner: Omit<YouPlayer, 'alreadyInRelationship'>;
  ownerKind: 'you' | 'player';
  verified: boolean;
  description: string | null;
  logoUrl: string | null;
  location: string | null;
  foundedAt: string;
  foundedLabel: string;
  hiring: boolean;
  startingCapital: number;
  treasuryMoney: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  satisfaction: number;
  memberCount: number;
  level: number;
  actions: Array<'invite' | 'loan' | 'invest' | 'deposit' | 'withdraw' | 'start_research' | 'deploy_product' | 'collect_npc' | 'purchase_item'>;
  members: YouBusinessMember[];
  pendingInvitations: YouBusinessInvitation[];
  recentLoans: YouBusinessLoan[];
  recentInvestments: YouBusinessInvestment[];
  shareholders: YouBusinessShareholder[];
  ownerSharePercent: number;
  isShared: boolean;
  viewerSharePercent: number;
  viewerInvestedAmount: number;
  suggestedShareAmount: number;
  pendingShareholderProposals: YouBusinessShareProposal[];
  transferHistory: YouBusinessTransferHistoryEntry[];
  pendingBuyoutOffers: YouBusinessBuyoutOffer[];
  startupProducts: YouStartupProduct[];
  livretEpargneUnlocked?: boolean;
  loanInterestRate?: number;
  transferFeeRate?: number;
  formationUrl?: string | null;
  formationPrice?: number;
  formationProducts?: YouFormationProduct[];
  customData?: Array<{ key: string; label: string; price: number; emoji?: string; xpHint?: string }>;
  npcLastCollectedAt?: string | null;
  avgRating: number | null;
  ratingCount: number;
  ratings: YouBusinessRating[];
  canRate: boolean;
  isStateOwned: boolean;
  reviewPromptAt?: string | null;
  reviewPromptedAt?: string | null;
  supportAgent?: BusinessSupportAgentSummary | null;
  supportEnabled?: boolean;
}

export interface PendingFormationReviewItem {
  id: string;
  businessId: string;
  title: string;
  description: string | null;
  price: number;
  url: string | null;
  imageUrl: string | null;
  createdAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  reviewerNote: string | null;
  attachmentOriginalName: string | null;
  attachmentMimeType: string | null;
  attachmentPath: string | null;
  attachmentSizeBytes: number | null;
  business: {
    id: string;
    name: string;
    ownerId: string;
    owner: Omit<YouPlayer, 'alreadyInRelationship'>;
  };
}

export interface FormationAttachmentInput {
  base64Data?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
}

export interface FormationProductAccessResult {
  productId: string;
  title: string;
  url: string | null;
  attachmentOriginalName: string | null;
  attachmentMimeType: string | null;
  attachmentPath: string | null;
  hasAttachment: boolean;
}

export interface YouMarriageProposal {
  id: string;
  proposerId: string;
  recipientId: string;
  status: string;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  direction: 'sent' | 'received';
  canRespond: boolean;
}

export interface YouDivorceProposal {
  id: string;
  proposerId: string;
  recipientId: string;
  status: string;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  direction: 'sent' | 'received';
  canRespond: boolean;
}

export interface YouRelationship {
  id: string;
  status: 'DATING' | 'FRIEND' | 'MARRIED' | 'DIVORCED' | 'MISTRESS' | string;
  connectionLevel: number;
  coupleBalance: number;
  createdAt: string;
  marriedAt: string | null;
  otherUser: Omit<YouPlayer, 'alreadyInRelationship'>;
  canProposeMarriage: boolean;
  canDivorce: boolean;
  canForget: boolean;
  canMakeMistress: boolean;
  canSuspectCheating: boolean;
  hasPendingCourtCase: boolean;
  pendingProposal: YouMarriageProposal | null;
  pendingDivorceProposal: YouDivorceProposal | null;
}

export interface YouCourtCase {
  id: string;
  accuserId: string;
  accuser: Omit<YouPlayer, 'alreadyInRelationship'>;
  createdAt: string;
}

export interface YouJobOffer {
  id: string;
  role: string;
  salary: number;
  message: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
  initiatedByRole: 'EMPLOYER' | 'EMPLOYEE' | string;
  employerAcceptedAt: string | null;
  employeeAcceptedAt: string | null;
  viewerRole: 'EMPLOYER' | 'EMPLOYEE' | null;
  needsViewerAcceptance: boolean;
  waitingOn: 'EMPLOYER' | 'EMPLOYEE' | 'BOTH' | 'NONE' | string;
  inviter: Omit<YouPlayer, 'alreadyInRelationship'>;
  employee: Omit<YouPlayer, 'alreadyInRelationship'>;
  employer: Omit<YouPlayer, 'alreadyInRelationship'>;
  business: {
    id: string;
    name: string;
    typeKey: string;
    owner: Omit<YouPlayer, 'alreadyInRelationship'>;
  };
}

export interface YouState {
  skills: YouSkill[];
  businessSlots: number;
  unlockedBusinessLevel: number;
  businessTypes: YouBusinessType[];
  players: YouPlayer[];
  jobOffers: YouJobOffer[];
  relationships: YouRelationship[];
  courtCases: YouCourtCase[];
  ownedBusinesses: YouBusiness[];
  exploreBusinesses: YouBusiness[];
  memberBusinesses: YouBusiness[];
  shareholderBusinesses: YouBusiness[];
  pendingBuyoutOffers: YouBusinessBuyoutOffer[];
  sentBuyoutOffers: YouBusinessBuyoutOffer[];
  sentShareholderProposals: YouBusinessShareProposal[];
}

export const youApi = {
  getState: () => api.get<YouState>('/you/state'),
  getSkills: () => api.get<{ skills: YouSkill[] }>('/you/skills'),
  trainSkill: (skillKey: string) =>
    api.post<{ skill: YouSkill }>(`/you/skills/${skillKey}/train`),
  createBusiness: (data: { name: string; typeKey: string; capital: number; description?: string; location?: string }) =>
    api.post<{ business: YouBusiness }>('/you/businesses', data),
  runBusinessAction: (businessId: string, actionKey: 'invite' | 'loan' | 'invest' | 'deposit' | 'withdraw' | 'start_research' | 'deploy_product' | 'collect_npc' | 'purchase_item', data?: Record<string, unknown>) =>
    api.post<{ result: Record<string, unknown> }>(`/you/businesses/${businessId}/actions/${actionKey}`, data ?? {}),
  applyToBusiness: (businessId: string, data: { role?: string; salary: number; message?: string }) =>
    api.post<{ result: { id: string } }>(`/you/businesses/${businessId}/apply`, data),
  respondToBusinessInvitation: (invitationId: string, decision: 'accept' | 'reject') =>
    api.post<{ result: { id: string; status: string; respondedAt: string | null } }>(`/you/business-invitations/${invitationId}/respond`, { decision }),
  respondToBusinessLoan: (loanId: string, decision: 'accept' | 'reject') =>
    api.post<{ result: { id: string; status: string; decidedAt: string | null } }>(`/you/loans/${loanId}/respond`, { decision }),
  transferWithBusiness: (businessId: string, data: { recipientId: string; amount: number }) =>
    api.post<{ result: { recipientId: string; amount: number; fee: number; debited: number } }>(`/you/businesses/${businessId}/actions/transfer`, data),
  createBuyoutOffer: (businessId: string, data: { amount: number; message?: string }) =>
    api.post<{ offer: YouBusinessBuyoutOffer }>(`/you/businesses/${businessId}/buyout-offers`, data),
  createShareBuybackOffer: (businessId: string, data: { shareholderId: string; amount: number; message?: string }) =>
    api.post<{ offer: YouBusinessBuyoutOffer }>(`/you/businesses/${businessId}/share-buyback-offers`, data),
  createShareholderProposal: (businessId: string, data: { sharePercent: number; amount: number; message?: string }) =>
    api.post<{ proposal: YouBusinessShareProposal }>(`/you/businesses/${businessId}/shareholder-proposals`, data),
  respondToBuyoutOffer: (offerId: string, decision: 'accept' | 'reject') =>
    api.post<{ result: { id: string; status: string; decidedAt: string | null } }>(`/you/buyout-offers/${offerId}/respond`, { decision }),
  respondToShareholderProposal: (proposalId: string, decision: 'accept' | 'reject') =>
    api.post<{ result: { id: string; status: string; decidedAt: string | null } }>(`/you/shareholder-proposals/${proposalId}/respond`, { decision }),
  cancelBuyoutOffer: (offerId: string) =>
    api.delete<{ result: { id: string; status: string; decidedAt: string | null } }>(`/you/buyout-offers/${offerId}`),
  createRelationship: (targetUserId: string, type: 'FRIEND' | 'DATING' = 'DATING') =>
    api.post<{ relationship: YouRelationship }>('/you/relationships', { targetUserId, type }),
  proposeMarriage: (relationshipId: string, message?: string) =>
    api.post<{ proposal: Omit<YouMarriageProposal, 'direction' | 'canRespond' | 'respondedAt'> & { respondedAt?: string | null } }>(`/you/relationships/${relationshipId}/actions/propose-marriage`, { message }),
  respondToMarriageProposal: (proposalId: string, decision: 'accept' | 'reject') =>
    api.post<{ proposal: { id: string; status: string; respondedAt: string | null }; relationship: YouRelationship }>(`/you/marriage-proposals/${proposalId}/respond`, { decision }),
  divorceRelationship: (relationshipId: string, message?: string) =>
    api.post<{ proposal: { id: string; status: string; createdAt: string; respondedAt: string | null } }>(`/you/relationships/${relationshipId}/actions/divorce`, { message }),
  respondToDivorceProposal: (proposalId: string, decision: 'accept' | 'reject') =>
    api.post<{ proposal: { id: string; status: string; respondedAt: string | null }; relationship: YouRelationship }>(`/you/divorce-proposals/${proposalId}/respond`, { decision }),
  coupleDeposit: (relationshipId: string, amount: number) =>
    api.post<{ relationship: YouRelationship }>(`/you/relationships/${relationshipId}/actions/couple-deposit`, { amount }),
  coupleWithdraw: (relationshipId: string, amount: number) =>
    api.post<{ relationship: YouRelationship }>(`/you/relationships/${relationshipId}/actions/couple-withdraw`, { amount }),
  forgetRelationship: (relationshipId: string) =>
    api.delete<{ ok: boolean }>(`/you/relationships/${relationshipId}`),
  makeMistress: (relationshipId: string) =>
    api.post<{ relationship: YouRelationship }>(`/you/relationships/${relationshipId}/actions/make-mistress`, {}),
  suspectCheating: (relationshipId: string) =>
    api.post<{ correct: boolean }>(`/you/relationships/${relationshipId}/actions/suspect-cheating`, {}),
  respondToCourtCase: (accusationId: string, decision: 'court' | 'drop') =>
    api.post<{ decision: string }>(`/you/cheating-accusations/${accusationId}/respond`, { decision }),
  deleteBusiness: (businessId: string) =>
    api.delete<{ result: { id: string } }>(`/you/businesses/${businessId}`),
  updateBusinessProfile: (businessId: string, data: { name?: string; description?: string | null; logoUrl?: string | null }) =>
    api.patch<{ result: { name: string; description: string | null; logoUrl: string | null } }>(`/you/businesses/${businessId}/profile`, data),
  buyLivretEpargneUpgrade: (businessId: string) =>
    api.post<{ result: { livretEpargneUnlocked: boolean } }>(`/you/businesses/${businessId}/upgrades/livret-epargne`, {}),
  setLoanRate: (businessId: string, rate: number) =>
    api.post<{ result: { loanInterestRate: number } }>(`/you/businesses/${businessId}/set-loan-rate`, { rate }),
  setTransferFeeRate: (businessId: string, rate: number) =>
    api.post<{ result: { transferFeeRate: number } }>(`/you/businesses/${businessId}/set-transfer-fee-rate`, { rate }),
  updateBusinessMenu: (businessId: string, menu: Array<{ key: string; label: string; price: number; emoji?: string }>) =>
    api.post<{ result: { success: boolean } }>(`/you/businesses/${businessId}/update-menu`, { menu }),
  getBusinessTransactions: (businessId: string) =>
    api.get<{ transactions: YouBusinessTransaction[] }>(`/you/businesses/${businessId}/transactions`),
  getBankAccounts: (businessId: string) =>
    api.get<{ accounts: YouBankAccount[] }>(`/you/businesses/${businessId}/bank-accounts`),
  openBankAccount: (businessId: string, accountType: 'COURANT' | 'EPARGNE') =>
    api.post<{ account: YouBankAccount }>(`/you/businesses/${businessId}/bank-accounts`, { accountType }),
  bankAccountDeposit: (accountId: string, amount: number) =>
    api.post<{ result: { newBalance: number } }>(`/you/bank-accounts/${accountId}/deposit`, { amount }),
  bankAccountWithdraw: (accountId: string, amount: number) =>
    api.post<{ result: { newBalance: number } }>(`/you/bank-accounts/${accountId}/withdraw`, { amount }),
  setFormationDetails: (businessId: string, data: { formationUrl: string | null; formationPrice: number }) =>
    api.patch<{ result: { formationUrl: string | null; formationPrice: number } }>(`/you/businesses/${businessId}/formation`, data),
  buyFormation: (businessId: string) =>
    api.post<{ result: { formationUrl: string; price: number } }>(`/you/businesses/${businessId}/buy-formation`, {}),
  listFormationProducts: (businessId: string) =>
    api.get<{ result: { products: YouFormationProduct[] } }>(`/you/businesses/${businessId}/formations`),
  addFormationProduct: (businessId: string, data: { title: string; description?: string; price: number; url?: string | null; imageUrl?: string; attachment?: FormationAttachmentInput | null }) =>
    api.post<{ result: { product: YouFormationProduct } }>(`/you/businesses/${businessId}/formations`, data),
  updateFormationProduct: (businessId: string, productId: string, data: Partial<{ title: string; description: string | null; price: number; url: string | null; imageUrl: string | null; attachment: FormationAttachmentInput | null; removeAttachment: boolean }>) =>
    api.patch<{ result: { product: YouFormationProduct } }>(`/you/businesses/${businessId}/formations/${productId}`, data),
  deleteFormationProduct: (businessId: string, productId: string) =>
    api.delete<{ result: { ok: boolean } }>(`/you/businesses/${businessId}/formations/${productId}`),
  listPendingFormationProductsForAdmin: () =>
    api.get<{ products: PendingFormationReviewItem[] }>('/you/admin/formations/pending'),
  reviewFormationProduct: (businessId: string, productId: string, decision: 'approve' | 'reject', reviewerNote?: string) =>
    api.post<{ result: YouFormationProduct }>(`/you/businesses/${businessId}/formations/${productId}/review`, { decision, reviewerNote }),
  buyFormationProduct: (businessId: string, productId: string) =>
    api.post<{ result: { url: string | null; title: string; price: number; hasAttachment?: boolean; attachmentOriginalName?: string | null; attachmentMimeType?: string | null } }>(`/you/businesses/${businessId}/formations/${productId}/buy`, {}),
  accessFormationProduct: (businessId: string, productId: string) =>
    api.post<{ result: FormationProductAccessResult }>(`/you/businesses/${businessId}/formations/${productId}/access`, {}),
  getFormationDownloadUrl: (businessId: string, productId: string) =>
    `${API_BASE}/you/businesses/${businessId}/formations/${productId}/download`,
  downloadFormationProductFile: (businessId: string, productId: string) =>
    api.get<Blob>(`/you/businesses/${businessId}/formations/${productId}/download`, { responseType: 'blob' }),
  rateFormationProduct: (businessId: string, productId: string, rating: number, comment?: string) =>
    api.post<{ ok: boolean }>(`/you/businesses/${businessId}/formations/${productId}/rate`, { rating, comment }),
  markReviewPromptShown: (data: { businessId?: string; productId?: string }) =>
    api.post<{ result: { ok: boolean } }>('/you/review-prompts/seen', data),
  setBusinessSupportAgent: (businessId: string, supportAgentId: string | null) =>
    api.patch<{ result: { supportAgent: BusinessSupportAgentSummary | null; supportEnabled: boolean } }>(`/you/businesses/${businessId}/support-agent`, { supportAgentId }),
  openBusinessSupportConversation: (businessId: string) =>
    api.post<{ result: { conversationId: string } }>(`/you/businesses/${businessId}/support/conversation`, {}),
  updateLawFirmMemberMetadata: (businessId: string, memberId: string, data: { specialty?: string | null; isPrimaryLawyer?: boolean; displayOrder?: number }) =>
    api.patch<{ result: { memberId: string; specialty: string | null; isPrimaryLawyer: boolean; displayOrder: number; user: Omit<YouPlayer, 'alreadyInRelationship'> } }>(`/you/businesses/${businessId}/members/${memberId}/lawyer-profile`, data),
  updateMemberSalary: (businessId: string, memberId: string, salary: number) =>
    api.patch<{ result: { salary: number } }>(`/you/businesses/${businessId}/members/${memberId}/salary`, { salary }),
  updateMemberProfile: (businessId: string, memberId: string, title: string | null) =>
    api.patch<{ result: { memberId: string; title: string | null } }>(`/you/businesses/${businessId}/members/${memberId}/profile`, { title }),
  sackMember: (businessId: string, memberId: string) =>
    api.delete<{ result: { ok: boolean } }>(`/you/businesses/${businessId}/members/${memberId}`),
  repayLoan: (loanId: string) =>
    api.post<{ result: { repaid: number; totalOwed: number; collateralClaimed: number; status: string } }>(`/you/loans/${loanId}/repay`, {}),
  borrowerRepayLoan: (loanId: string, percentage: number = 100) =>
    api.post<{ result: { repaid: number; totalOwed: number; collateralClaimed: number; status: string } }>(`/you/loans/${loanId}/borrower-repay`, { percentage }),
  purchaseItem: (businessId: string, itemKey: string) =>
    api.post<{ result: { item: string; price: number } }>(`/you/businesses/${businessId}/actions/purchase_item`, { itemKey }),
  collectNpc: (businessId: string) =>
    api.post<{ result: { amount: number } }>(`/you/businesses/${businessId}/actions/collect_npc`, {}),
  rateBusiness: (businessId: string, rating: number, comment?: string) =>
    api.post<{ ok: boolean }>(`/you/businesses/${businessId}/rate`, { rating, comment }),
  rateLawyerForCase: (caseId: string, lawyerUserId: string, rating: number, comment?: string) =>
    api.post<{ ok: boolean }>(`/you/court-cases/${caseId}/lawyers/${lawyerUserId}/rate`, { rating, comment }),
};

export interface Ad {
  id: string;
  businessId: string;
  title: string;
  tagline: string;
  imageUrl: string | null;
  ctaText: string;
  ctaLink: string;
  adType: 'CARD' | 'BANNER' | 'INTERSTITIAL';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  isActive: boolean;
  impressions: number;
  clicks: number;
  reviewedAt: string | null;
  reviewedById: string | null;
  createdAt: string;
  updatedAt: string;
  business: {
    id: string;
    name: string;
    logoUrl?: string | null;
    verified: boolean;
  };
}

export interface AdCreateInput {
  businessId: string;
  title: string;
  tagline: string;
  imageUrl?: string | null;
  ctaText?: string;
  ctaLink: string;
  adType: 'CARD' | 'BANNER' | 'INTERSTITIAL';
}

export interface PendingAdReview extends Ad {
  business: Ad['business'] & {
    owner: {
      id: string;
      username: string;
      profilePicture?: string | null;
    };
  };
}

export const adsApi = {
  create: (data: AdCreateInput) => api.post<{ ad: Ad }>('/ads', data),
  listOwn: () => api.get<{ ads: Ad[] }>('/ads'),
  listPublic: (params?: { type?: 'CARD' | 'BANNER' | 'INTERSTITIAL'; limit?: number }) =>
    api.get<{ ads: Ad[] }>('/ads/public', { params }),
  update: (id: string, data: Partial<AdCreateInput & { isActive: boolean }>) =>
    api.patch<{ ad: Ad }>(`/ads/${id}`, data),
  delete: (id: string) => api.delete<{ ok: boolean }>(`/ads/${id}`),
  trackImpression: (id: string) => api.post<{ ok: boolean }>(`/ads/${id}/impression`, {}),
  trackClick: (id: string) => api.post<{ ok: boolean }>(`/ads/${id}/click`, {}),
};

// Economy API
export interface AuraTransferEntry {
  id: string;
  senderId: string;
  receiverId: string;
  auraAmount: number;
  moneyAmount: number;
  isGift: boolean;
  message: string | null;
  createdAt: string;
  direction: 'GIVE' | 'TAKE';
  sender: {
    id: string;
    username: string;
    usernameColor?: string | null;
  } | null;
  receiver: {
    id: string;
    username: string;
    usernameColor?: string | null;
  } | null;
}

export interface DailyAuraState {
  dailyAuraGiven: number;
  dailyAuraLimit: number;
  remainingAura: number;
  lastDailyReset: string;
  nextResetAt: string;
}

export const economyApi = {
  transfer: (data: { receiverId: string; auraAmount: number; message: string }) =>
    api.post<{ success: boolean; transfer: AuraTransferEntry; state: Omit<DailyAuraState, 'nextResetAt'> }>('/economy/transfer', data),
  getTransfers: (params?: { userId?: string; limit?: number; offset?: number; all?: boolean }) =>
    api.get<{ transfers: AuraTransferEntry[] }>('/economy/transfers', { params }),
  getState: () =>
    api.get<{ state: DailyAuraState }>('/economy/state'),
  getBalance: (userId: string) => api.get(`/economy/balance/${userId}`),
};

export interface PassLootItem {
  id: string;
  name: string;
  description: string;
  type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE';
  price: number;
  imageUrl: string | null;
}

export interface PassRewardEntry {
  type: 'money' | 'aura' | 'item';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  label: string;
  amount?: number;
  quantity?: number;
  item?: PassLootItem;
}

export interface PassStatus {
  streak: number;
  status: 'available' | 'claimed';
  resetNotice: boolean;
  nextReset: string;
  itemDropChance: number;
  moneyRange: { min: number; max: number };
  auraRange: { min: number; max: number };
  featuredItems: PassLootItem[];
}

export interface PassClaimResponse {
  success: boolean;
  streak: number;
  boxName: string;
  rewards: PassRewardEntry[];
  newBalance: {
    money: number;
    aura: number;
  };
}

export const passApi = {
  getStatus: () => api.get<PassStatus>('/pass/status'),
  claim: () => api.post<PassClaimResponse>('/pass/claim'),
};

export interface ShopCategory {
  id: string;
  label: string;
}

export interface MarketplaceListingSeller {
  id: string;
  username: string;
  usernameColor: string | null;
  profilePicture: string | null;
}

export interface MarketplaceListingItem {
  id: string;
  name: string;
  description: string;
  type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE' | 'GIFT' | string;
  price: number;
  imageUrl: string | null;
  effect: string | null;
}

export interface MarketplaceListing {
  id: string;
  sellerId: string;
  seller: MarketplaceListingSeller;
  item: MarketplaceListingItem;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: 'ACTIVE' | 'SOLD' | 'CANCELLED' | string;
  createdAt: string;
  updatedAt: string;
  soldAt: string | null;
  cancelledAt: string | null;
}

export interface MarketplaceProductStatsPoint {
  date: string;
  averageUnitPrice: number | null;
  salesCount: number;
}

export interface MarketplaceProductStats {
  itemId: string;
  itemName: string;
  itemType: string;
  imageUrl: string | null;
  averageUnitPrice30d: number | null;
  lowestOffer: number | null;
  highestOffer: number | null;
  soldUnits30d: number;
  revenue30d: number;
  priceEvolutionPct30d: number | null;
  timeline: MarketplaceProductStatsPoint[];
}

// Marketplace API
export const marketplaceApi = {
  getCategories: () => api.get<{ categories: ShopCategory[] }>('/marketplace/categories'),
  getItems: (params?: { type?: string; page?: number; limit?: number }) =>
    api.get('/marketplace/items', { params }),
  purchase: (data: { itemId: string; quantity?: number }) =>
    api.post('/marketplace/purchase', data),
  getInventory: (userId: string) => api.get(`/marketplace/inventory/${userId}`),
  getListings: (params?: { status?: 'ACTIVE' | 'SOLD' | 'CANCELLED' | 'ALL'; sellerId?: string }) =>
    api.get<{ listings: MarketplaceListing[] }>('/marketplace/listings', { params }),
  getListingStats: (days = 30) =>
    api.get<{ days: number; generatedAt: string; products: MarketplaceProductStats[] }>('/marketplace/listings/stats', { params: { days } }),
  createListing: (data: { userItemId: string; quantity: number; unitPrice: number }) =>
    api.post<{ listing: MarketplaceListing }>('/marketplace/listings', data),
  buyListing: (listingId: string) =>
    api.post<{ listing: MarketplaceListing; newBalance: { aura: number; money: number } }>('/marketplace/listings/buy', { listingId }),
  cancelListing: (listingId: string) =>
    api.delete<{ listing: MarketplaceListing }>(`/marketplace/listings/${listingId}`),
  useItem: (userItemId: string, effectData?: { color?: string; imageUrl?: string; name?: string; description?: string; icon?: string; backgroundColor?: string; borderColor?: string; rarity?: string }) =>
    api.post('/marketplace/use-item', { userItemId, effectData }),
  getDoodleSkins: () =>
    api.get<{ static: ShopItem[]; rotating: ShopItem[]; nextRefresh: string }>('/marketplace/doodle-skins'),
  // Admin
  createItem: (data: {
    name: string;
    description: string;
    type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE';
    price: number;
    imageUrl?: string;
    effect?: string;
    expiresAt?: string;
  }) => api.post('/marketplace/admin/item', data),
};

// Games API
export const gamesApi = {
  getStats: (gameType: string, userId: string) =>
    api.get(`/games/${gameType}/stats/${userId}`),
  getCatalogStats: () =>
    api.get<{ global: Record<string, number>; personal: Record<string, number> }>('/games/catalog/stats'),
  startCasino: (bet: number) =>
    api.post<{ success: true; money: number }>('/games/casino/start', { bet }),
  complete: (gameType: string, data: { score: number; won: boolean; duration?: number; bet?: number; netGain?: number; maxTile?: number; difficulty?: string; preDeducted?: boolean }) =>
    api.post(`/games/${gameType}/complete`, data),
  getLeaderboard: (gameType: string, limit?: number) =>
    api.get(`/games/${gameType}/leaderboard`, { params: { limit } }),
  getGoyaveActiveLeaderboard: (limit?: number) =>
    api.get('/games/goyave_empire/active-leaderboard', { params: { limit } }),
  getDailyRacerState: (limit?: number) =>
    api.get<DailyRacerStateResponse>('/games/daily/racer', { params: { limit } }),
  submitDailyRacerRun: (lapTimeMs: number) =>
    api.post<DailyRacerSubmitResponse>('/games/daily/racer/complete', { lapTimeMs }),
  // Admin: Delete a user's game stats
  deleteStats: (gameType: string, userId: string) =>
    api.delete(`/games/${gameType}/stats/${userId}`),
  // Goyave Empire: DB-backed save state
  loadGoyaveSave: () =>
    api.get<{ saveData: string | null }>('/games/goyave_empire/save'),
  saveGoyaveState: (saveData: string) =>
    api.post('/games/goyave_empire/save', { saveData }),
};

// Polytrack API
export interface PolytrackHolder {
  userId: string;
  username: string;
  usernameColor: string | null;
  profilePicture: string | null;
}

export interface PolytrackTrack {
  number: number;
  name: string;
  globalRecord: { timeMs: number; timeDisplay: string; holder: PolytrackHolder | null } | null;
  personalBest: { timeMs: number; timeDisplay: string } | null;
}

export interface PolytrackLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  usernameColor: string | null;
  profilePicture: string | null;
  timeMs: number;
  timeDisplay: string;
  createdAt: string;
}

export const polytrackApi = {
  getTracks: () =>
    api.get<{ tracks: PolytrackTrack[] }>('/polytrack/tracks'),
  submitRecord: (trackNumber: number, timeMs: number) =>
    api.post<{ saved: boolean; isGlobalRecord: boolean; isNewPB: boolean; personalBest: { timeMs: number; timeDisplay: string } }>('/polytrack/records', { trackNumber, timeMs }),
  getLeaderboard: (trackNumber: number, limit?: number) =>
    api.get<{ trackNumber: number; rankings: PolytrackLeaderboardEntry[]; userRank: { rank: number; timeMs: number; timeDisplay: string } | null }>(`/polytrack/leaderboard/${trackNumber}`, { params: { limit } }),
};

export interface ClashPlayerSummary {
  id: string;
  username: string;
  usernameColor: string | null;
  profilePicture: string | null;
}

export interface ClashBuilding {
  id: string;
  type: 'townHall' | 'goldStorage' | 'vault' | 'cannon' | 'wall';
  level: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  storageCapacity?: number;
  defensePower?: number;
  protectionPct?: number;
}

export interface ClashTroop {
  type: 'barbarian' | 'archer' | 'giant';
  count: number;
}

export interface ClashVillageState {
  id: string;
  townHallLevel: number;
  moneyInStorage: number;
  trophies: number;
  shieldUntil: string | null;
  attackCooldownUntil: string | null;
  storageCapacity: number;
  defenseRating: number;
  vaultProtectionPct: number;
  layout: Array<{
    id: string;
    type: ClashBuilding['type'];
    x: number;
    y: number;
  }>;
  buildings: ClashBuilding[];
  troops: ClashTroop[];
  user: ClashPlayerSummary | null;
}

export interface ClashActivity {
  id: string;
  villageId: string;
  type: string;
  title: string;
  detail: string;
  deltaMoney: number;
  deltaTrophies: number;
  relatedUserId: string | null;
  createdAt: string;
}

export interface ClashBattleEntry {
  id: string;
  createdAt: string;
  opponent: ClashPlayerSummary;
  destructionPercent: number;
  moneyStolen: number;
  trophiesDelta: number;
  result: Record<string, unknown>;
}

export interface ClashStateResponse {
  village: ClashVillageState | null;
  activities: ClashActivity[];
  recentAttacks: ClashBattleEntry[];
  recentDefenses: ClashBattleEntry[];
}

export interface ClashTarget {
  user: ClashPlayerSummary | null;
  village: ClashVillageState;
  availableLoot: number;
}

export interface ClashLeaderboardEntry {
  rank: number;
  user: ClashPlayerSummary | null;
  trophies?: number;
  moneyInStorage?: number;
  townHallLevel?: number;
  totalLoot?: number;
  averageDefense?: number | null;
  defenseCount?: number;
}

export const clashApi = {
  getState: () => api.get<ClashStateResponse>('/clash/state'),
  bootstrap: () => api.post<ClashStateResponse>('/clash/bootstrap'),
  deleteVillage: () => api.delete<{ success: boolean; villageDeleted: boolean }>('/clash/village'),
  upgrade: (buildingType: ClashBuilding['type']) =>
    api.post<ClashStateResponse & { upgrade: { buildingType: ClashBuilding['type']; cost: number; newBalance: { money: number } } }>('/clash/upgrade', { buildingType }),
  getMatchmaking: () => api.get<{ targets: ClashTarget[] }>('/clash/matchmaking'),
  attack: (defenderUserId: string, attackPlan?: Array<{ troopType: ClashTroop['type']; count: number }>) =>
    api.post<ClashStateResponse & {
      attack: {
        id: string;
        createdAt: string;
        defender: ClashVillageState | null;
        destructionPercent: number;
        moneyStolen: number;
        trophiesDeltaAttacker: number;
        trophiesDeltaDefender: number;
        result: Record<string, unknown>;
      };
    }>('/clash/attack', { defenderUserId, attackPlan }),
  getHistory: () =>
    api.get<{ attacks: ClashBattleEntry[]; defenses: ClashBattleEntry[]; activities: ClashActivity[] }>('/clash/history'),
  getLeaderboard: () =>
    api.get<{ trophies: ClashLeaderboardEntry[]; loot: ClashLeaderboardEntry[]; defense: ClashLeaderboardEntry[] }>('/clash/leaderboard'),
};

export interface DailyRacerLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  usernameColor: string | null;
  bestLapTimeMs: number;
  achievedAt: string;
}

export interface DailyRacerStateResponse {
  trackDate: string;
  seed: number;
  leaderboard: DailyRacerLeaderboardEntry[];
  userBestLapTimeMs: number | null;
  userRunCount: number;
}

export interface DailyRacerSubmitResponse {
  success: boolean;
  run: {
    id: string;
    lapTimeMs: number;
    trackDate: string;
    createdAt: string;
  };
  rewards: {
    money: number;
    aura: number;
    isFirstRunToday: boolean;
    isNewDailyBest: boolean;
  };
  isNewDailyBest: boolean;
  bestLapTimeMs: number;
}

// AuraCoin API
export interface AuraCoinPriceHistory {
  price: number;
  volume: number;
  createdAt: string;
}

export interface AuraCoinTransaction {
  id: string;
  userId: string;
  type: 'BUY' | 'SELL';
  coinAmount: number;
  moneyAmount: number;
  price: number;
  fee: number;
  createdAt: string;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
  };
}

export interface AuraCoinLeaderboardEntry {
  id: string;
  username: string;
  usernameColor: string | null;
  auraCoinBalance: number;
}

export const auraCoinApi = {
  getPrice: (hours?: number) =>
    api.get<{
      currentPrice: number;
      feePercentage: number;
      history: AuraCoinPriceHistory[];
      userBalance: { auraCoin: number; money: number };
    }>('/auracoin/price', { params: { hours } }),
  getLeaderboard: (limit?: number) =>
    api.get<{ leaderboard: AuraCoinLeaderboardEntry[] }>('/auracoin/leaderboard', { params: { limit } }),
  buy: (moneyAmount: number) =>
    api.post<{
      success: boolean;
      transaction: {
        type: 'BUY';
        coinsReceived: number;
        moneySpent: number;
        fee: number;
        newPrice: number;
      };
      newBalance: { money: number; auraCoin: number };
    }>('/auracoin/buy', { moneyAmount }),
  sell: (coinAmount: number) =>
    api.post<{
      success: boolean;
      transaction: {
        type: 'SELL';
        coinsSold: number;
        moneyReceived: number;
        fee: number;
        newPrice: number;
      };
      newBalance: { money: number; auraCoin: number };
    }>('/auracoin/sell', { coinAmount }),
  getMyTransactions: (params?: { limit?: number; offset?: number }) =>
    api.get<{ transactions: AuraCoinTransaction[] }>('/auracoin/transactions/me', { params }),
  getAllTransactions: (params?: { limit?: number; offset?: number }) =>
    api.get<{ transactions: AuraCoinTransaction[] }>('/auracoin/transactions/all', { params }),
  openPosition: (type: 'LONG' | 'SHORT', leverage: number, marginAmount: number) =>
    api.post<{
      success: boolean;
      position: {
        id: string;
        type: string;
        leverage: number;
        entryPrice: number;
        coinAmount: number;
        marginAmount: number;
        createdAt: string;
      };
      newBalance: { money: number };
    }>('/auracoin/position/open', { type, leverage, marginAmount }),
  closePosition: (positionId: string) =>
    api.post<{
      success: boolean;
      position: {
        id: string;
        pnl: number;
        exitPrice: number;
        closedAt: string;
      };
      newBalance: { money: number };
    }>(`/auracoin/position/close/${positionId}`),
  getOpenPositions: () =>
    api.get<{
      positions: Array<{
        id: string;
        type: string;
        leverage: number;
        entryPrice: number;
        coinAmount: number;
        marginAmount: number;
        currentPrice: number;
        pnl: number;
        currentMargin: number;
        marginRatio: number;
        pnlPercentage: number;
        createdAt: string;
      }>;
    }>('/auracoin/positions/open'),
  getClosedPositions: (params?: { limit?: number; offset?: number }) =>
    api.get<{
      positions: Array<{
        id: string;
        type: string;
        leverage: number;
        entryPrice: number;
        exitPrice: number | null;
        coinAmount: number;
        marginAmount: number;
        pnl: number | null;
        liquidated: boolean;
        createdAt: string;
        closedAt: string | null;
      }>;
    }>('/auracoin/positions/closed', { params }),
};

export interface AuraCoinPosition {
  id: string;
  type: 'LONG' | 'SHORT';
  leverage: number;
  entryPrice: number;
  coinAmount: number;
  marginAmount: number;
  currentPrice?: number;
  pnl?: number;
  currentMargin?: number;
  marginRatio?: number;
  pnlPercentage?: number;
  isOpen: boolean;
  liquidated: boolean;
  createdAt: string;
  closedAt?: string | null;
  exitPrice?: number | null;
}

export type MarketCoinKey = 'stable-coin' | 'chaos-coin';

export interface MarketCoinPriceHistory {
  price: number;
  volume: number;
  createdAt: string;
}

export interface MarketCoinTransaction {
  id: string;
  userId: string;
  type: 'BUY' | 'SELL';
  coinAmount: number;
  moneyAmount: number;
  price: number;
  fee: number;
  createdAt: string;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
  };
}

export interface MarketCoinLeaderboardEntry {
  id: string;
  username: string;
  usernameColor: string | null;
  coinBalance: number;
}

export interface MarketCoinPosition {
  id: string;
  type: 'LONG' | 'SHORT';
  leverage: number;
  entryPrice: number;
  coinAmount: number;
  marginAmount: number;
  currentPrice?: number;
  pnl?: number | null;
  currentMargin?: number;
  marginRatio?: number;
  pnlPercentage?: number;
  isOpen?: boolean;
  liquidated?: boolean;
  createdAt: string;
  closedAt?: string | null;
  exitPrice?: number | null;
}

export interface TradingTerminalApi {
  getPrice: (hours?: number) => Promise<{
    data: {
      currentPrice: number;
      feePercentage: number;
      history: Array<{ price: number; volume: number; createdAt: string }>;
      userBalance: { coin: number; money: number };
    };
  }>;
  buy: (moneyAmount: number) => Promise<{
    data: {
      success: boolean;
      transaction: { type: 'BUY'; coinsReceived: number; moneySpent: number; fee: number; newPrice: number };
      newBalance: { money: number; coin: number };
    };
  }>;
  sell: (coinAmount: number) => Promise<{
    data: {
      success: boolean;
      transaction: { type: 'SELL'; coinsSold: number; moneyReceived: number; fee: number; newPrice: number };
      newBalance: { money: number; coin: number };
    };
  }>;
  getMyTransactions: (params?: { limit?: number; offset?: number }) => Promise<{ data: { transactions: MarketCoinTransaction[] } }>;
  getAllTransactions: (params?: { limit?: number; offset?: number }) => Promise<{ data: { transactions: MarketCoinTransaction[] } }>;
  openPosition: (type: 'LONG' | 'SHORT', leverage: number, marginAmount: number) => Promise<{
    data: {
      success: boolean;
      position: {
        id: string;
        type: string;
        leverage: number;
        entryPrice: number;
        coinAmount: number;
        marginAmount: number;
        createdAt: string;
      };
      newBalance: { money: number };
    };
  }>;
  closePosition: (positionId: string) => Promise<{
    data: {
      success: boolean;
      position: { id: string; pnl: number; exitPrice: number; closedAt: string };
      newBalance: { money: number };
    };
  }>;
  getOpenPositions: () => Promise<{ data: { positions: MarketCoinPosition[] } }>;
  getClosedPositions: (params?: { limit?: number; offset?: number }) => Promise<{ data: { positions: MarketCoinPosition[] } }>;
}

const createMarketCoinApi = (coinKey: MarketCoinKey): TradingTerminalApi & {
  getLeaderboard: (limit?: number) => Promise<{ data: { leaderboard: MarketCoinLeaderboardEntry[] } }>;
} => ({
  getPrice: (hours?: number) => api.get(`/market-room/${coinKey}/price`, { params: { hours } }),
  getLeaderboard: (limit?: number) => api.get(`/market-room/${coinKey}/leaderboard`, { params: { limit } }),
  buy: (moneyAmount: number) => api.post(`/market-room/${coinKey}/buy`, { moneyAmount }),
  sell: (coinAmount: number) => api.post(`/market-room/${coinKey}/sell`, { coinAmount }),
  getMyTransactions: (params?: { limit?: number; offset?: number }) => api.get(`/market-room/${coinKey}/transactions/me`, { params }),
  getAllTransactions: (params?: { limit?: number; offset?: number }) => api.get(`/market-room/${coinKey}/transactions/all`, { params }),
  openPosition: (type: 'LONG' | 'SHORT', leverage: number, marginAmount: number) =>
    api.post(`/market-room/${coinKey}/position/open`, { type, leverage, marginAmount }),
  closePosition: (positionId: string) => api.post(`/market-room/${coinKey}/position/close/${positionId}`),
  getOpenPositions: () => api.get(`/market-room/${coinKey}/positions/open`),
  getClosedPositions: (params?: { limit?: number; offset?: number }) => api.get(`/market-room/${coinKey}/positions/closed`, { params }),
});

export const marketRoomApi = {
  getCoin: (coinKey: MarketCoinKey) => createMarketCoinApi(coinKey),
  getCoins: () =>
    api.get<{
      coins: Array<{
        key: MarketCoinKey;
        name: string;
        symbol: string;
        description: string;
        personality: 'STABLE' | 'VOLATILE';
        color: string;
      }>;
    }>('/market-room/coins'),
};

// Leaderboards API
export const leaderboardsApi = {
  get: (category: string, params?: { limit?: number; offset?: number; seasonId?: string; period?: 'daily' | 'weekly' | 'monthly' }) =>
    api.get(`/leaderboards/${category}`, { params }),
  getUserRankings: (userId: string) => api.get(`/leaderboards/user/${userId}`),
};

// Clans API
export interface ClanSummary {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  banner: string | null;
  isPublic: boolean;
  createdAt: string;
  maxMembers: number;
  memberCount: number;
  totalAura: number | string;
  leader: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
  };
  tagUnlocked: boolean;
  tagText: string | null;
  tagStyle: string | null;
  slotUpgraded: boolean;
  warTrophies: number;
  warWins: number;
  warLosses: number;
  warDraws: number;
  clanBankMoney: number;
  nation: {
    tier: number;
    hierarchyName: string;
    influence: number;
    intimidation: number;
    marketControl: number;
    territoryKey: string;
    territory: {
      key: string;
      label: string;
      region: string;
      x: number;
      y: number;
      bonus: string;
    };
    flag: {
      primary: string;
      secondary: string;
      accent: string;
      pattern: string;
      icon: string;
    };
    alliances: Array<{
      clanId: string;
      name: string;
      status: 'ALLY' | 'BROKEN';
      forgedAt: string;
      betrayedAt?: string | null;
    }>;
    allianceRequests: Array<{
      clanId: string;
      name: string;
      requestedAt: string;
    }>;
    arsenal: Record<string, number>;
    injuries: Array<{
      userId: string;
      username: string;
      severity: number;
      createdAt: string;
    }>;
    blackMarketCatalog: Array<{
      key: string;
      label: string;
      price: number;
      disabledSlots: number;
      penaltyPoints: number;
    }>;
    territories: Array<{
      key: string;
      label: string;
      region: string;
      x: number;
      y: number;
      bonus: string;
    }>;
  };
}

export interface ClanMember {
  id: string;
  userId: string;
  username: string;
  usernameColor: string | null;
  aura: number | string;
  profilePicture: string | null;
  joinedAt: string;
  isLeader: boolean;
}

export interface ClanJoinRequest {
  id: string;
  userId: string;
  username: string;
  usernameColor: string | null;
  aura: number | string;
  profilePicture: string | null;
  requestedAt: string;
}

export interface ClanDetail extends ClanSummary {
  members: ClanMember[];
  joinRequests: ClanJoinRequest[];
  viewer: {
    isMember: boolean;
    isLeader: boolean;
    hasPendingRequest: boolean;
  };
  bankContributionHistory: ClanBankContribution[];
  ownedItems: ClanOwnedItem[];
  activeEffects: ClanActiveEffect[];
  warHub: ClanWarHub;
  nationHub: {
    canManageAlliances: boolean;
    canUseBlackMarket: boolean;
    weeklyWarCadenceDays: number;
    weeklyBoostPrice: number;
    blackMarketCatalog: ClanSummary['nation']['blackMarketCatalog'];
    mapTerritories: ClanSummary['nation']['territories'];
  };
}

export interface ClanBankContribution {
  id: string;
  amount: number;
  createdAt: string;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
  };
}

export interface ClanOwnedItem {
  id: string;
  quantity: number;
  acquiredAt: string;
  item: ShopItem;
}

export interface ClanActiveEffect {
  id: string;
  type: string;
  name: string;
  description: string | null;
  value: number;
  durationHours: number;
  cooldownHours: number;
  activatedAt: string | null;
  activeUntil: string | null;
  cooldownUntil: string | null;
  isActive: boolean;
  isOnCooldown: boolean;
}

export interface ClanChatMessage {
  id: string;
  message: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
  };
}

export interface ClanPumpUpMessage {
  id: string;
  content: string;
  color: string;
  createdAt: string;
}

export interface ClanWarActionType {
  type: 'RAID' | 'SIEGE' | 'SABOTAGE';
  label: string;
  description: string;
  staminaCost: number;
  minPoints: number;
  maxPoints: number;
  structureDamage: number;
}

export interface ClanWarDefenseType {
  type: 'FORTRESS' | 'ARMORY' | 'BANNER';
  label: string;
  description: string;
  baseDurability: number;
  durabilityPerLevel: number;
  maxLevel: number;
}

export interface ClanWarDefenseState {
  type: ClanWarDefenseType['type'];
  label: string;
  description: string;
  level: number;
  durability: number;
  maxDurability: number;
  isActive: boolean;
  contributions: number;
}

export interface ClanWarAttackLog {
  id: string;
  attackType: ClanWarActionType['type'];
  attackLabel: string;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
  };
  attackingClan: {
    id: string;
    name: string;
  };
  targetClan: {
    id: string;
    name: string;
  };
  staminaCost: number;
  basePoints: number;
  bonusPoints: number;
  defenseMitigation: number;
  structureDamage: number;
  finalPoints: number;
  createdAt: string;
}

export interface ClanWarFortificationLog {
  id: string;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
  };
  clanId: string;
  defenseType: ClanWarDefenseType['type'];
  defenseLabel: string;
  levelAdded: number;
  durabilityAdded: number;
  createdAt: string;
}

export interface ClanWarParticipantStats {
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
  };
  clanId: string;
  clanName: string;
  attackCount: number;
  attackPoints: number;
  staminaSpent: number;
  fortificationsUsed: number;
  fortificationLevelsAdded: number;
  fortificationDurabilityAdded: number;
  memoryRuns: number;
  bombRuns: number;
  bombPoints: number;
  navalShotsUsed: number;
  navalHits: number;
  navalPoints: number;
  totalCombatPoints: number;
  totalSupportActions: number;
  hasCompletedCombat: boolean;
  hasCompletedSupport: boolean;
}

export interface ClanWarState {
  id: string;
  status: 'PREPARING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startsAt: string;
  endsAt: string;
  completedAt: string | null;
  targetScore: number;
  attackerScore: number;
  defenderScore: number;
  scoreGap: number;
  trophyChanges: {
    attacker: number;
    defender: number;
  };
  viewerSide: 'ATTACKER' | 'DEFENDER' | 'SPECTATOR';
  viewerScore: number;
  opponentScore: number;
  attackerClan: ClanSummary;
  defenderClan: ClanSummary;
  winnerClan: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
  winnerUser: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
  } | null;
  rewardTable: {
    winner: {
      money: number;
      aura: number;
      trophies: number;
    };
    loser: {
      money: number;
      aura: number;
      trophies: number;
    };
  };
  nationWar: {
    weekKey: string;
    boosts: {
      attacker: number;
      defender: number;
    };
    penalties: {
      attacker: number;
      defender: number;
    };
    disabledSlots: {
      attacker: number;
      defender: number;
    };
    winnerBy: string;
  };
  defenses: {
    attacker: ClanWarDefenseState[];
    defender: ClanWarDefenseState[];
  };
  participantStats: {
    attacker: ClanWarParticipantStats[];
    defender: ClanWarParticipantStats[];
  };
  viewerActions: {
    staminaCap: number;
    staminaUsed: number;
    staminaRemaining: number;
    fortificationsCap: number;
    fortificationsUsed: number;
    fortificationsRemaining: number;
  };
  recentAttacks: ClanWarAttackLog[];
  recentFortifications: ClanWarFortificationLog[];
}

export interface ClanWarHub {
  currentWar: ClanWarState | null;
  history: ClanWarState[];
  eligibleOpponents: ClanSummary[];
  closestTrophyGap: number | null;
  cooldownEndsAt: string | null;
  canDeclareWar: boolean;
  minimumMembersRequired: number;
  attackTypes: ClanWarActionType[];
  defenseTypes: ClanWarDefenseType[];
}

export interface ClansListResponse {
  clans: ClanSummary[];
  meta: {
    viewerClanId: string | null;
    viewerIsClanLeader: boolean;
    activeWars: ClanWarState[];
  };
}

export interface ClanWarNavalShot {
  x: number;
  y: number;
  isHit: boolean;
  building: string | null;
  points: number;
  isOwnShot: boolean;
}

export interface ClanWarGamesStatus {
  war: null | { id: string };
  warStatus: 'PREPARING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  warId: string;
  memoryPlayedToday: boolean;
  bombPlayedToday: boolean;
  canPlayMemory: boolean;
  canPlayBomb: boolean;
  naval: {
    boardId: string | null;
    shotsUsed: number;
    shotsRemaining: number;
    shots: ClanWarNavalShot[];
  } | null;
}

export interface ClanEventRewardTier {
  id: string;
  title: string;
  minRank: number;
  maxRank: number;
  moneyReward: number;
  auraReward: number;
  item?: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
}

export interface ClanEventLeaderboardEntry {
  rank: number | null;
  totalPoints: number;
  clan: {
    id: string;
    name: string;
    imageUrl: string | null;
    warTrophies: number;
    level: number;
    memberCount: number;
  };
}

export interface ClanEventQuestProgress {
  currentValue: number;
  completedAt: string | null;
  isCompleted: boolean;
}

export interface ClanEventQuest {
  id: string;
  title: string;
  description: string | null;
  activityType: string;
  targetValue: number;
  pointsReward: number;
  sortOrder: number;
  progress: ClanEventQuestProgress;
}

export interface ClanEventMiniGame {
  id: string;
  title: string;
  description: string | null;
  type: 'REFLEX' | 'TAP_FRENZY';
  instructions: string | null;
  scoreMultiplier: number;
  flatPointsBonus: number;
  maxPointsPerAttempt: number;
  maxAttemptsPerUser: number | null;
  cooldownMinutes: number;
  config: Record<string, unknown> | null;
  viewerStats: {
    attemptsUsed: number;
    bestScore: number;
    lastPlayedAt: string | null;
    nextAvailableAt: string | null;
  };
}

export interface ClanEventActivityFeedItem {
  id: string;
  sourceType: string;
  label: string;
  points: number;
  createdAt: string;
  clan: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
  } | null;
  metadata: Record<string, unknown> | null;
}

export interface ClanEventView {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  bannerUrl: string | null;
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'DRAFT' | 'CANCELLED';
  highlightColor: string | null;
  rulesSummary: string | null;
  startsAt: string;
  endsAt: string;
  finalizedAt: string | null;
  rewardsDistributedAt: string | null;
  canParticipate: boolean;
  selectedClanEntry: ClanEventLeaderboardEntry | null;
  viewerClanEntry: ClanEventLeaderboardEntry | null;
  leaderboard: ClanEventLeaderboardEntry[];
  rewardTiers: ClanEventRewardTier[];
  quests: ClanEventQuest[];
  miniGames: ClanEventMiniGame[];
  recentActivity: ClanEventActivityFeedItem[];
}

export const clansApi = {
  list: () => api.get<ClansListResponse>('/clans'),
  myStatus: () => api.get<{ inClan: boolean; isLeader?: boolean; tagUnlocked: boolean; slotUpgraded: boolean; maxMembers: number; clanBankMoney: number }>('/clans/me/status'),
  getById: (id: string) => api.get<{ clan: ClanDetail }>(`/clans/${id}`),
  getGlobalWarHistory: () => api.get<{ wars: ClanWarState[] }>('/clans/wars/history'),
  getChat: (id: string, limit = 50) => api.get<{ messages: ClanChatMessage[] }>(`/clans/${id}/chat`, { params: { limit } }),
  sendMessage: (id: string, message: string) =>
    api.post<{ message: ClanChatMessage }>(`/clans/${id}/chat`, { message }),
  create: (data: { name: string; description?: string; imageUrl?: string; isPublic?: boolean }) =>
    api.post<{ clan: ClanSummary }>('/clans', data),
  join: (id: string) => api.post<{ status: 'joined' | 'requested'; requestId?: string }>(`/clans/${id}/join`),
  declareWar: (clanId: string, targetClanId: string) =>
    api.post<{ war: ClanWarState }>(`/clans/${clanId}/war/declare`, { targetClanId }),
  fortifyWar: (clanId: string, defenseType: ClanWarDefenseType['type']) =>
    api.post<{ war: ClanWarState | null }>(`/clans/${clanId}/war/fortify`, { defenseType }),
  attackWar: (clanId: string, attackType: ClanWarActionType['type']) =>
    api.post<{ war: ClanWarState | null; completed: boolean; finalPoints: number; attackType: ClanWarActionType['type'] }>(`/clans/${clanId}/war/attack`, { attackType }),
  leave: (id: string) => api.delete(`/clans/${id}/leave`),
  acceptRequest: (clanId: string, requestId: string) =>
    api.post(`/clans/${clanId}/requests/${requestId}/accept`),
  rejectRequest: (clanId: string, requestId: string) =>
    api.post(`/clans/${clanId}/requests/${requestId}/reject`),
  promoteMember: (clanId: string, userId: string) =>
    api.post(`/clans/${clanId}/members/${userId}/promote`),
  demoteMember: (clanId: string, userId: string) =>
    api.post(`/clans/${clanId}/members/${userId}/demote`),
  transferLeadership: (clanId: string, userId: string) =>
    api.post(`/clans/${clanId}/members/${userId}/transfer-leadership`),
  removeMember: (clanId: string, userId: string) =>
    api.delete(`/clans/${clanId}/members/${userId}`),
  depositToBank: (clanId: string, amount: number) =>
    api.post<{ success: boolean; deposited: number; clanBankMoney: number; newBalance: { aura: number | string; money: number } }>(`/clans/${clanId}/bank/deposit`, { amount }),
  updateDescription: (id: string, description: string | null) =>
    api.put<{ success: boolean; description: string | null }>(`/clans/${id}/description`, { description }),
  updateImage: (id: string, imageUrl: string | null) =>
    api.put<{ success: boolean; imageUrl: string | null }>(`/clans/${id}/image`, { imageUrl }),
  updateTag: (id: string, data: { tagText?: string; tagStyle?: object }) =>
    api.put<{ success: boolean; tagText: string | null; tagStyle: string | null }>(`/clans/${id}/tag`, data),
  requestAlliance: (clanId: string, targetClanId: string) =>
    api.post<{ success: boolean }>(`/clans/${clanId}/nation/alliances/request`, { targetClanId }),
  updateNationFoundation: (clanId: string, data: { territoryKey: string; flag: { primary: string; secondary: string; accent: string; pattern: string; icon: string } }) =>
    api.put<{ success: boolean }>(`/clans/${clanId}/nation/foundation`, data),
  respondAlliance: (clanId: string, requestClanId: string, decision: 'accept' | 'reject') =>
    api.post<{ success: boolean }>(`/clans/${clanId}/nation/alliances/respond`, { requestClanId, decision }),
  betrayAlliance: (clanId: string, allyClanId: string) =>
    api.post<{ success: boolean; betrayedAt: string }>(`/clans/${clanId}/nation/alliances/betray`, { allyClanId }),
  buyBlackMarketItem: (clanId: string, data: { itemKey: string; targetClanId?: string; boost?: boolean }) =>
    api.post<{ success: boolean; itemKey?: string; type?: string }>(`/clans/${clanId}/nation/black-market/buy`, data),
  useOwnedItem: (clanId: string, clanItemId: string, effectData?: { imageUrl?: string }) =>
    api.post<{ success: boolean; effect: ClanActiveEffect }>(`/clans/${clanId}/items/${clanItemId}/use`, effectData ?? {}),
  // War mini-games
  getWarGamesStatus: (clanId: string) =>
    api.get<ClanWarGamesStatus>(`/clans/${clanId}/war/games/status`),
  getFeaturedEvent: (clanId?: string) =>
    api.get<{ event: ClanEventView | null }>('/clans/events/featured', { params: clanId ? { clanId } : undefined }),
  submitEventMiniGame: (eventId: string, miniGameId: string, data: { rawScore: number }) =>
    api.post<{ success: boolean; result: { rawScore: number; pointsAwarded: number; attemptsUsed: number; maxAttemptsPerUser: number | null; nextAvailableAt: string | null } }>(`/clans/events/${eventId}/minigames/${miniGameId}/submit`, data),
  submitMemoryGame: (clanId: string, data: { matchedPairs: Record<string, number>; score: number; isPractice: boolean }) =>
    api.post<{ success: boolean; isPractice: boolean }>(`/clans/${clanId}/war/games/memory`, data),
  submitBombGame: (clanId: string, data: { score: number; hits: number; isPractice: boolean }) =>
    api.post<{ success: boolean; isPractice: boolean; finalPoints: number }>(`/clans/${clanId}/war/games/bomb`, data),
  navalShot: (clanId: string, data: { x: number; y: number }) =>
    api.post<{ isHit: boolean; building: string | null; points: number; x: number; y: number }>(`/clans/${clanId}/war/games/naval/shot`, data),
  // Pump-up messages
  getPumpUpMessages: (clanId: string) =>
    api.get<{ messages: ClanPumpUpMessage[] }>(`/clans/${clanId}/pump-up`),
  createPumpUpMessage: (clanId: string, data: { content: string; color: string }) =>
    api.post<{ message: ClanPumpUpMessage }>(`/clans/${clanId}/pump-up`, data),
  updatePumpUpMessage: (clanId: string, msgId: string, data: { content?: string; color?: string }) =>
    api.put<{ message: ClanPumpUpMessage }>(`/clans/${clanId}/pump-up/${msgId}`, data),
  deletePumpUpMessage: (clanId: string, msgId: string) =>
    api.delete(`/clans/${clanId}/pump-up/${msgId}`),
};

// Admin API
export interface AdminUser {
  id: string;
  username: string;
  firstName: string | null;
  email: string;
  aura: number;
  money: number;
  auraCoinBalance: number;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isBetaTester: boolean;
  isChatMuted: boolean;
  dailyAuraGiven: number;
  dailyAuraLimit: number;
  lastDailyReset: string;
  schoolLevel: string | null;
  classLetter: string | null;
  createdAt: string;
  updatedAt: string;
  sharedMoney: AdminSharedMoney | null;
}

export interface AdminSharedMoney {
  relationshipId: string;
  coupleBalance: number;
  marriedAt: string | null;
  partner: {
    id: string;
    username: string;
    money: number;
  };
}

export interface AdminUpdatePopup {
  id: string;
  title: string;
  summary: string | null;
  message: string;
  imageUrl: string | null;
  type: 'UPDATE' | 'CLAN_PROMPT';
  audience: 'ALL' | 'NO_CLAN' | 'SELECTED_USERS';
  targetUserIds: string[];
  releaseDate: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    username: string;
  };
  _count: {
    views: number;
  };
}

export interface AdminClanMember {
  id: string;
  userId: string;
  isLeader: boolean;
  joinedAt: string;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
    aura: number | string;
  };
}

export interface AdminClan {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  tagUnlocked: boolean;
  isPublic: boolean;
  maxMembers: number;
  clanBankMoney: number;
  level: number;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
    aura: number | string;
  };
  members: AdminClanMember[];
  activeWar: {
    id: string;
    status: 'PREPARING' | 'ACTIVE';
    startsAt: string;
    endsAt: string;
  } | null;
}

export interface AdminClanEventQuest {
  id: string;
  title: string;
  description: string | null;
  activityType: string;
  targetValue: number;
  pointsReward: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminClanEventMiniGame {
  id: string;
  title: string;
  description: string | null;
  type: 'REFLEX' | 'TAP_FRENZY';
  instructions: string | null;
  scoreMultiplier: number;
  flatPointsBonus: number;
  maxPointsPerAttempt: number;
  maxAttemptsPerUser: number | null;
  cooldownMinutes: number;
  sortOrder: number;
  isActive: boolean;
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminClanEventRewardTier extends ClanEventRewardTier {
  itemId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminClanEvent extends Omit<ClanEventView, 'quests' | 'miniGames' | 'rewardTiers' | 'recentActivity' | 'canParticipate' | 'selectedClanEntry' | 'viewerClanEntry'> {
  storedStatus: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
  };
  quests: AdminClanEventQuest[];
  miniGames: AdminClanEventMiniGame[];
  rewardTiers: AdminClanEventRewardTier[];
}


// Pending User Interface
export interface PendingUser {
  id: string;
  username: string;
  firstName: string | null;
  schoolLevel: 'SECONDE' | 'PREMIERE' | 'TERMINALE' | null;
  classLetter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null;
  email: string;
  motivationMessage: string | null;
  createdAt: string;
}

export interface RegistrationReview {
  id: string;
  registrationUserId: string;
  username: string;
  firstName: string | null;
  schoolLevel: 'SECONDE' | 'PREMIERE' | 'TERMINALE' | null;
  classLetter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null;
  email: string;
  motivationMessage: string | null;
  registrationCreatedAt: string;
  status: 'APPROVED' | 'REJECTED';
  reviewedAt: string;
  reviewedById: string | null;
  importedFromLegacy: boolean;
  createdAt: string;
  updatedAt: string;
}

// Shop Item Interface
export interface ShopItem {
  id: string;
  name: string;
  description: string;
  type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE';
  price: number;
  imageUrl: string | null;
  effect: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ShopItemExchangeFile {
  format: 'auratracker-shop-items';
  version: 1;
  exportedAt: string;
  itemCount: number;
  items: Array<{
    name: string;
    description: string;
    type: string;
    price: number;
    imageUrl: string | null;
    effect: Record<string, unknown> | string | null;
    expiresAt: string | null;
  }>;
}

export interface AdminInventoryItem {
  id: string;
  quantity: number;
  acquiredAt: string;
  item: ShopItem;
}

// Bug Report Interface
export interface BugReport {
  id: string;
  userId: string;
  title: string;
  description: string;
  images?: string | null; // JSON array of image URLs
  status: 'PENDING' | 'DONE';
  adminReply: string | null;
  createdAt: string;
  resolvedAt: string | null;
  user: {
    id: string;
    username: string;
  };
}

export interface Ban {
  id: string;
  userId: string;
  bannedBy: string;
  reason: string;
  type: 'TEMPORARY' | 'PERMANENT';
  expiresAt: string | null;
  createdAt: string;
  isActive: boolean;
  user: {
    id: string;
    username: string;
    email: string;
  };
  admin: {
    id: string;
    username: string;
  };
}

export interface AdminWarning {
  id: string;
  userId: string;
  issuedById: string;
  type: 'AVERTISSEMENT' | 'AMENDE'; // AVERTISSEMENT or AMENDE
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  amount?: number | null; // Amount for amende
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
  issuedBy: {
    id: string;
    username: string;
  };
}

export interface PlaytimeLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  profilePicture: string | null;
  usernameColor: string | null;
  totalSeconds: number;
  gamesPlayed: number;
  averageGameDuration: number;
}

// Suggestions API
export interface SuggestionComment {
  id: string;
  suggestionId: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
  };
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  status: 'PENDING' | 'DONE' | 'REJECTED';
  createdAt: string;
  resolvedAt: string | null;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
  };
  upvotes: number;
  downvotes: number;
  score: number;
  boostedScore?: number;
  boost?: number;
  userVote: number;
  averageRating: number | null;
  ratingCount: number;
  userRating: number | null;
  comments: SuggestionComment[];
}

export const suggestionsApi = {
  getAll: () => api.get<{ suggestions: Suggestion[] }>('/suggestions'),
  create: (data: { title: string; description: string; imageUrl?: string }) =>
    api.post<{ suggestion: Suggestion }>('/suggestions', data),
  vote: (id: string, value: number) =>
    api.post<{ upvotes: number; downvotes: number; score: number; userVote: number }>(
      `/suggestions/${id}/vote`,
      { value }
    ),
  updateStatus: (id: string, status: 'PENDING' | 'DONE' | 'REJECTED') =>
    api.patch<{
      status: 'PENDING' | 'DONE' | 'REJECTED';
      resolvedAt: string | null;
      averageRating: number | null;
      ratingCount: number;
      userRating: number | null;
    }>(`/suggestions/${id}/status`, { status }),
  rate: (id: string, rating: number) =>
    api.post<{ averageRating: number | null; ratingCount: number; userRating: number | null }>(
      `/suggestions/${id}/rating`,
      { rating }
    ),
  delete: (id: string) => api.delete<{ success: boolean }>(`/suggestions/${id}`),
  addComment: (id: string, data: { content: string }) =>
    api.post<{ comment: SuggestionComment }>(`/suggestions/${id}/comments`, data),
  deleteComment: (id: string, commentId: string) =>
    api.delete<{ success: boolean }>(`/suggestions/${id}/comments/${commentId}`),
};

// Log Interface
export interface ActivityLog {
  id: string;
  type: 'AUTH' | 'CHAT' | 'GAME' | 'ECONOMY' | 'PARTY' | 'SUGGESTION' | 'MARKETPLACE' | 'ADMIN' | 'BAN' | 'AURACOIN';
  action: string;
  userId: string | null;
  username: string | null;
  targetId: string | null;
  targetName: string | null;
  details: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface LogStats {
  total: number;
  byType: Record<string, number>;
}

export interface AdminActivityBreakdown {
  date: string;
  pageSeries: Array<{
    hour: number;
    hourLabel: string;
    total: number;
    values: Record<string, number>;
  }>;
  topPages: Array<{
    page: string;
    total: number;
  }>;
  gameSeries: Array<{
    hour: number;
    hourLabel: string;
    total: number;
    values: Record<string, number>;
  }>;
  topGames: Array<{
    gameType: string;
    total: number;
  }>;
  gameDurationSeries: Array<{
    hour: number;
    hourLabel: string;
    total: number;
    values: Record<string, number>;
  }>;
  topGameDurations: Array<{
    gameType: string;
    totalSeconds: number;
  }>;
}

export interface TaxBracket {
  id: string;
  threshold: number;
  rate: number;
  createdAt: string;
  updatedAt: string;
}

export interface OnlineHistoryInsightPeakHour {
  hour: number;
  label: string;
  averageOnline: number;
  peakOnline: number;
  sampleCount: number;
}

export interface OnlineHistoryInsights {
  uniqueConnectedUsers: number;
  busiestWeekday: {
    day: number;
    label: string;
    totalGames: number;
    uniquePlayers: number;
  } | null;
  peakHours: OnlineHistoryInsightPeakHour[];
}

type AdminRareAction =
  | { action: 'chat_clear' }
  | { action: 'deploy' }
  | { action: 'reset_extreme_aura'; threshold?: number };

const runRareAction = (data: AdminRareAction) => api.post('/admin/rare', data);

export const adminApi = {
  runRareAction,
  startPrismaStudio: () => api.post<{ ok: boolean; studioToken: string }>('/admin/prisma-studio/start'),
  getAllAds: () => api.get<{ ads: PendingAdReview[] }>('/admin/ads'),
  getPendingAds: () => api.get<{ pendingAds: PendingAdReview[] }>('/admin/ads/pending'),
  approveAd: (id: string) => api.post<{ ad: PendingAdReview }>(`/admin/ads/${id}/approve`, {}),
  rejectAd: (id: string) => api.post<{ ad: PendingAdReview }>(`/admin/ads/${id}/reject`, {}),
  deleteAdForever: (id: string) => api.delete<{ ok: boolean }>(`/admin/ads/${id}`),
  getUsers: () => api.get<{ users: AdminUser[] }>('/admin/users'),
  getClans: () => api.get<{ clans: AdminClan[] }>('/admin/clans'),
  getClanEvents: () => api.get<{ events: AdminClanEvent[] }>('/admin/clan-events'),
  createClanEvent: (data: {
    title: string;
    description?: string | null;
    bannerUrl?: string | null;
    status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    highlightColor?: string | null;
    rulesSummary?: string | null;
    startsAt: string;
    endsAt: string;
    quests: Array<{ title: string; description?: string | null; activityType: string; targetValue: number; pointsReward: number; sortOrder: number; isActive: boolean }>;
    miniGames: Array<{ title: string; description?: string | null; type: 'REFLEX' | 'TAP_FRENZY'; instructions?: string | null; scoreMultiplier: number; flatPointsBonus: number; maxPointsPerAttempt: number; maxAttemptsPerUser: number | null; cooldownMinutes: number; sortOrder: number; isActive: boolean; config?: Record<string, unknown> | null }>;
    rewardTiers: Array<{ title: string; minRank: number; maxRank: number; moneyReward: number; auraReward: number; itemId: string | null }>;
  }) => api.post<{ event: AdminClanEvent }>('/admin/clan-events', data),
  updateClanEvent: (id: string, data: {
    title: string;
    description?: string | null;
    bannerUrl?: string | null;
    status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    highlightColor?: string | null;
    rulesSummary?: string | null;
    startsAt: string;
    endsAt: string;
    quests: Array<{ title: string; description?: string | null; activityType: string; targetValue: number; pointsReward: number; sortOrder: number; isActive: boolean }>;
    miniGames: Array<{ title: string; description?: string | null; type: 'REFLEX' | 'TAP_FRENZY'; instructions?: string | null; scoreMultiplier: number; flatPointsBonus: number; maxPointsPerAttempt: number; maxAttemptsPerUser: number | null; cooldownMinutes: number; sortOrder: number; isActive: boolean; config?: Record<string, unknown> | null }>;
    rewardTiers: Array<{ title: string; minRank: number; maxRank: number; moneyReward: number; auraReward: number; itemId: string | null }>;
  }) => api.put<{ event: AdminClanEvent }>(`/admin/clan-events/${id}`, data),
  deleteClanEvent: (id: string) => api.delete<{ success: boolean }>(`/admin/clan-events/${id}`),
  updateClan: (id: string, data: { name?: string; description?: string; imageUrl?: string; isPublic?: boolean; tagUnlocked?: boolean; maxMembers?: number }) =>
    api.put<{ clan: AdminClan }>(`/admin/clans/${id}`, data),
  transferClanLeadership: (id: string, targetUserId: string) =>
    api.post<{ success: boolean }>(`/admin/clans/${id}/transfer-leadership`, { targetUserId }),
  deleteClan: (id: string) => api.delete<{ success: boolean }>(`/admin/clans/${id}`),
  updateUser: (id: string, data: { username?: string; firstName?: string | null; aura?: number; money?: number; auraCoinBalance?: number; dailyAuraLimit?: number; password?: string; isChatMuted?: boolean; role?: 'USER' | 'BETA_TESTER' | 'ADMIN' | 'SUPER_ADMIN' }) =>
    api.put<{ user: AdminUser }>(`/admin/users/${id}`, data),
  forceDivorceUser: (id: string) => api.post<{ success: boolean; message: string }>(`/admin/users/${id}/force-divorce`),
  deleteUser: (id: string) => api.delete<{ success: boolean; message: string }>(`/admin/users/${id}`),
  getUserInventory: (id: string) =>
    api.get<{ items: AdminInventoryItem[] }>(`/admin/users/${id}/inventory`),
  addUserInventoryItem: (id: string, data: { itemId: string; quantity?: number }) =>
    api.post<{ item: AdminInventoryItem }>(`/admin/users/${id}/inventory`, data),
  updateUserInventoryItem: (id: string, userItemId: string, data: { quantity: number }) =>
    api.patch<{ item?: AdminInventoryItem; removed?: boolean }>(`/admin/users/${id}/inventory/${userItemId}`, data),
  deleteUserInventoryItem: (id: string, userItemId: string) =>
    api.delete<{ success: boolean }>(`/admin/users/${id}/inventory/${userItemId}`),
  clearChat: () =>
    runRareAction({ action: 'chat_clear' }) as Promise<{ data: { success: boolean; message: string; messagesDeleted: number } }>,
  exportChat: () => api.get<Blob>('/admin/chat/export', { responseType: 'blob' }),
  // Pending users management
  getPendingUsers: () => api.get<{ pendingUsers: PendingUser[] }>('/admin/pending-users'),
  getRegistrationReviews: () => api.get<{ registrationReviews: RegistrationReview[] }>('/admin/registration-reviews'),
  importRegistrationReviews: (entries: Array<PendingUser & { registrationStatus: 'APPROVED' | 'REJECTED' }>) =>
    api.post<{ success: boolean; importedCount: number; registrationReviews: RegistrationReview[] }>('/admin/registration-reviews/import-local', { entries }),
  approveUser: (id: string) => api.post<{ success: boolean; user: PendingUser; message: string }>(`/admin/users/${id}/approve`),
  rejectUser: (id: string) => api.post<{ success: boolean; message: string }>(`/admin/users/${id}/reject`),
  // Items management
  getItems: () => api.get<{ items: ShopItem[] }>('/admin/items'),
  createItem: (data: {
    name: string;
    description: string;
    type: string;
    price: number;
    imageUrl?: string;
    effect?: string;
  }) => api.post<{ item: ShopItem }>('/admin/items', data),
  updateItem: (id: string, data: {
    name: string;
    description: string;
    type: string;
    price: number;
    imageUrl?: string;
    effect?: string;
  }) => api.put<{ item: ShopItem }>(`/admin/items/${id}`, data),
  deleteItem: (id: string) => api.delete<{ success: boolean }>(`/admin/items/${id}`),
  importItems: (data: ShopItemExchangeFile) =>
    api.post<{ success: boolean; count: number; items: ShopItem[] }>('/admin/items/import', data),
  // Doodle Jump skin rotation control
  getDjForcedSkin: () => api.get<{ itemId: string | null }>('/marketplace/admin/dj-forced-skin'),
  setDjForcedSkin: (itemId: string | null) =>
    api.post<{ success: boolean; itemId: string | null }>('/marketplace/admin/dj-force-skin', { itemId }),
  // Shop categories management
  getShopCategories: () => api.get<{ categories: ShopCategory[] }>('/admin/shop-categories'),
  updateShopCategories: (categories: ShopCategory[]) =>
    api.put<{ categories: ShopCategory[] }>('/admin/shop-categories', { categories }),
  // Bug reports management
  getBugReports: () => api.get<{ bugReports: BugReport[] }>('/admin/bugs'),
  updateBugReport: (id: string, data: { status: 'PENDING' | 'DONE'; adminReply?: string }) =>
    api.put<{ bugReport: BugReport }>(`/admin/bugs/${id}`, data),
  deleteBugReport: (id: string) => api.delete<{ success: boolean }>(`/admin/bugs/${id}`),
  // Ban management
  getBans: () => api.get<{ bans: Ban[] }>('/admin/bans'),
  createBan: (data: { userId: string; reason: string; type: 'TEMPORARY' | 'PERMANENT'; durationHours?: number }) =>
    api.post<{ ban: Ban; message: string }>('/admin/bans', data),
  unbanUser: (userId: string) => api.delete<{ success: boolean; message: string }>(`/admin/bans/${userId}`),
  // Activity logs
  getLogs: (params?: {
    type?: string;
    action?: string;
    username?: string;
    gameType?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }) => api.get<{ logs: ActivityLog[]; total: number }>('/admin/logs', { params }),
  downloadLogs: (params: {
    startDate?: string;
    endDate?: string;
    type?: string;
    action?: string;
    username?: string;
    gameType?: string;
  }) => api.get<Blob>('/admin/logs/download', { params, responseType: 'blob' }),
  getLogStats: () => api.get<LogStats>('/admin/logs/stats'),
  getActivityBreakdown: (date: string) =>
    api.get<AdminActivityBreakdown>('/admin/activity-breakdown', { params: { date } }),
  // Game settings management
  getSettings: () => api.get<{ settings: Record<string, string> }>('/admin/settings'),
  updateSettings: (settings: Record<string, string | number>) =>
    api.put<{ settings: Record<string, string> }>('/admin/settings', { settings }),
  updateSetting: (key: string, value: string | number) =>
    api.put<{ setting: { key: string; value: string } }>(`/admin/settings/${key}`, { value }),
  getTaxSettings: () =>
    api.get<{
      brackets: TaxBracket[];
      defaults: { threshold: number; rate: number };
      lastRunDate: string | null;
    }>('/admin/tax-settings'),
  updateTaxSettings: (brackets: Array<{ threshold: number; rate: number }>) =>
    api.put<{
      brackets: TaxBracket[];
      defaults: { threshold: number; rate: number };
    }>('/admin/tax-settings', { brackets }),
  runTaxNow: (force = true) =>
    api.post<{
      result: {
        skipped: boolean;
        usersAffected: number;
        totalCollected: number;
      };
    }>('/admin/tax-settings/run', { force }),
  getBombPartyLanguages: () =>
    api.get<{ languages: { fileName: string; label: string }[] }>('/admin/bombparty/languages'),
  recalculateBombPartyPrompts: () =>
    api.post<{ result: { languageFile: string; wordCount: number; totalPrompts: number; twoLetterPrompts: number; threeLetterPrompts: number } }>(
      '/admin/bombparty/recalculate-prompts'
    ),
  // Server deployment
  deploy: () =>
    runRareAction({ action: 'deploy' }) as Promise<{ data: { success: boolean; message: string; stdout?: string; stderr?: string } }>,
  // Reset extreme aura values
  resetExtremeAura: (threshold?: number) =>
    runRareAction({ action: 'reset_extreme_aura', threshold }) as Promise<{ data: { success: boolean; message: string; usersReset: number; users: { id: string; username: string; oldAura: string }[] } }>,
  // Update popups
  getUpdatePopups: () => api.get<{ popups: AdminUpdatePopup[] }>('/admin/update-popups'),
  createUpdatePopup: (data: {
    title: string;
    summary?: string;
    message: string;
    imageUrl?: string;
    type?: 'UPDATE' | 'CLAN_PROMPT';
    audience?: 'ALL' | 'NO_CLAN' | 'SELECTED_USERS';
    targetUserIds?: string[];
    releaseDate?: string;
    isPublished?: boolean;
  }) => api.post<{ popup: AdminUpdatePopup }>('/admin/update-popups', data),
  updateUpdatePopup: (id: string, data: Partial<{
    title: string;
    summary: string | null;
    message: string;
    imageUrl: string | null;
    type: 'UPDATE' | 'CLAN_PROMPT';
    audience: 'ALL' | 'NO_CLAN' | 'SELECTED_USERS';
    targetUserIds: string[];
    releaseDate: string;
    isPublished: boolean;
  }>) => api.put<{ popup: AdminUpdatePopup }>(`/admin/update-popups/${id}`, data),
  deleteUpdatePopup: (id: string) => api.delete<{ success: boolean }>(`/admin/update-popups/${id}`),
  uploadUpdatePopupImage: (data: { base64Data: string; mimeType: string }) =>
    api.post<{ imageUrl: string }>('/admin/update-popups/upload-image', data),
  uploadItemImage: (data: { base64Data: string; mimeType: string }) =>
    api.post<{ imageUrl: string }>('/admin/items/upload-image', data),
  suggestUpdatePopupSummary: () => api.get<{ suggestion: string; sinceDate: string }>('/admin/update-popups/suggest-summary'),
  // Online activity history
  takeOnlineSnapshot: () => api.post<{ success: boolean; count: number }>('/admin/online-snapshot'),
  getOnlineHistory: (params?: {
    period?: 'day' | 'week' | 'month' | 'custom';
    startDate?: string;
    endDate?: string;
  }) => api.get<{
    data: { timestamp: string; count: number; max: number; usernames: { userId: string; username: string }[] }[];
    peak: number;
    peakAt: string | null;
    insights: OnlineHistoryInsights;
    period: string;
    start: string;
    end: string;
  }>('/admin/online-history', { params }),
  getOnlineStats: () => api.get<{
    current: number;
    allTimeRecord: number;
    allTimeRecordAt: string | null;
    avg1d: number;
    avg7d: number;
    avg30d: number;
    peak1d: number;
    peak7d: number;
    peak30d: number;
  }>('/admin/online-stats'),
  // Ban appeals
  getBanAppeals: () => api.get<{ banAppeals: BanAppeal[] }>('/admin/ban-appeals'),
  reviewBanAppeal: (id: string, data: { action: 'approve' | 'reject' }) =>
    api.put<{ banAppeal: BanAppeal }>(`/admin/ban-appeals/${id}`, data),
  // Name change requests
  getNameChangeRequests: () => api.get<{ nameChangeRequests: NameChangeRequest[] }>('/admin/name-change-requests'),
  reviewNameChangeRequest: (id: string, data: { action: 'approve' | 'reject' }) =>
    api.put<{ nameChangeRequest: NameChangeRequest }>(`/admin/name-change-requests/${id}`, data),
  // Admin warnings
  getWarnings: () => api.get<{ warnings: AdminWarning[] }>('/admin/warnings'),
  createWarning: (data: { userId: string; type?: 'AVERTISSEMENT' | 'AMENDE'; message: string; severity?: 'LOW' | 'MEDIUM' | 'HIGH'; amount?: number }) =>
    api.post<{ warning: AdminWarning; message: string }>('/admin/warnings', data),
  deleteWarning: (id: string) => api.delete<{ success: boolean; message: string }>(`/admin/warnings/${id}`),
  backfillScoreHistory: () => api.post<{ success: boolean; inserted: number; skipped: number }>('/admin/backfill-score-history'),
  // Platform stats (aggregated platform-wide data)
  getPlatformStats: () => api.get<{
    overview: {
      totalUsers: number;
      approvedUsers: number;
      totalAura: string;
      totalMoney: number;
      totalGamesPlayed: number;
      totalWins: number;
      totalTransfers: number;
      totalAuraTransferred: number;
      totalMoneyTransferred: number;
      totalWordsTyped: number;
    };
    topGames: Array<{ gameType: string; totalPlayed: number; wins: number }>;
    activityChart: Array<{ date: string; count: number }>;
  }>('/admin/platform-stats'),
  // Playtime leaderboard
  getPlaytimeLeaderboard: (params?: {
    period?: 'day' | 'week' | 'month' | 'custom';
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) => api.get<{
    period: string;
    start: string;
    end: string;
    leaderboard: PlaytimeLeaderboardEntry[];
    totalEntries: number;
    limit: number;
  }>('/admin/playtime-leaderboard', { params }),
  purgeAllBusinesses: () =>
    api.post<{ purged: number }>('/admin/businesses/purge', {}),
  resetBusinessUnlockLevels: () =>
    api.post<{ ok: boolean }>('/admin/businesses/reset-unlock-levels', {}),
  getBusinessCreationEnabled: () =>
    api.get<{ enabled: boolean }>('/admin/businesses/creation-enabled'),
  setBusinessCreationEnabled: (enabled: boolean) =>
    api.post<{ enabled: boolean }>('/admin/businesses/creation-enabled', { enabled }),
};

export const maintenanceApi = {
  getStatus: () => api.get<{
    enabled: boolean;
    message: string;
    pages: string[];
    endDate: string | null;
    blockedPages?: string[];
    blockedMessage?: string;
    loginMessage?: string;
    loginRegisterCtaEnabled?: boolean;
    referralEnabled?: boolean;
    referralDashboardCardEnabled?: boolean;
    duelMatchmakingEnabled?: boolean;
    defaultLandingPage?: string;
    youLogoAdminOnly?: boolean;
    betaGameIds?: string[];
    newGameIds?: string[];
    chatBlocked?: boolean;
    chatBlockReason?: 'manual' | 'schedule' | null;
    chatBlockMessage?: string;
    chatAutoBlockEnabled?: boolean;
    chatAutoBlockStart?: string | null;
    chatAutoBlockEnd?: string | null;
    chatAutoBlockActive?: boolean;
    chatBlockTimezone?: string;
  }>('/maintenance'),
};

// Bug report API (for regular users)
export const bugReportApi = {
  create: (data: { title: string; description: string; images?: string[] }) =>
    api.post<{ bugReport: BugReport }>('/admin/bugs', data),
};

// Ban Appeal Interface
export interface BanAppeal {
  id: string;
  userId: string;
  banId: string;
  message: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  user: { id: string; username: string; email: string };
  ban: { id: string; reason: string; type: string; expiresAt: string | null };
}

// Name Change Request Interface
export interface NameChangeRequest {
  id: string;
  userId: string;
  currentUsername: string;
  requestedUsername: string;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  user: { id: string; username: string; email: string };
}

// Public API (no auth required)
export const publicApi = {
  submitBanAppeal: (data: { banId: string; userId: string; message: string }) =>
    api.post<{ appeal: BanAppeal }>('/admin/ban-appeals', data),
};

// Bomb Party API
export interface BombPartyStats {
  id: string;
  userId: string;
  wins: number;
  losses: number;
  totalPlayed: number;
  wordsTyped: number;
  longestWord: string | null;
}

export interface BombPartyLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  usernameColor: string | null;
  wins: number;
  losses: number;
  totalPlayed: number;
  wordsTyped: number;
  longestWord: string | null;
}

export const bombPartyApi = {
  getStats: (userId: string) =>
    api.get<BombPartyStats>(`/bombparty/stats/${userId}`),
  getLeaderboard: (limit?: number) =>
    api.get<{ rankings: BombPartyLeaderboardEntry[] }>('/bombparty/leaderboard', { params: { limit } }),
  getPromptStats: () =>
    api.get<{ total: number; easy: number; medium: number; hard: number }>('/bombparty/prompts/stats'),
};

// Polymarket API
export interface PolymarketSuggestion {
  id: string;
  userId: string;
  title: string;
  description: string;
  imageUrl: string | null;
  eventDate: string | null;
  suggestedYesOdds?: number | null;
  suggestedNoOdds?: number | null;
  optionsConfig?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
  };
  event: {
    id: string;
    status: string;
  } | null;
}

export interface PolymarketEvent {
  id: string;
  suggestionId: string | null;
  title: string;
  description: string;
  imageUrl: string | null;
  eventDate: string;
  yesOdds: number;
  noOdds: number;
  optionsConfig?: string | null;
  status: 'OPEN' | 'CLOSED' | 'RESOLVED';
  resolution: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  closedAt: string | null;
  totalVolume?: number;
  totalYes?: number;
  totalNo?: number;
  optionStats?: Record<string, number>;
  betCount?: number;
  suggestion?: PolymarketSuggestion | null;
  bets?: PolymarketBet[];
}

export interface PolymarketBet {
  id: string;
  userId: string;
  eventId: string;
  prediction: string;
  amount: number;
  payout: number | string | null;
  createdAt: string;
  event?: {
    id: string;
    title: string;
    status: string;
    resolution: string | null;
    eventDate: string;
    yesOdds: number;
    noOdds: number;
    optionsConfig?: string | null;
    imageUrl?: string | null;
  };
  user?: {
    id: string;
    username: string;
    usernameColor: string | null;
  };
}


export const polymarketApi = {
  // Suggestions
  getSuggestions: () => api.get<{ suggestions: PolymarketSuggestion[] }>('/polymarket/suggestions'),
  createSuggestion: (data: {
    title: string;
    description: string;
    imageUrl?: string;
    eventDate?: string;
    suggestedYesOdds?: number;
    suggestedNoOdds?: number;
    optionsConfig?: Array<{ key: string; label: string; color: string; odds: number }> | null;
  }) =>
    api.post<{ suggestion: PolymarketSuggestion }>('/polymarket/suggestions', data),
  approveSuggestion: (id: string, data: { yesOdds: number; noOdds: number; eventDate?: string; optionsConfig?: Array<{ key: string; label: string; color: string; odds: number }> | null }) =>
    api.post<{ event: PolymarketEvent }>(`/polymarket/suggestions/${id}/approve`, data),
  rejectSuggestion: (id: string) =>
    api.post<{ success: boolean }>(`/polymarket/suggestions/${id}/reject`),
  
  // Events
  getEvents: (status?: string) =>
    api.get<{ events: PolymarketEvent[] }>('/polymarket/events', { params: { status } }),
  getEvent: (id: string) =>
    api.get<{ event: PolymarketEvent }>(`/polymarket/events/${id}`),
  createEvent: (data: {
    title: string;
    description: string;
    imageUrl?: string;
    eventDate: string;
    yesOdds: number;
    noOdds: number;
    suggestionId?: string;
    optionsConfig?: Array<{ key: string; label: string; color: string; odds: number }> | null;
  }) => api.post<{ event: PolymarketEvent }>('/polymarket/events', data),
  updateEvent: (id: string, data: {
    title?: string;
    description?: string;
    imageUrl?: string | null;
    eventDate?: string;
    yesOdds?: number;
    noOdds?: number;
    status?: 'OPEN' | 'CLOSED' | 'RESOLVED';
    optionsConfig?: Array<{ key: string; label: string; color: string; odds: number }> | null;
  }) =>
    api.patch<{ event: PolymarketEvent }>(`/polymarket/events/${id}`, data),
  resolveEvent: (id: string, resolution: 'YES' | 'NO') =>
    api.post<{ success: boolean; resolution: string }>(`/polymarket/events/${id}/resolve`, { resolution }),
  deleteEvent: (id: string) =>
    api.delete<{ success: boolean }>(`/polymarket/events/${id}`),
  
  // Bets
  getBets: () => api.get<{ bets: PolymarketBet[] }>('/polymarket/bets'),
  getAllBets: (limit?: number) =>
    api.get<{ bets: PolymarketBet[] }>('/polymarket/bets/all', { params: { limit } }),
  placeBet: (data: { eventId: string; prediction: 'YES' | 'NO'; amount: number }) =>
    api.post<{ bet: PolymarketBet }>('/polymarket/bets', data),
};

// Daily Quests API
export interface DailyQuest {
  id: string;
  questType: string;
  title: string;
  description: string;
  targetValue: number;
  moneyReward: number;
  auraReward: number;
  questDate: string;
  createdAt: string;
}

export interface UserDailyQuest {
  id: string;
  userId: string;
  questId: string;
  questDate: string;
  selectedAt: string;
  isCompleted: boolean;
  completedAt: string | null;
  isClaimed: boolean;
  claimedAt: string | null;
  quest: DailyQuest;
  progress: {
    id: string;
    currentValue: number;
    lastUpdated: string;
  } | null;
}

export const questsApi = {
  getDaily: () => api.get<{ quests: DailyQuest[] }>('/quests/daily'),
  select: (questIds: string[]) =>
    api.post<{ success: boolean; userQuests: UserDailyQuest[] }>('/quests/select', { questIds }),
  getMyQuests: () => api.get<{ userQuests: UserDailyQuest[] }>('/quests/my-quests'),
  claim: (questIds: string[]) =>
    api.post<{
      success: boolean;
      rewards: { money: number; aura: number };
      claimedQuests: number;
    }>('/quests/claim', { questIds }),
};

// ─── Notifications API ────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  link: string | null;
  icon: string | null;
  isRead: boolean;
  readAt: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const notificationsApi = {
  getAll: (params?: { page?: number; limit?: number; unreadOnly?: boolean; archived?: boolean }) =>
    api.get<NotificationsResponse>('/notifications', { params }),
  getUnreadCount: () => api.get<{ count: number }>('/notifications/unread/count'),
  markRead: (id: string) => api.post<{ notification: Notification }>(`/notifications/${id}/read`),
  markAllRead: () => api.post<{ success: boolean }>('/notifications/read-all'),
  archive: (id: string) => api.post<{ notification: Notification }>(`/notifications/${id}/archive`),
  remove: (id: string) => api.delete<{ success: boolean }>(`/notifications/${id}`),
  archiveAllRead: () => api.post<{ success: boolean }>('/notifications/archive-all-read'),
  /** Admin only */
  broadcast: (data: { title: string; body: string; link?: string; icon?: string }) =>
    api.post<{ success: boolean; sent: number }>('/notifications/broadcast', data),
};

// Upload an image as any authenticated user (suggestions, clans, profile pictures, polymarket, etc.)
export const uploadUserImage = (data: { base64Data: string; mimeType: string }) =>
  api.post<{ imageUrl: string }>('/uploads/image', data);

// ─── Badges API ───────────────────────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  description: string;
  howToObtain?: string | null;
  backgroundType: string;
  backgroundColor: string;
  backgroundGradient?: string | null;
  backgroundImage?: string | null;
  icon: string;
  iconColor: string;
  borderColor: string;
  category: string;
  rarity: string;
  isAutomatic: boolean;
  autoConditionKey?: string | null;
  isActive: boolean;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  createdById?: string | null;
  ownerCount?: number;
}

export interface UserBadgeEntry extends Badge {
  obtainedAt: string;
  obtainedReason?: string | null;
}

export interface UserBadgesResponse {
  equippedBadge1Id: string | null;
  equippedBadge2Id: string | null;
  badges: UserBadgeEntry[];
}

// ─── Support API ──────────────────────────────────────────────────────────────

export interface SupportMessage {
  id: string;
  userId: string;
  body: string;
  images?: string | null; // JSON array of image URLs
  fromAdmin: boolean;
  isRead: boolean;
  createdAt: string;
}

export interface SupportThread {
  userId: string;
  user: { id: string; username: string; profilePicture: string | null; usernameColor: string | null } | null;
  lastBody: string;
  lastFromAdmin: boolean;
  lastCreatedAt: string;
  unreadCount: number;
}

export interface MessagingParticipant {
  user: {
    id: string;
    username: string;
    profilePicture: string | null;
    usernameColor: string | null;
  };
  role: string;
  courtRole: string | null;
  lastReadAt: string | null;
}

export interface MessagingConversationMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  body: string;
  type: string;
  imageUrl?: string | null;
  courtRole: string | null;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    profilePicture: string | null;
    usernameColor: string | null;
  } | null;
}

export interface MessagingConversationSummary {
  id: string;
  type: 'SUPPORT' | 'DM' | 'GROUP' | string;
  title: string | null;
  description: string | null;
  icon: string | null;
  imageUrl: string | null;
  courtCaseId: string | null;
  tagType?: string | null;
  tagLabel?: string | null;
  isFavorite: boolean;
  displayName: string;
  isPinned: boolean;
  unreadCount: number;
  lastMessage: {
    body: string;
    createdAt: string;
    senderId?: string | null;
  } | MessagingConversationMessage | null;
  participants: MessagingParticipant[];
}

export interface MessagingReaction {
  emoji: string;
  count: number;
  users: string[];
  myReaction: boolean;
}

export interface MessagingConversationDetail {
  conversation: MessagingConversationSummary;
  messages: Array<
    MessagingConversationMessage & {
      userId?: string;
      fromAdmin?: boolean;
      isRead?: boolean;
      images?: string | null;
      reactions?: MessagingReaction[];
    }
  >;
}

export interface MessagingReport {
  id: string;
  conversationId: string;
  conversationType?: string;
  conversationTitle?: string | null;
  participants?: Array<{ user: MessagingParticipant['user']; role: string }>;
  reporter: MessagingParticipant['user'];
  reason: string | null;
  status: 'PENDING' | 'ACTION_TAKEN' | 'DISMISSED' | string;
  snapshot: MessagingConversationMessage[];
  reviewerNote?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: { id: string; username: string } | null;
  createdAt: string;
}

export interface AuraVisionReport {
  id: string;
  title: string;
  createdAt: string;
}

export const supportApi = {
  // User
  getMessages: () => api.get<{ messages: SupportMessage[] }>('/support/messages'),
  sendMessage: (body: string, images?: string[]) => api.post<{ message: SupportMessage }>('/support/messages', { body, images }),
  getUnreadCount: () => api.get<{ count: number }>('/support/unread-count'),
  markRead: () => api.post<{ success: boolean }>('/support/messages/read'),
  getConversations: () => api.get<{ conversations: MessagingConversationSummary[] }>('/support/conversations'),
  getConversation: (conversationId: string) => api.get<MessagingConversationDetail>(`/support/conversations/${conversationId}`),
  createConversation: (data: { type: 'DM' | 'GROUP'; title?: string; description?: string; participantIds: string[]; body?: string }) =>
    api.post<{ conversation: MessagingConversationSummary; alreadyExisted: boolean }>('/support/conversations', data),
  sendConversationMessage: (conversationId: string, body: string, courtRole?: string | null, imageUrl?: string | null) =>
    api.post<{ message: MessagingConversationDetail['messages'][number] }>(`/support/conversations/${conversationId}/messages`, { body, courtRole, imageUrl }),
  markConversationRead: (conversationId: string) =>
    api.post<{ success: boolean }>(`/support/conversations/${conversationId}/read`),
  reportConversation: (conversationId: string, reason?: string) =>
    api.post<{ report: MessagingReport }>(`/support/conversations/${conversationId}/report`, { reason }),
  updateConversation: (conversationId: string, data: { title?: string; description?: string; icon?: string; imageUrl?: string }) =>
    api.patch<{ conversation: { id: string; title: string | null; description: string | null; icon: string | null; imageUrl: string | null } }>(`/support/conversations/${conversationId}`, data),
  toggleFavorite: (conversationId: string) =>
    api.patch<{ isFavorite: boolean }>(`/support/conversations/${conversationId}/favorite`, {}),
  addMember: (conversationId: string, userId: string) =>
    api.post<{ success: boolean }>(`/support/conversations/${conversationId}/members`, { userId }),
  requestWitness: (conversationId: string, data: { witnessUserId: string; anonymous: boolean }) =>
    api.post<{ success: boolean }>(`/support/conversations/${conversationId}/witness-requests`, data),
  removeMember: (conversationId: string, memberId: string) =>
    api.delete<{ success: boolean }>(`/support/conversations/${conversationId}/members/${memberId}`),
  reactToMessage: (conversationId: string, messageId: string, emoji: string) =>
    api.post<{ added: boolean }>(`/support/conversations/${conversationId}/messages/${messageId}/react`, { emoji }),
  deleteConversationMessage: (conversationId: string, messageId: string) =>
    api.delete<{ success: boolean }>(`/support/conversations/${conversationId}/messages/${messageId}`),
  blockUser: (userId: string) =>
    api.post<{ success: boolean }>(`/support/block/${userId}`, {}),
  unblockUser: (userId: string) =>
    api.delete<{ success: boolean }>(`/support/block/${userId}`),
  getBlockedUsers: () =>
    api.get<{ blockedUsers: Array<{ id: string; username: string; profilePicture: string | null; usernameColor: string | null }> }>('/support/blocked'),
  // Admin
  getThreads: () => api.get<{ threads: SupportThread[] }>('/support/admin/threads'),
  getThread: (userId: string) => api.get<{ messages: SupportMessage[]; user: SupportThread['user'] }>(`/support/admin/threads/${userId}`),
  reply: (userId: string, body: string, images?: string[]) =>
    api.post<{ message: SupportMessage }>(`/support/admin/reply/${userId}`, { body, images }),
  markThreadRead: (userId: string) => api.post<{ success: boolean }>(`/support/admin/threads/${userId}/read`),
  getReports: () => api.get<{ reports: MessagingReport[] }>('/support/admin/reports'),
  reviewReport: (reportId: string, data: { action: 'ACTION_TAKEN' | 'DISMISSED'; reviewerNote?: string }) =>
    api.post<{ report: { id: string; status: string; reviewerNote: string | null; reviewedAt: string | null } }>(`/support/admin/reports/${reportId}/review`, data),
};

export const auraVisionApi = {
  report: (data: { peerUserId: string; sessionId?: string | null; reason: string; transcript?: Array<{ sender: string; body: string }> }) =>
    api.post<{ report: AuraVisionReport }>('/auravision/report', data),
};

export interface DirectConversationUser {
  id: string;
  username: string;
  firstName?: string | null;
  usernameColor?: string | null;
  profilePicture?: string | null;
  bio?: string | null;
}

export interface DirectConversationMessage {
  id: string;
  body: string;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    usernameColor?: string | null;
    profilePicture?: string | null;
  };
}

export interface DirectConversation {
  id: string;
  updatedAt: string;
  createdAt: string;
  lastMessageAt: string;
  unreadCount: number;
  otherUser: DirectConversationUser | null;
  lastMessage: DirectConversationMessage | null;
}

export const messagesApi = {
  getConversations: () => api.get<{ conversations: DirectConversation[] }>('/messages/conversations'),
  getUnreadCount: () => api.get<{ count: number }>('/messages/unread-count'),
  createConversation: (targetUserId: string) =>
    api.post<{ conversation: DirectConversation }>('/messages/conversations', { targetUserId }),
  getMessages: (conversationId: string) =>
    api.get<{ conversation: DirectConversation; messages: DirectConversationMessage[] }>(`/messages/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, body: string) =>
    api.post<{ message: DirectConversationMessage }>(`/messages/conversations/${conversationId}/messages`, { body }),
  markRead: (conversationId: string) =>
    api.post<{ success: boolean }>(`/messages/conversations/${conversationId}/read`),
};

export const badgesApi = {
  getAll: () => api.get<{ badges: Badge[]; totalUsers: number }>('/badges'),
  getById: (id: string) => api.get<{ badge: Badge }>(`/badges/${id}`),
  getUserBadges: (userId: string) => api.get<UserBadgesResponse>(`/badges/user/${userId}`),
  equip: (slot: 1 | 2, badgeId: string | null) =>
    api.post<{ success: boolean }>('/badges/equip', { slot, badgeId }),
  // Admin
  create: (data: Partial<Badge>) => api.post<{ badge: Badge }>('/badges', data),
  update: (id: string, data: Partial<Badge>) => api.put<{ badge: Badge }>(`/badges/${id}`, data),
  delete: (id: string) => api.delete<{ success: boolean }>(`/badges/${id}`),
  award: (data: { userId: string; badgeId: string; reason?: string }) =>
    api.post<{ success: boolean; alreadyOwned: boolean }>('/badges/award', data),
  revoke: (userId: string, badgeId: string) =>
    api.delete<{ success: boolean }>(`/badges/revoke/${userId}/${badgeId}`),
  getAllUsersAdmin: () => api.get<{ users: Array<{ id: string; username: string; equippedBadge1Id: string | null; equippedBadge2Id: string | null; badges: UserBadgeEntry[] }> }>('/badges/admin/all-users'),
  checkAuto: () => api.post<{ success: boolean; message: string }>('/badges/check-auto'),
};

export interface CustomBadgeRequest {
  id: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  name: string;
  description: string;
  icon: string;
  backgroundColor: string;
  borderColor: string;
  rarity: string;
  adminNote?: string | null;
  badgeId?: string | null;
  badge?: Partial<Badge> | null;
  user?: { id: string; username: string };
  createdAt: string;
  updatedAt: string;
}

export const customBadgesApi = {
  submit: (data: {
    name: string;
    description: string;
    icon: string;
    backgroundColor: string;
    borderColor: string;
    rarity: string;
  }) => api.post<{ request: CustomBadgeRequest }>('/custom-badges', data),
  getMy: () => api.get<{ requests: CustomBadgeRequest[] }>('/custom-badges/my'),
  // Admin
  getPending: () => api.get<{ requests: CustomBadgeRequest[] }>('/custom-badges/pending'),
  approve: (id: string, adminNote?: string) =>
    api.post<{ success: boolean; badge: Badge }>(`/custom-badges/${id}/approve`, { adminNote }),
  reject: (id: string, adminNote?: string) =>
    api.post<{ success: boolean }>(`/custom-badges/${id}/reject`, { adminNote }),
};

export interface ChangelogItem {
  id: string;
  text: string;
  category: string;
}

export interface ChangelogSection {
  category: string;
  items: { id: string; text: string }[];
}

export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  summary: string;
  sections: ChangelogSection[];
}

export const changelogApi = {
  getAll: () => api.get<ChangelogEntry[]>('/changelog'),
  getIds: () => api.get<{ ids: string[] }>('/changelog/ids'),
  createEntry: (data: { date: string; title: string; summary: string }) =>
    api.post<ChangelogEntry>('/changelog', data),
  deleteEntry: (id: string) => api.delete(`/changelog/${id}`),
  addItem: (entryId: string, data: { category: string; text: string }) =>
    api.post<ChangelogItem>(`/changelog/${entryId}/items`, data),
  deleteItem: (entryId: string, itemId: string) =>
    api.delete(`/changelog/${entryId}/items/${itemId}`),
};

// ─── Justice System ──────────────────────────────────────────────────────────

export interface JusticePlainte {
  id: string;
  title: string;
  description: string;
  evidence: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CLOSED' | string;
  rejectionReason: string | null;
  courtId: string;
  plaintifId: string;
  defendantId: string | null;
  plaintif: { id: string; username: string; profilePicture: string | null; usernameColor: string | null } | null;
  defendant: { id: string; username: string; profilePicture: string | null; usernameColor: string | null } | null;
  courtCase: { id: string; caseNumber: string; conversationId: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourtPartyInfo {
  id: string;
  userId: string;
  courtRole: string;
  user: { id: string; username: string; profilePicture: string | null; usernameColor: string | null } | null;
}

export interface CourtCase {
  id: string;
  caseNumber: string;
  conversationId: string;
  plaintifId: string;
  defendantId: string;
  status: 'OPEN' | 'DELIBERATION' | 'VERDICT_GIVEN' | 'CLOSED' | string;
  verdict: string | null;
  verdictAt: string | null;
  sentencing: string | null;
  plaintif: { id: string; username: string; profilePicture: string | null; usernameColor: string | null } | null;
  defendant: { id: string; username: string; profilePicture: string | null; usernameColor: string | null } | null;
  plaintiffLawFirm?: { id: string; name: string; logoUrl: string | null } | null;
  plaintiffLawyer?: { id: string; username: string; profilePicture: string | null; usernameColor: string | null } | null;
  defendantLawFirm?: { id: string; name: string; logoUrl: string | null } | null;
  defendantLawyer?: { id: string; username: string; profilePicture: string | null; usernameColor: string | null } | null;
  parties: CourtPartyInfo[];
  plainte: { id: string; title: string; description: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourtArgument {
  id: string;
  caseId: string;
  side: 'PLAINTIFF' | 'DEFENDANT' | string;
  content: string;
  authorId: string;
  author: { id: string; username: string; profilePicture: string | null; usernameColor: string | null } | null;
  canSeeOpposite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LawFirmPreview {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  ownerId: string;
  owner: { id: string; username: string; profilePicture: string | null; usernameColor: string | null } | null;
  memberCount: number;
  satisfaction: number;
  avgRating?: number | null;
  ratingCount?: number;
  lawyers?: Array<{
    userId: string;
    user: { id: string; username: string; profilePicture: string | null; usernameColor: string | null };
    specialty: string | null;
    isPrimaryLawyer: boolean;
    displayOrder: number;
    lawFirmName: string;
  }>;
}

export const justiceApi = {
  filePlainte: (data: { courtId: string; title: string; description: string; evidence?: string; defendantId?: string }) =>
    api.post<{ plainte: JusticePlainte }>('/justice/plaintes', data),
  listPlaintes: (params?: { courtId?: string }) =>
    api.get<{ plaintes: JusticePlainte[] }>('/justice/plaintes', { params }),
  acceptPlainte: (id: string) =>
    api.patch<{ courtCase: CourtCase }>(`/justice/plaintes/${id}/accept`),
  rejectPlainte: (id: string, reason?: string) =>
    api.patch<{ plainte: JusticePlainte }>(`/justice/plaintes/${id}/reject`, { reason }),
  listCases: () =>
    api.get<{ cases: CourtCase[] }>('/justice/cases'),
  getCase: (id: string) =>
    api.get<{ courtCase: CourtCase }>(`/justice/cases/${id}`),
  chooseRepresentation: (caseId: string, data: { type: 'PRIVATE_LAWYER' | 'PUBLIC_DEFENDER'; lawFirmId?: string; lawyerUserId?: string }) =>
    api.post<{ courtCase: CourtCase }>(`/justice/cases/${caseId}/representation`, data),
  submitArgument: (caseId: string, content: string) =>
    api.put<{ argument: CourtArgument }>(`/justice/cases/${caseId}/argument`, { content }),
  getArguments: (caseId: string) =>
    api.get<{ arguments: CourtArgument[] }>(`/justice/cases/${caseId}/arguments`),
  changeStatus: (caseId: string, status: string) =>
    api.patch<{ courtCase: CourtCase }>(`/justice/cases/${caseId}/status`, { status }),
  deliverVerdict: (caseId: string, data: { verdict: string; sentencing?: string }) =>
    api.post<{ courtCase: CourtCase }>(`/justice/cases/${caseId}/verdict`, data),
  getLawFirms: () =>
    api.get<{ lawFirms: LawFirmPreview[] }>('/justice/law-firms'),
  getCaseByCaseId: (id: string) =>
    api.get<{ courtCase: CourtCase }>(`/justice/cases/${id}`),
};

export default api;
