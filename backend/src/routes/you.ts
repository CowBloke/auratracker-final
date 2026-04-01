import { Router, type Response } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import {
  createBusiness,
  createRelationship,
  executeBusinessAction,
  getYouState,
  proposeMarriage,
  respondToBusinessLoan,
  respondToMarriageProposal,
} from '../modules/you/service.js';
import type { BusinessActionKey } from '../modules/you/config.js';

const router = Router();

const ERROR_STATUS: Record<string, number> = {
  INVALID_BUSINESS_TYPE: 400,
  INVALID_BUSINESS_NAME: 400,
  BUSINESS_CAPITAL_TOO_LOW: 400,
  INSUFFICIENT_MONEY: 400,
  INSUFFICIENT_SHARED_MONEY: 400,
  USER_NOT_FOUND: 404,
  BUSINESS_NOT_FOUND: 404,
  BUSINESS_ACTION_UNAVAILABLE: 400,
  BUSINESS_INVITE_FORBIDDEN: 403,
  INVITEE_REQUIRED: 400,
  NO_NEW_INVITATIONS: 400,
  BUSINESS_LOAN_SELF_FORBIDDEN: 400,
  INVALID_LOAN_AMOUNT: 400,
  INVALID_LOAN_DURATION: 400,
  BUSINESS_DEPOSIT_FORBIDDEN: 403,
  INVALID_DEPOSIT_AMOUNT: 400,
  BUSINESS_WITHDRAW_FORBIDDEN: 403,
  INVALID_WITHDRAW_AMOUNT: 400,
  BUSINESS_TREASURY_TOO_LOW: 400,
  BUSINESS_LOAN_NOT_FOUND: 404,
  BUSINESS_LOAN_REVIEW_FORBIDDEN: 403,
  BUSINESS_LOAN_ALREADY_DECIDED: 400,
  BUSINESS_INVEST_SELF_FORBIDDEN: 400,
  INVALID_INVEST_AMOUNT: 400,
  RELATIONSHIP_SELF_FORBIDDEN: 400,
  TARGET_NOT_FOUND: 404,
  RELATIONSHIP_ALREADY_EXISTS: 400,
  RELATIONSHIP_NOT_FOUND: 404,
  RELATIONSHIP_FORBIDDEN: 403,
  RELATIONSHIP_ALREADY_MARRIED: 400,
  RELATIONSHIP_LEVEL_TOO_LOW: 400,
  MARRIAGE_PROPOSAL_ALREADY_PENDING: 400,
  MARRIAGE_PROPOSAL_NOT_FOUND: 404,
  MARRIAGE_PROPOSAL_FORBIDDEN: 403,
  MARRIAGE_PROPOSAL_ALREADY_RESOLVED: 400,
};

const ERROR_MESSAGE: Record<string, string> = {
  INVALID_BUSINESS_TYPE: 'Type de business invalide.',
  INVALID_BUSINESS_NAME: 'Le nom du business est trop court.',
  BUSINESS_CAPITAL_TOO_LOW: 'Le capital de depart est trop faible pour ce type de business.',
  INSUFFICIENT_MONEY: 'Tu n as pas assez de money pour cette action.',
  INSUFFICIENT_SHARED_MONEY: 'Ton foyer n a pas assez de money pour cette action.',
  USER_NOT_FOUND: 'Utilisateur introuvable.',
  BUSINESS_NOT_FOUND: 'Business introuvable.',
  BUSINESS_ACTION_UNAVAILABLE: 'Cette action n est pas disponible pour ce business.',
  BUSINESS_INVITE_FORBIDDEN: 'Seul le proprietaire peut inviter des joueurs.',
  INVITEE_REQUIRED: 'Choisis au moins un joueur a inviter.',
  NO_NEW_INVITATIONS: 'Aucune nouvelle invitation a envoyer.',
  BUSINESS_LOAN_SELF_FORBIDDEN: 'Tu ne peux pas emprunter a ton propre business.',
  INVALID_LOAN_AMOUNT: 'Montant d emprunt invalide.',
  INVALID_LOAN_DURATION: 'Duree d emprunt invalide.',
  BUSINESS_DEPOSIT_FORBIDDEN: 'Seul le proprietaire peut deposer du money dans ce business.',
  INVALID_DEPOSIT_AMOUNT: 'Montant de depot invalide.',
  BUSINESS_WITHDRAW_FORBIDDEN: 'Seul le proprietaire peut retirer du money de ce business.',
  INVALID_WITHDRAW_AMOUNT: 'Montant de retrait invalide.',
  BUSINESS_TREASURY_TOO_LOW: 'La tresorerie du business est insuffisante.',
  BUSINESS_LOAN_NOT_FOUND: 'Demande de pret introuvable.',
  BUSINESS_LOAN_REVIEW_FORBIDDEN: 'Tu ne peux pas traiter cette demande de pret.',
  BUSINESS_LOAN_ALREADY_DECIDED: 'Cette demande de pret a deja ete traitee.',
  BUSINESS_INVEST_SELF_FORBIDDEN: 'Tu ne peux pas investir dans ton propre business via cette action.',
  INVALID_INVEST_AMOUNT: 'Montant d investissement invalide.',
  RELATIONSHIP_SELF_FORBIDDEN: 'Tu ne peux pas creer une relation avec toi-meme.',
  TARGET_NOT_FOUND: 'Le joueur cible est introuvable.',
  RELATIONSHIP_ALREADY_EXISTS: 'Cette relation existe deja.',
  RELATIONSHIP_NOT_FOUND: 'Relation introuvable.',
  RELATIONSHIP_FORBIDDEN: 'Action non autorisee sur cette relation.',
  RELATIONSHIP_ALREADY_MARRIED: 'Cette relation est deja marquee comme mariee.',
  RELATIONSHIP_LEVEL_TOO_LOW: 'Le niveau de relation doit etre au moins de 70 pour un mariage.',
  MARRIAGE_PROPOSAL_ALREADY_PENDING: 'Une demande en mariage est deja en attente.',
  MARRIAGE_PROPOSAL_NOT_FOUND: 'Demande en mariage introuvable.',
  MARRIAGE_PROPOSAL_FORBIDDEN: 'Tu ne peux pas repondre a cette demande.',
  MARRIAGE_PROPOSAL_ALREADY_RESOLVED: 'Cette demande a deja ete traitee.',
};

function handleRouteError(error: unknown, res: Response, logLabel: string) {
  const code = error instanceof Error ? error.message : 'UNKNOWN';
  const status = ERROR_STATUS[code] ?? 500;
  const message = ERROR_MESSAGE[code] ?? 'Erreur interne.';

  if (status >= 500) {
    console.error(`${logLabel}:`, error);
  }

  res.status(status).json({ error: message, code });
}

router.get('/state', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const state = await getYouState(req.user!.id);
    res.json(state);
  } catch (error) {
    handleRouteError(error, res, 'Get YOU state error');
  }
});

router.post('/businesses', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const business = await createBusiness(req.user!.id, {
      name: String(req.body?.name ?? ''),
      typeKey: String(req.body?.typeKey ?? ''),
      capital: Number(req.body?.capital ?? 0),
      description: typeof req.body?.description === 'string' ? req.body.description : undefined,
      location: typeof req.body?.location === 'string' ? req.body.location : undefined,
    });

    res.status(201).json({ business });
  } catch (error) {
    handleRouteError(error, res, 'Create business error');
  }
});

router.post('/businesses/:businessId/actions/:actionKey', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const actionKey = req.params.actionKey as BusinessActionKey;
    const result = await executeBusinessAction(req.user!.id, req.params.businessId, actionKey, req.body ?? {});
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Run business action error');
  }
});

router.post('/loans/:loanId/respond', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const decision = req.body?.decision === 'accept' ? 'accept' : 'reject';
    const result = await respondToBusinessLoan(req.user!.id, req.params.loanId, decision);
    res.json({ result });
  } catch (error) {
    handleRouteError(error, res, 'Respond business loan error');
  }
});

router.post('/relationships', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const relationship = await createRelationship(req.user!.id, String(req.body?.targetUserId ?? ''));
    res.status(201).json({ relationship });
  } catch (error) {
    handleRouteError(error, res, 'Create relationship error');
  }
});

router.post('/relationships/:relationshipId/actions/propose-marriage', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const proposal = await proposeMarriage(req.user!.id, req.params.relationshipId, typeof req.body?.message === 'string' ? req.body.message : undefined);
    res.status(201).json({ proposal });
  } catch (error) {
    handleRouteError(error, res, 'Propose marriage error');
  }
});

router.post('/marriage-proposals/:proposalId/respond', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const decision = req.body?.decision === 'accept' ? 'accept' : 'reject';
    const result = await respondToMarriageProposal(req.user!.id, req.params.proposalId, decision);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, 'Respond marriage proposal error');
  }
});

export default router;
