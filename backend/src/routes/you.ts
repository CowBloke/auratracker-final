import path from 'path';
import { Router, type Response } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../server.js';
import {
  accessFormationProduct,
  buyLivretEpargneUpgrade,
  buyIllegalBusinessUpgrade,
  cancelBusinessBuyoutOffer,
  setLoanRate,
  setTransferFeeRate,
  updateBusinessMenu,
  createBusiness,
  createBusinessBuyoutOffer,
  createRelationship,
  deleteBusiness,
  depositToCouple,
  divorceRelationship,
  executeBusinessAction,
  forgetRelationship,
  getYouSkills,
  getYouState,
  makeMistress,
  proposeMarriage,
  respondToBusinessInvitation,
  respondToBusinessBuyoutOffer,
  respondToBusinessLoan,
  respondToCourtCase,
  respondToDivorceProposal,
  respondToMarriageProposal,
  runTransferBusinessAction,
  suspectCheating,
  trainUserSkill,
  withdrawFromCouple,
  getBusinessTransactions,
  getBusinessLoansHistory,
  getBankAccounts,
  openBankAccount,
  bankAccountDeposit,
  bankAccountWithdraw,
  setFormationDetails,
  buyFormation,
  updateBusinessProfile,
  listFormationProducts,
  addFormationProduct,
  applyToBusiness,
  updateFormationProduct,
  deleteFormationProduct,
  buyFormationProduct,
  listPendingFormationProductsForAdmin,
  markReviewPromptShown,
  openBusinessSupportConversation,
  rateFormationProduct,
  rateLawyerForCase,
  reviewFormationProduct,
  setBusinessSupportAgent,
  updateLawFirmMemberMetadata,
  updateMemberProfile,
  updateMemberSalary,
  sackMember,
  repayLoan,
  repayLoanByBorrower,
  rateBusiness,
  createBusinessShareProposal,
  createShareMarketListing,
  createBusinessShareBuybackOffer,
  buyShareMarketListing,
  cancelShareMarketListing,
  cancelBusinessShareProposal,
  respondToBusinessShareProposal,
  getUserBusinessPurchases,
  getYouTemporaryEffects,
} from '../modules/you/service.js';
import type { BusinessActionKey } from '../modules/you/config.js';

const router = Router();
const YOU_LOGO_ADMIN_ONLY_KEY = 'you_logo_admin_only';

const ERROR_STATUS: Record<string, number> = {
  INVALID_BUSINESS_TYPE: 400,
  INVALID_BUSINESS_NAME: 400,
  BUSINESS_CAPITAL_TOO_LOW: 400,
  INSUFFICIENT_MONEY: 400,
  INSUFFICIENT_SHARED_MONEY: 400,
  INVALID_SKILL_KEY: 400,
  SKILL_ALREADY_MAXED: 400,
  SKILL_NOT_TRAINABLE: 400,
  USER_NOT_FOUND: 404,
  BUSINESS_NOT_FOUND: 404,
  BUSINESS_SLOT_LIMIT_REACHED: 400,
  BUSINESS_TYPE_ADMIN_ONLY: 403,
  BUSINESS_RATING_NOT_ALLOWED: 403,
  BUSINESS_LIQUIDATION_FORBIDDEN: 403,
  BUSINESS_ACTION_UNAVAILABLE: 400,
  BUSINESS_INVITE_FORBIDDEN: 403,
  INVITEE_REQUIRED: 400,
  NO_NEW_INVITATIONS: 400,
  BUSINESS_LOAN_SELF_FORBIDDEN: 400,
  INVALID_LOAN_AMOUNT: 400,
  INVALID_LOAN_DURATION: 400,
  INVALID_LOAN_COLLATERAL: 400,
  FORMATION_PRODUCT_NOT_APPROVED: 403,
  LOAN_MOTIVATION_TOO_LONG: 400,
  LOAN_COLLATERAL_AURA_TOO_LOW: 400,
  BUSINESS_DEPOSIT_FORBIDDEN: 403,
  INVALID_DEPOSIT_AMOUNT: 400,
  BUSINESS_WITHDRAW_FORBIDDEN: 403,
  INVALID_WITHDRAW_AMOUNT: 400,
  BUSINESS_TREASURY_TOO_LOW: 400,
  BUSINESS_LOAN_NOT_FOUND: 404,
  BUSINESS_LOAN_REVIEW_FORBIDDEN: 403,
  BUSINESS_LOAN_ALREADY_DECIDED: 400,
  BUSINESS_INVITATION_NOT_FOUND: 404,
  BUSINESS_INVITATION_FORBIDDEN: 403,
  BUSINESS_INVITATION_ALREADY_RESOLVED: 400,
  BUSINESS_INVEST_SELF_FORBIDDEN: 400,
  INVALID_INVEST_AMOUNT: 400,
  BUSINESS_TRANSFER_UNAVAILABLE: 400,
  INVALID_TRANSFER_AMOUNT: 400,
  TRANSFER_RECIPIENT_INVALID: 400,
  BUSINESS_RESEARCH_FORBIDDEN: 403,
  BUSINESS_RESEARCH_UNAVAILABLE: 400,
  INVALID_STARTUP_PRODUCT_SLOT: 400,
  STARTUP_RESEARCH_ALREADY_RUNNING: 400,
  STARTUP_RESEARCH_READY_TO_DEPLOY: 400,
  STARTUP_RESEARCH_NOT_READY: 400,
  STARTUP_PRODUCT_MAXED: 400,
  RELATIONSHIP_SELF_FORBIDDEN: 400,
  TARGET_NOT_FOUND: 404,
  RELATIONSHIP_ALREADY_EXISTS: 400,
  RELATIONSHIP_NOT_FOUND: 404,
  RELATIONSHIP_FORBIDDEN: 403,
  RELATIONSHIP_ALREADY_MARRIED: 400,
  RELATIONSHIP_LEVEL_TOO_LOW: 400,
  RELATIONSHIP_NOT_MARRIED: 400,
  MARRIAGE_PROPOSAL_ALREADY_PENDING: 400,
  MARRIAGE_PROPOSAL_NOT_FOUND: 404,
  MARRIAGE_PROPOSAL_FORBIDDEN: 403,
  MARRIAGE_PROPOSAL_ALREADY_RESOLVED: 400,
  DIVORCE_PROPOSAL_ALREADY_PENDING: 400,
  DIVORCE_PROPOSAL_NOT_FOUND: 404,
  DIVORCE_PROPOSAL_FORBIDDEN: 403,
  DIVORCE_PROPOSAL_ALREADY_RESOLVED: 400,
  YOU_ADMIN_ONLY: 403,
  RELATIONSHIP_NOT_ACTIVE: 400,
  NOT_MARRIED: 400,
  INVALID_COUPLE_AMOUNT: 400,
  COUPLE_BALANCE_TOO_LOW: 400,
  INVALID_LOAN_RATE: 400,
  BANK_RATE_FORBIDDEN: 403,
  INVALID_TRANSFER_FEE_RATE: 400,
  TRANSFER_FEE_FORBIDDEN: 403,
  BUYOUT_SELF_FORBIDDEN: 400,
  INVALID_BUYOUT_AMOUNT: 400,
  BUYOUT_ALREADY_OWNS_BUSINESS: 400,
  BUYOUT_OFFER_ALREADY_PENDING: 400,
  BUYOUT_OFFER_NOT_FOUND: 404,
  BUYOUT_OFFER_REVIEW_FORBIDDEN: 403,
  BUYOUT_OFFER_CANCEL_FORBIDDEN: 403,
  BUYOUT_OFFER_ALREADY_RESOLVED: 400,
  BANK_SELF_ACCOUNT_FORBIDDEN: 403,
  BANK_EPARGNE_LOCKED: 403,
  BANK_ACCOUNT_ALREADY_EXISTS: 400,
  BANK_ACCOUNT_NOT_FOUND: 404,
  INVALID_BANK_AMOUNT: 400,
  BANK_BALANCE_TOO_LOW: 400,
  FORMATION_EDIT_FORBIDDEN: 403,
  BUSINESS_EDIT_FORBIDDEN: 403,
  FORMATION_SELF_BUY_FORBIDDEN: 403,
  FORMATION_ACCESS_FORBIDDEN: 403,
  FORMATION_URL_NOT_SET: 400,
  INVALID_FORMATION_PRICE: 400,
  INVALID_FORMATION_TITLE: 400,
  INVALID_FORMATION_URL: 400,
  INVALID_FORMATION_FILE: 400,
  INVALID_FORMATION_FILE_TYPE: 400,
  INVALID_FORMATION_FILE_SIZE: 400,
  FORMATION_PRODUCT_NOT_FOUND: 404,
  INVALID_BUSINESS_RATING: 400,
  INVALID_SALARY: 400,
  MEMBER_NOT_FOUND: 404,
  CHEATING_ACCUSATION_ALREADY_PENDING: 400,
  CHEATING_ACCUSATION_NOT_FOUND: 404,
  CHEATING_ACCUSATION_FORBIDDEN: 403,
  CHEATING_ACCUSATION_ALREADY_RESOLVED: 400,
  BUSINESS_LEVEL_LOCKED: 400,
  BUSINESS_COLLECT_FORBIDDEN: 403,
  COLLECT_ON_COOLDOWN: 400,
  YOUTUBE_SOCIAL_LEVEL_REQUIRED: 400,
  PURCHASE_SELF_FORBIDDEN: 400,
  ITEM_NOT_FOUND: 404,
  LOAN_NOT_ACTIVE: 400,
  LOAN_ALREADY_REPAID: 400,
  BORROWER_INSUFFICIENT_MONEY: 400,
  LOAN_COLLATERAL_NOT_CLAIMABLE_YET: 400,
  SHARE_SELF_FORBIDDEN: 400,
  INVALID_SHARE_PERCENT: 400,
  INVALID_SHARE_AMOUNT: 400,
  SHARE_PROPOSAL_ALREADY_PENDING: 400,
  SHARE_PROPOSAL_NOT_FOUND: 404,
  SHARE_PROPOSAL_REVIEW_FORBIDDEN: 403,
  SHARE_PROPOSAL_ALREADY_RESOLVED: 400,
  SHARE_PROPOSAL_CANCEL_FORBIDDEN: 403,
  SHARE_PROPOSAL_CANCEL_TOO_EARLY: 400,
  BUSINESS_SHARE_CAP_EXCEEDED: 400,
  SHARE_BUYBACK_FORBIDDEN: 403,
  SHARE_BUYBACK_TARGET_INVALID: 400,
  SHARE_BUYBACK_TARGET_NOT_FOUND: 404,
  SHARE_BUYBACK_ALREADY_PENDING: 400,
  BUSINESS_UPGRADE_FORBIDDEN: 403,
  BUSINESS_UPGRADE_UNAVAILABLE: 400,
  UPGRADE_ALREADY_OWNED: 400,
  UPGRADE_INSUFFICIENT_FUNDS: 400,
  SHARE_MARKET_LISTING_NOT_FOUND: 404,
  SHARE_MARKET_LISTING_FORBIDDEN: 403,
  SHARE_MARKET_INVALID_SHARE_PERCENT: 400,
  SHARE_MARKET_INVALID_PRICE: 400,
  SHARE_MARKET_INSUFFICIENT_SHARES: 400,
  SHARE_MARKET_BUY_OWN_LISTING: 400,
  SHARE_MARKET_ALREADY_RESOLVED: 400,
  SHARE_MARKET_SELLER_NO_LONGER_HAS_SHARES: 400,
};

const ERROR_MESSAGE: Record<string, string> = {
  INVALID_BUSINESS_TYPE: 'Type de business invalide.',
  INVALID_BUSINESS_NAME: 'Le nom du business est trop court.',
  BUSINESS_CAPITAL_TOO_LOW: 'Le capital de depart est trop faible pour ce type de business.',
  INSUFFICIENT_MONEY: 'Tu n as pas assez de money pour cette action.',
  INSUFFICIENT_SHARED_MONEY: 'Ton foyer n a pas assez de money pour cette action.',
  INVALID_SKILL_KEY: 'Competence inconnue.',
  SKILL_ALREADY_MAXED: 'Cette competence est deja au niveau maximum.',
  USER_NOT_FOUND: 'Utilisateur introuvable.',
  BUSINESS_NOT_FOUND: 'Business introuvable.',
  BUSINESS_SLOT_LIMIT_REACHED: 'Tu as deja atteint ton nombre maximum de business.',
  BUSINESS_TYPE_ADMIN_ONLY: 'Ce type de business est reserve aux administrateurs.',
  BUSINESS_LIQUIDATION_FORBIDDEN: 'Tu ne peux pas liquider ce business.',
  BUSINESS_ACTION_UNAVAILABLE: 'Cette action n est pas disponible pour ce business.',
  BUSINESS_INVITE_FORBIDDEN: 'Seul le proprietaire peut inviter des joueurs.',
  INVITEE_REQUIRED: 'Choisis au moins un joueur a inviter.',
  NO_NEW_INVITATIONS: 'Aucune nouvelle invitation a envoyer.',
  BUSINESS_LOAN_SELF_FORBIDDEN: 'Tu ne peux pas emprunter a ton propre business.',
  INVALID_LOAN_AMOUNT: 'Montant d emprunt invalide.',
  INVALID_LOAN_DURATION: 'Duree d emprunt invalide.',
  INVALID_LOAN_COLLATERAL: 'Le montant d hypothèque en aura est invalide.',
  LOAN_MOTIVATION_TOO_LONG: 'La lettre de motivation est trop longue.',
  LOAN_COLLATERAL_AURA_TOO_LOW: 'Le joueur n a pas assez d aura pour bloquer cette hypothèque.',
  BUSINESS_DEPOSIT_FORBIDDEN: 'Seul le proprietaire peut deposer du money dans ce business.',
  INVALID_DEPOSIT_AMOUNT: 'Montant de depot invalide.',
  BUSINESS_WITHDRAW_FORBIDDEN: 'Seul le proprietaire peut retirer du money de ce business.',
  INVALID_WITHDRAW_AMOUNT: 'Montant de retrait invalide.',
  BUSINESS_TREASURY_TOO_LOW: 'La tresorerie du business est insuffisante.',
  BUSINESS_LOAN_NOT_FOUND: 'Demande de pret introuvable.',
  BUSINESS_LOAN_REVIEW_FORBIDDEN: 'Tu ne peux pas traiter cette demande de pret.',
  BUSINESS_LOAN_ALREADY_DECIDED: 'Cette demande de pret a deja ete traitee.',
  BUSINESS_INVITATION_NOT_FOUND: 'Invitation business introuvable.',
  BUSINESS_INVITATION_FORBIDDEN: 'Tu ne peux pas repondre a cette invitation.',
  BUSINESS_INVITATION_ALREADY_RESOLVED: 'Cette invitation a deja ete traitee.',
  BUSINESS_INVEST_SELF_FORBIDDEN: 'Tu ne peux pas investir dans ton propre business via cette action.',
  INVALID_INVEST_AMOUNT: 'Montant d investissement invalide.',
  BUSINESS_TRANSFER_UNAVAILABLE: 'Cette action est reservee aux services de transfert.',
  INVALID_TRANSFER_AMOUNT: 'Montant de transfert invalide.',
  TRANSFER_RECIPIENT_INVALID: 'Destinataire invalide.',
  BUSINESS_RESEARCH_FORBIDDEN: 'Tu ne peux pas lancer cette recherche sur ce business.',
  BUSINESS_RESEARCH_UNAVAILABLE: 'Cette action de recherche est reservee aux startups tech.',
  INVALID_STARTUP_PRODUCT_SLOT: 'Produit startup invalide.',
  STARTUP_RESEARCH_ALREADY_RUNNING: 'Une recherche est deja en cours sur ce produit.',
  STARTUP_RESEARCH_READY_TO_DEPLOY: 'Cette recherche est terminee. Deploie le produit avant de recommencer.',
  STARTUP_RESEARCH_NOT_READY: 'La recherche n est pas encore terminee.',
  STARTUP_PRODUCT_MAXED: 'Ce produit a deja atteint le niveau maximum.',
  RELATIONSHIP_SELF_FORBIDDEN: 'Tu ne peux pas creer une relation avec toi-meme.',
  TARGET_NOT_FOUND: 'Le joueur cible est introuvable.',
  RELATIONSHIP_ALREADY_EXISTS: 'Cette relation existe deja.',
  RELATIONSHIP_NOT_FOUND: 'Relation introuvable.',
  RELATIONSHIP_FORBIDDEN: 'Action non autorisee sur cette relation.',
  RELATIONSHIP_ALREADY_MARRIED: 'Cette relation est deja marquee comme mariee.',
  RELATIONSHIP_LEVEL_TOO_LOW: 'Le niveau de relation doit etre au moins de 70 pour un mariage.',
  RELATIONSHIP_NOT_MARRIED: 'Cette relation n est pas marquee comme mariee.',
  MARRIAGE_PROPOSAL_ALREADY_PENDING: 'Une demande en mariage est deja en attente.',
  MARRIAGE_PROPOSAL_NOT_FOUND: 'Demande en mariage introuvable.',
  MARRIAGE_PROPOSAL_FORBIDDEN: 'Tu ne peux pas repondre a cette demande.',
  MARRIAGE_PROPOSAL_ALREADY_RESOLVED: 'Cette demande a deja ete traitee.',
  DIVORCE_PROPOSAL_ALREADY_PENDING: 'Une demande de divorce est deja en attente.',
  DIVORCE_PROPOSAL_NOT_FOUND: 'Demande de divorce introuvable.',
  DIVORCE_PROPOSAL_FORBIDDEN: 'Tu ne peux pas repondre a cette demande de divorce.',
  DIVORCE_PROPOSAL_ALREADY_RESOLVED: 'Cette demande de divorce a deja ete traitee.',
  YOU_ADMIN_ONLY: 'Cette section est reservee aux admins.',
  RELATIONSHIP_NOT_ACTIVE: 'Cette relation n est pas active (ami ou en relation).',
  NOT_MARRIED: 'Tu dois etre marie pour avoir une liaison.',
  INVALID_COUPLE_AMOUNT: 'Montant invalide.',
  COUPLE_BALANCE_TOO_LOW: 'Le compte commun n a pas assez de fonds.',
  INVALID_LOAN_RATE: 'Le taux d emprunt doit etre entre 1% et 50%.',
  BANK_RATE_FORBIDDEN: 'Seul le proprietaire peut modifier le taux d emprunt.',
  INVALID_TRANSFER_FEE_RATE: 'Les frais de transfert doivent etre entre 0% et 25%.',
  TRANSFER_FEE_FORBIDDEN: 'Seul le proprietaire peut modifier les frais de transfert.',
  BUYOUT_SELF_FORBIDDEN: 'Tu ne peux pas faire une offre sur ton propre business.',
  INVALID_BUYOUT_AMOUNT: 'Montant d offre invalide.',
  BUYOUT_ALREADY_OWNS_BUSINESS: 'Tu posssedes deja une entreprise, tu ne peux pas en racheter une autre.',
  BUYOUT_OFFER_ALREADY_PENDING: 'Tu as deja une offre en attente sur ce business.',
  BUYOUT_OFFER_NOT_FOUND: 'Offre de rachat introuvable.',
  BUYOUT_OFFER_REVIEW_FORBIDDEN: 'Tu ne peux pas traiter cette offre.',
  BUYOUT_OFFER_CANCEL_FORBIDDEN: 'Tu ne peux pas annuler cette offre.',
  BUYOUT_OFFER_ALREADY_RESOLVED: 'Cette offre de rachat a deja ete traitee.',
  FORMATION_PRODUCT_NOT_APPROVED: 'Cette formation n est pas encore disponible.',
  FORMATION_EDIT_FORBIDDEN: 'Seul le proprietaire peut modifier cette formation.',
  BUSINESS_EDIT_FORBIDDEN: 'Seul le proprietaire peut modifier ce business.',
  FORMATION_SELF_BUY_FORBIDDEN: 'Tu ne peux pas acheter ta propre formation.',
  FORMATION_ACCESS_FORBIDDEN: 'Tu n as pas acces a cette formation.',
  FORMATION_URL_NOT_SET: 'Aucune URL de formation n est configuree.',
  INVALID_FORMATION_PRICE: 'Le prix de la formation est invalide.',
  INVALID_FORMATION_TITLE: 'Le titre de la formation est invalide.',
  INVALID_FORMATION_URL: 'Ajoute un lien externe ou un fichier pour cette formation.',
  INVALID_FORMATION_FILE: 'Le fichier de formation est invalide.',
  INVALID_FORMATION_FILE_TYPE: 'Le type de fichier de formation n est pas autorise.',
  INVALID_FORMATION_FILE_SIZE: 'Le fichier de formation depasse la taille autorisee.',
  FORMATION_PRODUCT_NOT_FOUND: 'Formation introuvable.',
  INVALID_BUSINESS_RATING: 'La note doit etre comprise entre 1 et 5.',
  CHEATING_ACCUSATION_ALREADY_PENDING: 'Une suspicion est deja en attente.',
  CHEATING_ACCUSATION_NOT_FOUND: 'Accusation introuvable.',
  CHEATING_ACCUSATION_FORBIDDEN: 'Tu ne peux pas repondre a cette accusation.',
  CHEATING_ACCUSATION_ALREADY_RESOLVED: 'Cette accusation a deja ete traitee.',
  BUSINESS_LEVEL_LOCKED: 'Tu dois debloquer le niveau precedent avant de creer ce type d entreprise.',
  BUSINESS_COLLECT_FORBIDDEN: 'Seul le proprietaire peut collecter les recettes.',
  COLLECT_ON_COOLDOWN: 'Tu dois attendre avant de collecter a nouveau.',
  YOUTUBE_SOCIAL_LEVEL_REQUIRED: 'Il faut au moins le niveau 3 en social pour creer une chaine YouTube.',
  PURCHASE_SELF_FORBIDDEN: 'Tu ne peux pas acheter dans ton propre commerce.',
  ITEM_NOT_FOUND: 'Article introuvable.',
  LOAN_NOT_ACTIVE: 'Ce pret n est pas actif.',
  LOAN_ALREADY_REPAID: 'Ce pret a deja ete rembourse.',
  BORROWER_INSUFFICIENT_MONEY: 'L emprunteur n a pas assez de money pour rembourser.',
  LOAN_COLLATERAL_NOT_CLAIMABLE_YET: 'L emprunteur n a pas assez de money pour rembourser et l echeance n est pas encore depassee.',
  SHARE_SELF_FORBIDDEN: 'Tu ne peux pas proposer de devenir actionnaire de ton propre business.',
  INVALID_SHARE_PERCENT: 'La part proposee doit etre comprise entre 0 et 100.',
  INVALID_SHARE_AMOUNT: 'La somme proposee est invalide.',
  SHARE_PROPOSAL_ALREADY_PENDING: 'Tu as deja une proposition d actionnariat en attente pour ce business.',
  SHARE_PROPOSAL_NOT_FOUND: 'Proposition d actionnariat introuvable.',
  SHARE_PROPOSAL_REVIEW_FORBIDDEN: 'Tu ne peux pas traiter cette proposition d actionnariat.',
  SHARE_PROPOSAL_ALREADY_RESOLVED: 'Cette proposition d actionnariat a deja ete traitee.',
  SHARE_PROPOSAL_CANCEL_FORBIDDEN: 'Tu ne peux pas annuler cette proposition.',
  SHARE_PROPOSAL_CANCEL_TOO_EARLY: 'Tu pourras annuler cette proposition apres un mois in game.',
  BUSINESS_SHARE_CAP_EXCEEDED: 'La repartition du capital depasse 100%.',
  SHARE_BUYBACK_FORBIDDEN: 'Seul le fondateur peut demander le rachat des parts.',
  SHARE_BUYBACK_TARGET_INVALID: 'Actionnaire cible invalide.',
  SHARE_BUYBACK_TARGET_NOT_FOUND: 'Cet utilisateur ne detient pas de parts sur ce business.',
  SHARE_BUYBACK_ALREADY_PENDING: 'Une demande de rachat est deja en attente pour cet actionnaire.',
  BUSINESS_UPGRADE_FORBIDDEN: 'Tu ne peux pas acheter cette amelioration.',
  BUSINESS_UPGRADE_UNAVAILABLE: 'Cette amelioration n est pas disponible pour ce business.',
  UPGRADE_ALREADY_OWNED: 'Cette amelioration est deja debloquee.',
  UPGRADE_INSUFFICIENT_FUNDS: 'La tresorerie du business est insuffisante pour cette amelioration.',
  SHARE_MARKET_LISTING_NOT_FOUND: 'Annonce introuvable.',
  SHARE_MARKET_LISTING_FORBIDDEN: 'Tu ne peux pas modifier cette annonce.',
  SHARE_MARKET_INVALID_SHARE_PERCENT: 'La part a revendre doit etre comprise entre 0 et 100.',
  SHARE_MARKET_INVALID_PRICE: 'Le prix de vente est invalide.',
  SHARE_MARKET_INSUFFICIENT_SHARES: 'Tu ne possedes pas assez de parts pour cette vente.',
  SHARE_MARKET_BUY_OWN_LISTING: 'Tu ne peux pas acheter ta propre annonce.',
  SHARE_MARKET_ALREADY_RESOLVED: 'Cette annonce n est plus disponible.',
  SHARE_MARKET_SELLER_NO_LONGER_HAS_SHARES: 'Le vendeur ne detient plus suffisamment de parts.',
};

async function requireYouAccess(req: AuthRequest, res: Response, next: () => void) {
  try {
    const setting = await prisma.gameSettings.findUnique({ where: { key: YOU_LOGO_ADMIN_ONLY_KEY } });
    const adminOnlyEnabled = setting?.value === 'true';

    if (adminOnlyEnabled && !req.user?.isAdmin) {
      return res.status(403).json({ error: ERROR_MESSAGE.YOU_ADMIN_ONLY, code: 'YOU_ADMIN_ONLY' });
    }

    next();
  } catch (error) {
    console.error('YOU access check error:', error);
    res.status(500).json({ error: 'Erreur interne.', code: 'UNKNOWN' });
  }
}

function handleRouteError(error: unknown, res: Response, logLabel: string) {
  const code = error instanceof Error ? error.message : 'UNKNOWN';
  const status = ERROR_STATUS[code] ?? 500;
  const message = ERROR_MESSAGE[code] ?? 'Erreur interne.';

  if (status >= 500) {
    console.error(`${logLabel}:`, error);
  }

  res.status(status).json({ error: message, code });
}

router.get('/state', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const state = await getYouState(req.user!.id);
    res.json(state);
  } catch (error) {
    handleRouteError(error, res, 'Get YOU state error');
  }
});

router.get('/skills', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const skills = await getYouSkills(req.user!.id);
    res.json({ skills });
  } catch (error) {
    handleRouteError(error, res, 'Get YOU skills error');
  }
});

router.get('/temporary-effects', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const effects = await getYouTemporaryEffects(req.user!.id);
    res.json({ effects });
  } catch (error) {
    handleRouteError(error, res, 'Get temporary effects error');
  }
});

router.post('/skills/:skillKey/train', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const skill = await trainUserSkill(req.user!.id, req.params.skillKey);
    res.json({ skill });
  } catch (error) {
    handleRouteError(error, res, 'Train YOU skill error');
  }
});

router.post('/businesses', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    // Check global creation toggle
    const creationSetting = await prisma.gameSettings.findUnique({ where: { key: 'business_creation_enabled' } });
    if (creationSetting?.value === 'false' && !req.user?.isAdmin) {
      return res.status(403).json({ error: 'La creation d entreprise est temporairement desactivee.', code: 'BUSINESS_CREATION_DISABLED' });
    }
    const isAdmin = Boolean(req.user?.isAdmin || req.user?.isSuperAdmin);
    const business = await createBusiness(req.user!.id, {
      name: String(req.body?.name ?? ''),
      typeKey: String(req.body?.typeKey ?? ''),
      capital: Number(req.body?.capital ?? 0),
      description: typeof req.body?.description === 'string' ? req.body.description : undefined,
      location: typeof req.body?.location === 'string' ? req.body.location : undefined,
    }, isAdmin);
    res.status(201).json({ business });
  } catch (error) {
    handleRouteError(error, res, 'Create business error');
  }
});

router.post('/businesses/:businessId/actions/transfer', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await runTransferBusinessAction(req.user!.id, req.params.businessId, {
      recipientId: String(req.body?.recipientId ?? ''),
      amount: Number(req.body?.amount ?? 0),
    });
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Run transfer business action error');
  }
});

router.post('/businesses/:businessId/actions/:actionKey', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const actionKey = req.params.actionKey as BusinessActionKey;
    const result = await executeBusinessAction(req.user!.id, req.params.businessId, actionKey, req.body ?? {});
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Run business action error');
  }
});

router.post('/businesses/:businessId/apply', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await applyToBusiness(req.user!.id, req.params.businessId, {
      role: typeof req.body?.role === 'string' ? req.body.role : undefined,
      salary: Number(req.body?.salary ?? 0),
      message: typeof req.body?.message === 'string' ? req.body.message : undefined,
    });
    res.status(201).json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Apply to business error');
  }
});

router.post('/businesses/:businessId/buyout-offers', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const offer = await createBusinessBuyoutOffer(req.user!.id, req.params.businessId, {
      amount: Number(req.body?.amount ?? 0),
      message: typeof req.body?.message === 'string' ? req.body.message : undefined,
    });
    res.status(201).json({ offer });
  } catch (error) {
    handleRouteError(error, res, 'Create buyout offer error');
  }
});

router.post('/businesses/:businessId/shareholder-proposals', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const proposal = await createBusinessShareProposal(req.user!.id, req.params.businessId, {
      sharePercent: Number(req.body?.sharePercent ?? 0),
      amount: Number(req.body?.amount ?? 0),
      message: typeof req.body?.message === 'string' ? req.body.message : undefined,
    });
    res.status(201).json({ proposal });
  } catch (error) {
    handleRouteError(error, res, 'Create shareholder proposal error');
  }
});

router.post('/businesses/:businessId/share-buyback-offers', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const offer = await createBusinessShareBuybackOffer(req.user!.id, req.params.businessId, {
      shareholderId: String(req.body?.shareholderId ?? ''),
      amount: Number(req.body?.amount ?? 0),
      message: typeof req.body?.message === 'string' ? req.body.message : undefined,
    });
    res.status(201).json({ offer });
  } catch (error) {
    handleRouteError(error, res, 'Create share buyback offer error');
  }
});

router.post('/share-market/listings', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const listing = await createShareMarketListing(req.user!.id, {
      businessId: String(req.body?.businessId ?? ''),
      sharePercent: Number(req.body?.sharePercent ?? 0),
      price: Number(req.body?.price ?? 0),
    });
    res.status(201).json({ listing });
  } catch (error) {
    handleRouteError(error, res, 'Create share market listing error');
  }
});

router.post('/share-market/listings/:listingId/buy', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await buyShareMarketListing(req.user!.id, req.params.listingId);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Buy share market listing error');
  }
});

router.delete('/share-market/listings/:listingId', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await cancelShareMarketListing(req.user!.id, req.params.listingId);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Cancel share market listing error');
  }
});

router.post('/shareholder-proposals/:proposalId/respond', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const decision = req.body?.decision === 'accept' ? 'accept' : 'reject';
    const result = await respondToBusinessShareProposal(req.user!.id, req.params.proposalId, decision);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Respond shareholder proposal error');
  }
});

router.delete('/shareholder-proposals/:proposalId', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await cancelBusinessShareProposal(req.user!.id, req.params.proposalId);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Cancel shareholder proposal error');
  }
});

router.post('/buyout-offers/:offerId/respond', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const decision = req.body?.decision === 'accept' ? 'accept' : 'reject';
    const result = await respondToBusinessBuyoutOffer(req.user!.id, req.params.offerId, decision);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Respond buyout offer error');
  }
});

router.delete('/buyout-offers/:offerId', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await cancelBusinessBuyoutOffer(req.user!.id, req.params.offerId);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Cancel buyout offer error');
  }
});

router.post('/loans/:loanId/respond', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const decision = req.body?.decision === 'accept' ? 'accept' : 'reject';
    const result = await respondToBusinessLoan(req.user!.id, req.params.loanId, decision);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Respond business loan error');
  }
});

router.post('/business-invitations/:invitationId/respond', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const decision = req.body?.decision === 'accept' ? 'accept' : 'reject';
    const result = await respondToBusinessInvitation(req.user!.id, req.params.invitationId, decision);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Respond business invitation error');
  }
});

router.post('/relationships', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const type = req.body?.type === 'FRIEND' ? 'FRIEND' : 'DATING';
    const relationship = await createRelationship(req.user!.id, String(req.body?.targetUserId ?? ''), type);
    res.status(201).json({ relationship });
  } catch (error) {
    handleRouteError(error, res, 'Create relationship error');
  }
});

router.post('/relationships/:relationshipId/actions/propose-marriage', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const proposal = await proposeMarriage(req.user!.id, req.params.relationshipId, typeof req.body?.message === 'string' ? req.body.message : undefined);
    res.status(201).json({ proposal });
  } catch (error) {
    handleRouteError(error, res, 'Propose marriage error');
  }
});

router.post('/marriage-proposals/:proposalId/respond', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const decision = req.body?.decision === 'accept' ? 'accept' : 'reject';
    const result = await respondToMarriageProposal(req.user!.id, req.params.proposalId, decision);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, 'Respond marriage proposal error');
  }
});

router.post('/relationships/:relationshipId/actions/divorce', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const proposal = await divorceRelationship(
      req.user!.id,
      req.params.relationshipId,
      typeof req.body?.message === 'string' ? req.body.message : undefined
    );
    res.json({ proposal });
  } catch (error) {
    handleRouteError(error, res, 'Divorce relationship error');
  }
});

router.post('/divorce-proposals/:proposalId/respond', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const decision = req.body?.decision === 'accept' ? 'accept' : 'reject';
    const result = await respondToDivorceProposal(req.user!.id, req.params.proposalId, decision);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, 'Respond divorce proposal error');
  }
});

router.post('/relationships/:relationshipId/actions/couple-deposit', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const amount = Number(req.body?.amount);
    const result = await depositToCouple(req.user!.id, req.params.relationshipId, amount);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, 'Couple deposit error');
  }
});

router.post('/relationships/:relationshipId/actions/couple-withdraw', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const amount = Number(req.body?.amount);
    const result = await withdrawFromCouple(req.user!.id, req.params.relationshipId, amount);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, 'Couple withdraw error');
  }
});

router.delete('/relationships/:relationshipId', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    await forgetRelationship(req.user!.id, req.params.relationshipId);
    res.json({ ok: true });
  } catch (error) {
    handleRouteError(error, res, 'Forget relationship error');
  }
});

router.post('/relationships/:relationshipId/actions/make-mistress', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const relationship = await makeMistress(req.user!.id, req.params.relationshipId);
    res.json({ relationship });
  } catch (error) {
    handleRouteError(error, res, 'Make mistress error');
  }
});

router.post('/relationships/:relationshipId/actions/suspect-cheating', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await suspectCheating(req.user!.id, req.params.relationshipId);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, 'Suspect cheating error');
  }
});

router.post('/cheating-accusations/:accusationId/respond', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const decision = req.body?.decision === 'court' ? 'court' : 'drop';
    const result = await respondToCourtCase(req.user!.id, req.params.accusationId, decision);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, 'Respond court case error');
  }
});

router.post('/businesses/:businessId/set-loan-rate', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const rate = Number(req.body?.rate);
    const result = await setLoanRate(req.user!.id, req.params.businessId, rate);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Set loan rate error');
  }
});

router.post('/businesses/:businessId/update-menu', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const menu = req.body?.menu;
    const result = await updateBusinessMenu(req.user!.id, req.params.businessId, menu);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Update business menu error');
  }
});

router.get('/my-purchases', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const items = await getUserBusinessPurchases(req.user!.id);
    res.json({ items });
  } catch (error) {
    handleRouteError(error, res, 'Get business purchases error');
  }
});

router.post('/businesses/:businessId/set-transfer-fee-rate', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const rate = Number(req.body?.rate);
    const result = await setTransferFeeRate(req.user!.id, req.params.businessId, rate);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Set transfer fee rate error');
  }
});

router.post('/businesses/:businessId/upgrades/livret-epargne', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await buyLivretEpargneUpgrade(req.user!.id, req.params.businessId);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Buy livret epargne error');
  }
});

router.post('/businesses/:businessId/upgrades/illegal/:upgradeKey', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await buyIllegalBusinessUpgrade(req.user!.id, req.params.businessId, String(req.params.upgradeKey ?? ''));
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Buy illegal business upgrade error');
  }
});

router.delete('/businesses/:businessId', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await deleteBusiness(req.user!.id, req.params.businessId);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Delete business error');
  }
});

// Business transaction log
router.get('/businesses/:businessId/transactions', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await getBusinessTransactions(req.user!.id, req.params.businessId);
    res.json({ transactions });
  } catch (error) {
    handleRouteError(error, res, 'Get business transactions error');
  }
});

router.get('/businesses/:businessId/loans-history', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const loans = await getBusinessLoansHistory(req.user!.id, req.params.businessId);
    res.json({ loans });
  } catch (error) {
    handleRouteError(error, res, 'Get business loans history error');
  }
});

// Bank accounts
router.get('/businesses/:businessId/bank-accounts', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const accounts = await getBankAccounts(req.user!.id, req.params.businessId);
    res.json({ accounts });
  } catch (error) {
    handleRouteError(error, res, 'Get bank accounts error');
  }
});

router.post('/businesses/:businessId/bank-accounts', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const accountType = req.body?.accountType === 'EPARGNE' ? 'EPARGNE' : 'COURANT';
    const account = await openBankAccount(req.user!.id, req.params.businessId, accountType);
    res.json({ account });
  } catch (error) {
    handleRouteError(error, res, 'Open bank account error');
  }
});

router.post('/bank-accounts/:accountId/deposit', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await bankAccountDeposit(req.user!.id, req.params.accountId, Number(req.body?.amount));
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Bank account deposit error');
  }
});

router.post('/bank-accounts/:accountId/withdraw', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await bankAccountWithdraw(req.user!.id, req.params.accountId, Number(req.body?.amount));
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Bank account withdraw error');
  }
});

// Formation
router.patch('/businesses/:businessId/formation', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await setFormationDetails(req.user!.id, req.params.businessId, req.body?.formationUrl ?? null, Number(req.body?.formationPrice ?? 500));
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Set formation details error');
  }
});

router.post('/businesses/:businessId/buy-formation', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await buyFormation(req.user!.id, req.params.businessId);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Buy formation error');
  }
});

// Business profile update (name, description, logo)
router.patch('/businesses/:businessId/profile', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, logoUrl, mapX, mapY } = req.body;
    const result = await updateBusinessProfile(req.user!.id, req.params.businessId, { name, description, logoUrl, mapX, mapY });
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Update business profile error');
  }
});

// Formation Products (multi-formation)
router.get('/businesses/:businessId/formations', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const products = await listFormationProducts(req.params.businessId);
    res.json({ result: { products } });
  } catch (error) {
    handleRouteError(error, res, 'List formation products error');
  }
});

router.post('/businesses/:businessId/formations', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, price, url, imageUrl, attachment } = req.body;
    const product = await addFormationProduct(req.user!.id, req.params.businessId, {
      title,
      description,
      price: Number(price),
      url,
      imageUrl,
      attachment: attachment && typeof attachment === 'object'
        ? {
            base64Data: typeof attachment.base64Data === 'string' ? attachment.base64Data : null,
            mimeType: typeof attachment.mimeType === 'string' ? attachment.mimeType : null,
            fileName: typeof attachment.fileName === 'string' ? attachment.fileName : null,
          }
        : null,
    });
    res.json({ result: { product } });
  } catch (error) {
    handleRouteError(error, res, 'Add formation product error');
  }
});

router.patch('/businesses/:businessId/formations/:productId', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, price, url, imageUrl, attachment, removeAttachment } = req.body;
    const product = await updateFormationProduct(req.user!.id, req.params.businessId, req.params.productId, {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(price !== undefined ? { price: Number(price) } : {}),
      ...(url !== undefined ? { url } : {}),
      ...(imageUrl !== undefined ? { imageUrl } : {}),
      ...(attachment && typeof attachment === 'object'
        ? {
            attachment: {
              base64Data: typeof attachment.base64Data === 'string' ? attachment.base64Data : null,
              mimeType: typeof attachment.mimeType === 'string' ? attachment.mimeType : null,
              fileName: typeof attachment.fileName === 'string' ? attachment.fileName : null,
            },
          }
        : {}),
      ...(removeAttachment !== undefined ? { removeAttachment: Boolean(removeAttachment) } : {}),
    });
    res.json({ result: { product } });
  } catch (error) {
    handleRouteError(error, res, 'Update formation product error');
  }
});

router.delete('/businesses/:businessId/formations/:productId', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await deleteFormationProduct(req.user!.id, req.params.businessId, req.params.productId);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Delete formation product error');
  }
});

router.post('/businesses/:businessId/formations/:productId/review', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.isAdmin && !req.user?.isSuperAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const decision = req.body?.decision === 'approve' ? 'approve' : 'reject';
    const reviewerNote = typeof req.body?.reviewerNote === 'string' ? req.body.reviewerNote : undefined;
    const result = await reviewFormationProduct(req.user.id, req.params.businessId, req.params.productId, decision, reviewerNote);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Review formation product error');
  }
});

router.post('/businesses/:businessId/formations/:productId/buy', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await buyFormationProduct(req.user!.id, req.params.businessId, req.params.productId);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Buy formation product error');
  }
});

router.post('/businesses/:businessId/formations/:productId/access', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await accessFormationProduct(req.user!.id, req.params.businessId, req.params.productId);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Access formation product error');
  }
});

router.get('/businesses/:businessId/formations/:productId/download', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await accessFormationProduct(req.user!.id, req.params.businessId, req.params.productId);

    if (result.url && !result.hasAttachment) {
      return res.redirect(result.url);
    }

    if (!result.attachmentPath) {
      return res.status(404).json({ error: ERROR_MESSAGE.FORMATION_PRODUCT_NOT_FOUND, code: 'FORMATION_PRODUCT_NOT_FOUND' });
    }

    const uploadsRoot = path.resolve('uploads');
    const absolutePath = path.resolve(result.attachmentPath);
    if (!absolutePath.startsWith(uploadsRoot)) {
      return res.status(404).json({ error: ERROR_MESSAGE.FORMATION_PRODUCT_NOT_FOUND, code: 'FORMATION_PRODUCT_NOT_FOUND' });
    }

    const mimeType = result.attachmentMimeType || 'application/octet-stream';
    const fileName = result.attachmentOriginalName || `${result.title}.bin`;
    const disposition = mimeType === 'application/pdf' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(fileName)}"`);
    return res.sendFile(absolutePath);
  } catch (error) {
    handleRouteError(error, res, 'Download formation product error');
  }
});

router.post('/businesses/:businessId/formations/:productId/rate', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const rating = Number(req.body?.rating);
    const comment = typeof req.body?.comment === 'string' ? req.body.comment : null;
    await rateFormationProduct(req.user!.id, req.params.businessId, req.params.productId, rating, comment);
    res.json({ ok: true });
  } catch (error) {
    handleRouteError(error, res, 'Rate formation product error');
  }
});

router.get('/admin/formations/pending', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.isAdmin && !req.user?.isSuperAdmin) {
      return res.status(403).json({ error: ERROR_MESSAGE.YOU_ADMIN_ONLY, code: 'YOU_ADMIN_ONLY' });
    }
    const products = await listPendingFormationProductsForAdmin();
    res.json({ products });
  } catch (error) {
    handleRouteError(error, res, 'List pending formation products error');
  }
});

router.post('/review-prompts/seen', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await markReviewPromptShown(req.user!.id, {
      businessId: typeof req.body?.businessId === 'string' ? req.body.businessId : undefined,
      productId: typeof req.body?.productId === 'string' ? req.body.productId : undefined,
    });
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Mark review prompt shown error');
  }
});

router.patch('/businesses/:businessId/support-agent', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await setBusinessSupportAgent(
      req.user!.id,
      req.params.businessId,
      typeof req.body?.supportAgentId === 'string' ? req.body.supportAgentId : null,
    );
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Set business support agent error');
  }
});

router.post('/businesses/:businessId/support/conversation', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await openBusinessSupportConversation(req.user!.id, req.params.businessId);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Open business support conversation error');
  }
});

router.patch('/businesses/:businessId/members/:memberId/lawyer-profile', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await updateLawFirmMemberMetadata(req.user!.id, req.params.businessId, req.params.memberId, {
      specialty: typeof req.body?.specialty === 'string' ? req.body.specialty : null,
      ...(req.body?.isPrimaryLawyer !== undefined ? { isPrimaryLawyer: Boolean(req.body.isPrimaryLawyer) } : {}),
      ...(req.body?.displayOrder !== undefined ? { displayOrder: Number(req.body.displayOrder) } : {}),
      ...(typeof req.body?.role === 'string' ? { role: req.body.role } : {}),
    });
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Update law firm member metadata error');
  }
});

router.post('/court-cases/:caseId/lawyers/:lawyerUserId/rate', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const rating = Number(req.body?.rating);
    const comment = typeof req.body?.comment === 'string' ? req.body.comment : null;
    await rateLawyerForCase(req.user!.id, req.params.caseId, req.params.lawyerUserId, rating, comment);
    res.json({ ok: true });
  } catch (error) {
    handleRouteError(error, res, 'Rate lawyer for case error');
  }
});

// Team management
router.patch('/businesses/:businessId/members/:memberId/salary', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await updateMemberSalary(req.user!.id, req.params.businessId, req.params.memberId, Number(req.body?.salary));
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Update member salary error');
  }
});

router.patch('/businesses/:businessId/members/:memberId/profile', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await updateMemberProfile(req.user!.id, req.params.businessId, req.params.memberId, {
      title: typeof req.body?.title === 'string' ? req.body.title : null,
    });
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Update member profile error');
  }
});

router.delete('/businesses/:businessId/members/:memberId', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await sackMember(req.user!.id, req.params.businessId, req.params.memberId);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Sack member error');
  }
});

// Loan repayment — bank owner claims collateral after default
router.post('/loans/:loanId/repay', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const result = await repayLoan(req.user!.id, req.params.loanId);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Loan repay error');
  }
});

// Borrower repays their own loan voluntarily (at any time)
router.post('/loans/:loanId/borrower-repay', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const percentage = Number(req.body?.percentage ?? 100);
    if (!Number.isFinite(percentage) || percentage < 1 || percentage > 100) {
      res.status(400).json({ error: 'INVALID_PERCENTAGE' });
      return;
    }
    const result = await repayLoanByBorrower(req.user!.id, req.params.loanId, percentage);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Borrower loan repay error');
  }
});

// Business rating
router.post('/businesses/:businessId/rate', authMiddleware, requireYouAccess, async (req: AuthRequest, res: Response) => {
  try {
    const rating = Number(req.body?.rating);
    const comment = typeof req.body?.comment === 'string' ? req.body.comment : null;
    await rateBusiness(req.user!.id, req.params.businessId, rating, comment);
    res.json({ ok: true });
  } catch (error) {
    handleRouteError(error, res, 'Rate business error');
  }
});

export default router;
