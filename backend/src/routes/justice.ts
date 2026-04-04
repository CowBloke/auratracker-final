import { Router, Response } from 'express';
import { io, prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

const USER_PREVIEW_SELECT = {
  id: true,
  username: true,
  profilePicture: true,
  usernameColor: true,
} as const;

function requireUser(req: AuthRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return req.user;
}

function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (!req.user?.isAdmin && !req.user?.isSuperAdmin) {
    res.status(403).json({ error: 'Admin requis.' });
    return false;
  }
  return true;
}

function generateCaseNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `AFFAIRE-${year}-${rand}`;
}

async function emitConversationToParticipants(conversationId: string, event: string, payload: Record<string, unknown>) {
  const participants = await prisma.messageConversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  participants.forEach((p) => {
    io.to(`user:${p.userId}`).emit(event, payload);
  });
}

function serializePlainte(p: any) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    evidence: p.evidence ?? null,
    status: p.status,
    rejectionReason: p.rejectionReason ?? null,
    courtId: p.courtId,
    plaintifId: p.plaintifId,
    defendantId: p.defendantId ?? null,
    plaintif: p.plaintif ? { id: p.plaintif.id, username: p.plaintif.username, profilePicture: p.plaintif.profilePicture, usernameColor: p.plaintif.usernameColor } : null,
    defendant: p.defendant ? { id: p.defendant.id, username: p.defendant.username, profilePicture: p.defendant.profilePicture, usernameColor: p.defendant.usernameColor } : null,
    courtCase: p.courtCase ? { id: p.courtCase.id, caseNumber: p.courtCase.caseNumber, conversationId: p.courtCase.conversationId } : null,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
  };
}

function serializeCourtCase(c: any) {
  return {
    id: c.id,
    caseNumber: c.caseNumber,
    conversationId: c.conversationId,
    plaintifId: c.plaintifId,
    defendantId: c.defendantId,
    status: c.status,
    verdict: c.verdict ?? null,
    verdictAt: c.verdictAt ? (c.verdictAt instanceof Date ? c.verdictAt.toISOString() : c.verdictAt) : null,
    sentencing: c.sentencing ?? null,
    plaintif: c.plaintif ? { id: c.plaintif.id, username: c.plaintif.username, profilePicture: c.plaintif.profilePicture, usernameColor: c.plaintif.usernameColor } : null,
    defendant: c.defendant ? { id: c.defendant.id, username: c.defendant.username, profilePicture: c.defendant.profilePicture, usernameColor: c.defendant.usernameColor } : null,
    parties: c.parties?.map((party: any) => ({
      id: party.id,
      userId: party.userId,
      courtRole: party.courtRole,
      user: party.user ? { id: party.user.id, username: party.user.username, profilePicture: party.user.profilePicture, usernameColor: party.user.usernameColor } : null,
    })) ?? [],
    plainte: c.plainte ? { id: c.plainte.id, title: c.plainte.title } : null,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
  };
}

// ─── FILE A PLAINTE ────────────────────────────────────────────────────────────
router.post('/plaintes', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const courtId = typeof req.body?.courtId === 'string' ? req.body.courtId.trim() : '';
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const evidence = typeof req.body?.evidence === 'string' ? req.body.evidence.trim() : null;
    const defendantId = typeof req.body?.defendantId === 'string' ? req.body.defendantId.trim() : null;

    if (!courtId || !title || !description) {
      return res.status(400).json({ error: 'courtId, title et description sont requis.' });
    }
    if (title.length < 5 || title.length > 100) {
      return res.status(400).json({ error: 'Le titre doit contenir entre 5 et 100 caractères.' });
    }
    if (description.length < 20 || description.length > 2000) {
      return res.status(400).json({ error: 'La description doit contenir entre 20 et 2000 caractères.' });
    }

    // Verify court business exists and is a supreme_court
    const court = await prisma.business.findUnique({ where: { id: courtId } });
    if (!court || court.typeKey !== 'supreme_court') {
      return res.status(404).json({ error: 'Cour suprême introuvable.' });
    }

    // Verify defendant exists if provided
    if (defendantId) {
      if (defendantId === user.id) {
        return res.status(400).json({ error: 'Tu ne peux pas te porter plainte contre toi-même.' });
      }
      const defendant = await prisma.user.findUnique({ where: { id: defendantId }, select: { id: true } });
      if (!defendant) {
        return res.status(404).json({ error: 'Joueur défendeur introuvable.' });
      }
    }

    const plainte = await prisma.plainte.create({
      data: {
        plaintifId: user.id,
        defendantId: defendantId || null,
        courtId,
        title,
        description,
        evidence: evidence || null,
      },
      include: {
        plaintif: { select: USER_PREVIEW_SELECT },
        defendant: { select: USER_PREVIEW_SELECT },
        courtCase: true,
      },
    });

    // Notify all admins
    const admins = await prisma.user.findMany({ where: { OR: [{ isAdmin: true }, { isSuperAdmin: true }] }, select: { id: true } });
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          type: 'SYSTEM',
          title: 'Nouvelle plainte',
          body: `${user.username} a déposé une plainte : "${title}"`,
          data: { plainteId: plainte.id, courtId },
          link: `/you?tab=travail`,
          icon: 'scale',
        }).catch(() => {})
      )
    );

    res.status(201).json({ plainte: serializePlainte(plainte) });
  } catch (error) {
    console.error('File plainte error:', error);
    res.status(500).json({ error: 'Erreur lors du dépôt de plainte.' });
  }
});

// ─── LIST PLAINTES (for a court business) ─────────────────────────────────────
router.get('/plaintes', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const courtId = typeof req.query?.courtId === 'string' ? req.query.courtId : null;
    const isAdmin = user.isAdmin || user.isSuperAdmin;

    let whereClause: any = {};

    if (courtId) {
      // Verify court ownership for non-admins
      if (!isAdmin) {
        const court = await prisma.business.findUnique({ where: { id: courtId }, select: { ownerId: true } });
        if (!court || court.ownerId !== user.id) {
          return res.status(403).json({ error: 'Accès refusé.' });
        }
      }
      whereClause.courtId = courtId;
    } else if (isAdmin) {
      // Admins can see all
    } else {
      // Regular users see their own
      whereClause.OR = [{ plaintifId: user.id }, { defendantId: user.id }];
    }

    const plaintes = await prisma.plainte.findMany({
      where: whereClause,
      include: {
        plaintif: { select: USER_PREVIEW_SELECT },
        defendant: { select: USER_PREVIEW_SELECT },
        courtCase: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ plaintes: plaintes.map(serializePlainte) });
  } catch (error) {
    console.error('List plaintes error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des plaintes.' });
  }
});

// ─── ACCEPT PLAINTE → CREATE COURT CASE ───────────────────────────────────────
router.patch('/plaintes/:id/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireAdmin(req, res)) return;

    const plainte = await prisma.plainte.findUnique({
      where: { id: req.params.id },
      include: {
        plaintif: { select: USER_PREVIEW_SELECT },
        defendant: { select: USER_PREVIEW_SELECT },
      },
    });
    if (!plainte) return res.status(404).json({ error: 'Plainte introuvable.' });
    if (plainte.status !== 'PENDING') return res.status(400).json({ error: 'Cette plainte a déjà été traitée.' });
    if (!plainte.defendantId) return res.status(400).json({ error: 'Une plainte doit avoir un défendeur pour être acceptée.' });

    // Get all admins to add as judges
    const admins = await prisma.user.findMany({
      where: { OR: [{ isAdmin: true }, { isSuperAdmin: true }] },
      select: USER_PREVIEW_SELECT,
    });

    const caseNumber = generateCaseNumber();

    // Create conversation + court case in a transaction
    const { courtCase } = await prisma.$transaction(async (tx) => {
      // Create the court group conversation
      const conversation = await tx.messageConversation.create({
        data: {
          type: 'GROUP',
          title: `⚖️ ${caseNumber}`,
          icon: '⚖️',
          createdById: user.id,
          // courtCaseId will be set after case creation via update
        },
      });

      // Create court case
      const courtCase = await tx.courtCase.create({
        data: {
          caseNumber,
          plainteId: plainte.id,
          conversationId: conversation.id,
          plaintifId: plainte.plaintifId,
          defendantId: plainte.defendantId!,
        },
      });

      // Link conversation to court case
      await tx.messageConversation.update({
        where: { id: conversation.id },
        data: { courtCaseId: courtCase.id },
      });

      // Mark plainte as accepted
      await tx.plainte.update({
        where: { id: plainte.id },
        data: { status: 'ACCEPTED' },
      });

      // Add all admins as judges
      const adminParticipants = admins.map((admin) => ({
        conversationId: conversation.id,
        userId: admin.id,
        role: 'OWNER',
        courtRole: 'JUDGE',
      }));

      // Add plaintiff
      const plaintiffParticipant = {
        conversationId: conversation.id,
        userId: plainte.plaintifId,
        role: 'MEMBER',
        courtRole: 'PLAINTIFF',
      };

      // Add defendant
      const defendantParticipant = {
        conversationId: conversation.id,
        userId: plainte.defendantId!,
        role: 'MEMBER',
        courtRole: 'DEFENDANT',
      };

      const allParticipants = Array.from(
        new Map(
          [...adminParticipants, plaintiffParticipant, defendantParticipant].map((participant) => [
            `${participant.conversationId}:${participant.userId}`,
            participant,
          ])
        ).values()
      );
      await tx.messageConversationParticipant.createMany({ data: allParticipants });

      // Add court parties
      const courtParties = Array.from(
        new Map(
          [
            ...admins.map((admin) => ({ caseId: courtCase.id, userId: admin.id, courtRole: 'JUDGE' })),
            { caseId: courtCase.id, userId: plainte.plaintifId, courtRole: 'PLAINTIFF' },
            { caseId: courtCase.id, userId: plainte.defendantId!, courtRole: 'DEFENDANT' },
          ].map((party) => [`${party.caseId}:${party.userId}`, party])
        ).values()
      );
      await tx.courtParty.createMany({ data: courtParties });

      // System message
      await tx.messageConversationMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: null,
          body: `⚖️ L'affaire ${caseNumber} est ouverte. Plainte déposée par ${plainte.plaintif?.username ?? 'Plaignant'} contre ${plainte.defendant?.username ?? 'Défendeur'}. Les deux parties peuvent exposer leurs arguments. Des avocats peuvent être désignés.`,
          type: 'COURT_SYSTEM',
        },
      });

      await tx.messageConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      return { courtCase, conversation };
    });

    const fullCase = await prisma.courtCase.findUnique({
      where: { id: courtCase.id },
      include: {
        plaintif: { select: USER_PREVIEW_SELECT },
        defendant: { select: USER_PREVIEW_SELECT },
        parties: { include: { user: { select: USER_PREVIEW_SELECT } } },
        plainte: true,
      },
    });

    // Notify participants
    const notifyIds = [plainte.plaintifId, plainte.defendantId!, ...admins.map((a) => a.id)];
    await Promise.all(
      [...new Set(notifyIds)].map((uid) =>
        createNotification({
          userId: uid,
          type: 'SYSTEM',
          title: '⚖️ Affaire judiciaire ouverte',
          body: `L'affaire ${caseNumber} a été ouverte. Rendez-vous dans vos messages.`,
          data: { courtCaseId: courtCase.id, conversationId: courtCase.conversationId },
          link: `/messages?conversation=${courtCase.conversationId}`,
          icon: 'scale',
        }).catch(() => {})
      )
    );

    // Emit to all participants
    await emitConversationToParticipants(courtCase.conversationId, 'messaging:conversation', { conversationId: courtCase.conversationId });

    res.json({ courtCase: serializeCourtCase(fullCase) });
  } catch (error) {
    console.error('Accept plainte error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'acceptation de la plainte.' });
  }
});

// ─── REJECT PLAINTE ────────────────────────────────────────────────────────────
router.patch('/plaintes/:id/reject', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireAdmin(req, res)) return;

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

    const plainte = await prisma.plainte.findUnique({ where: { id: req.params.id } });
    if (!plainte) return res.status(404).json({ error: 'Plainte introuvable.' });
    if (plainte.status !== 'PENDING') return res.status(400).json({ error: 'Cette plainte a déjà été traitée.' });

    const updated = await prisma.plainte.update({
      where: { id: plainte.id },
      data: { status: 'REJECTED', rejectionReason: reason || null },
      include: {
        plaintif: { select: USER_PREVIEW_SELECT },
        defendant: { select: USER_PREVIEW_SELECT },
        courtCase: true,
      },
    });

    await createNotification({
      userId: plainte.plaintifId,
      type: 'SYSTEM',
      title: 'Plainte rejetée',
      body: reason ? `Votre plainte "${plainte.title}" a été rejetée : ${reason}` : `Votre plainte "${plainte.title}" a été rejetée.`,
      data: { plainteId: plainte.id },
      link: `/you?tab=travail`,
      icon: 'x-circle',
    }).catch(() => {});

    res.json({ plainte: serializePlainte(updated) });
  } catch (error) {
    console.error('Reject plainte error:', error);
    res.status(500).json({ error: 'Erreur lors du rejet de la plainte.' });
  }
});

// ─── LIST COURT CASES (current user's cases) ─────────────────────────────────
router.get('/cases', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const isAdmin = user.isAdmin || user.isSuperAdmin;

    const cases = await prisma.courtCase.findMany({
      where: isAdmin
        ? {}
        : {
            OR: [
              { plaintifId: user.id },
              { defendantId: user.id },
              { parties: { some: { userId: user.id } } },
            ],
          },
      include: {
        plaintif: { select: USER_PREVIEW_SELECT },
        defendant: { select: USER_PREVIEW_SELECT },
        parties: { include: { user: { select: USER_PREVIEW_SELECT } } },
        plainte: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ cases: cases.map(serializeCourtCase) });
  } catch (error) {
    console.error('List cases error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des affaires.' });
  }
});

// ─── GET COURT CASE ────────────────────────────────────────────────────────────
router.get('/cases/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const courtCase = await prisma.courtCase.findUnique({
      where: { id: req.params.id },
      include: {
        plaintif: { select: USER_PREVIEW_SELECT },
        defendant: { select: USER_PREVIEW_SELECT },
        parties: { include: { user: { select: USER_PREVIEW_SELECT } } },
        plainte: true,
      },
    });

    if (!courtCase) return res.status(404).json({ error: 'Affaire introuvable.' });

    const isParticipant = courtCase.parties.some((p) => p.userId === user.id);
    const isAdmin = user.isAdmin || user.isSuperAdmin;
    if (!isParticipant && !isAdmin) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }

    res.json({ courtCase: serializeCourtCase(courtCase) });
  } catch (error) {
    console.error('Get case error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'affaire.' });
  }
});

// ─── CHOOSE REPRESENTATION ─────────────────────────────────────────────────────
// type: 'PRIVATE_LAWYER' (lawFirmId required) | 'PUBLIC_DEFENDER'
router.post('/cases/:id/representation', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const courtCase = await prisma.courtCase.findUnique({
      where: { id: req.params.id },
      include: { parties: true },
    });
    if (!courtCase) return res.status(404).json({ error: 'Affaire introuvable.' });

    const myParty = courtCase.parties.find((p) => p.userId === user.id);
    if (!myParty || (myParty.courtRole !== 'PLAINTIFF' && myParty.courtRole !== 'DEFENDANT')) {
      return res.status(403).json({ error: 'Tu n\'es pas une partie dans cette affaire.' });
    }

    if (courtCase.status !== 'OPEN') {
      return res.status(400).json({ error: 'L\'affaire n\'est plus ouverte.' });
    }

    const representationType = typeof req.body?.type === 'string' ? req.body.type : '';
    const lawFirmId = typeof req.body?.lawFirmId === 'string' ? req.body.lawFirmId : null;

    if (representationType === 'PRIVATE_LAWYER') {
      if (!lawFirmId) return res.status(400).json({ error: 'lawFirmId requis pour un avocat privé.' });

      // Verify law firm exists
      const lawFirm = await prisma.business.findUnique({ where: { id: lawFirmId } });
      if (!lawFirm || lawFirm.typeKey !== 'law_firm') {
        return res.status(404).json({ error: 'Cabinet d\'avocats introuvable.' });
      }

      const isPlaintiff = myParty.courtRole === 'PLAINTIFF';
      const lawyerRole = isPlaintiff ? 'LAWYER_PLAINTIFF' : 'LAWYER_DEFENDANT';

      // Add law firm owner as lawyer
      const lawyerUserId = lawFirm.ownerId;

      // Check if already has a lawyer
      const existingLawyer = courtCase.parties.find((p) => p.courtRole === lawyerRole);
      if (existingLawyer) {
        // Remove existing lawyer from conversation
        await prisma.messageConversationParticipant.deleteMany({
          where: { conversationId: courtCase.conversationId, userId: existingLawyer.userId },
        });
        await prisma.courtParty.delete({ where: { id: existingLawyer.id } });
      }

      await prisma.$transaction(async (tx) => {
        await tx.courtParty.create({
          data: { caseId: courtCase.id, userId: lawyerUserId, courtRole: lawyerRole },
        });
        await tx.messageConversationParticipant.upsert({
          where: { conversationId_userId: { conversationId: courtCase.conversationId, userId: lawyerUserId } },
          create: { conversationId: courtCase.conversationId, userId: lawyerUserId, role: 'MEMBER', courtRole: lawyerRole },
          update: { courtRole: lawyerRole },
        });
        // System message
        await tx.messageConversationMessage.create({
          data: {
            conversationId: courtCase.conversationId,
            senderId: null,
            body: `⚖️ ${user.username} a désigné ${isPlaintiff ? 'un avocat (plaignant)' : 'un avocat (défense)'} : le cabinet "${lawFirm.name}".`,
            type: 'COURT_SYSTEM',
          },
        });
        await tx.messageConversation.update({ where: { id: courtCase.conversationId }, data: { lastMessageAt: new Date() } });
      });

      await createNotification({
        userId: lawyerUserId,
        type: 'SYSTEM',
        title: '⚖️ Désigné comme avocat',
        body: `Votre cabinet a été désigné pour représenter ${user.username} dans l'affaire ${courtCase.caseNumber}.`,
        data: { courtCaseId: courtCase.id, conversationId: courtCase.conversationId },
        link: `/messages?conversation=${courtCase.conversationId}`,
        icon: 'briefcase',
      }).catch(() => {});

    } else if (representationType === 'PUBLIC_DEFENDER') {
      const isPlaintiff = myParty.courtRole === 'PLAINTIFF';
      const defenderRole = isPlaintiff ? 'PUBLIC_DEFENDER_PLAINTIFF' : 'PUBLIC_DEFENDER_DEFENDANT';

      // Add all admins as public defenders if they aren't already
      const admins = await prisma.user.findMany({
        where: { OR: [{ isAdmin: true }, { isSuperAdmin: true }] },
        select: USER_PREVIEW_SELECT,
      });

      await prisma.$transaction(async (tx) => {
        for (const admin of admins) {
          // Update existing judge party or create public defender role (admins can have multiple roles via conversation)
          await tx.messageConversationParticipant.upsert({
            where: { conversationId_userId: { conversationId: courtCase.conversationId, userId: admin.id } },
            create: { conversationId: courtCase.conversationId, userId: admin.id, role: 'OWNER', courtRole: defenderRole },
            update: {},
          });
        }
        // System message
        await tx.messageConversationMessage.create({
          data: {
            conversationId: courtCase.conversationId,
            senderId: null,
            body: `⚖️ ${user.username} a demandé un défenseur public ${isPlaintiff ? '(plaignant)' : '(défense)'}. Les juges peuvent intervenir dans ce rôle.`,
            type: 'COURT_SYSTEM',
          },
        });
        await tx.messageConversation.update({ where: { id: courtCase.conversationId }, data: { lastMessageAt: new Date() } });
      });
    } else {
      return res.status(400).json({ error: 'Type de représentation invalide. Utilisez PRIVATE_LAWYER ou PUBLIC_DEFENDER.' });
    }

    const updated = await prisma.courtCase.findUnique({
      where: { id: courtCase.id },
      include: {
        plaintif: { select: USER_PREVIEW_SELECT },
        defendant: { select: USER_PREVIEW_SELECT },
        parties: { include: { user: { select: USER_PREVIEW_SELECT } } },
        plainte: true,
      },
    });

    await emitConversationToParticipants(courtCase.conversationId, 'messaging:conversation', { conversationId: courtCase.conversationId });

    res.json({ courtCase: serializeCourtCase(updated) });
  } catch (error) {
    console.error('Choose representation error:', error);
    res.status(500).json({ error: 'Erreur lors de la sélection de la représentation.' });
  }
});

// ─── SUBMIT / UPDATE ARGUMENT ──────────────────────────────────────────────────
router.put('/cases/:id/argument', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!content || content.length < 10) {
      return res.status(400).json({ error: 'Le contenu de l\'argument doit contenir au moins 10 caractères.' });
    }
    if (content.length > 5000) {
      return res.status(400).json({ error: 'L\'argument ne peut pas dépasser 5000 caractères.' });
    }

    const courtCase = await prisma.courtCase.findUnique({
      where: { id: req.params.id },
      include: { parties: true },
    });
    if (!courtCase) return res.status(404).json({ error: 'Affaire introuvable.' });

    const myParty = courtCase.parties.find((p) => p.userId === user.id);
    if (!myParty) return res.status(403).json({ error: 'Tu ne participes pas à cette affaire.' });

    // Determine side: PLAINTIFF or DEFENDANT
    let side: string | null = null;
    if (myParty.courtRole === 'PLAINTIFF' || myParty.courtRole === 'LAWYER_PLAINTIFF' || myParty.courtRole === 'PUBLIC_DEFENDER_PLAINTIFF') {
      side = 'PLAINTIFF';
    } else if (myParty.courtRole === 'DEFENDANT' || myParty.courtRole === 'LAWYER_DEFENDANT' || myParty.courtRole === 'PUBLIC_DEFENDER_DEFENDANT') {
      side = 'DEFENDANT';
    }

    if (!side) return res.status(403).json({ error: 'Seules les parties peuvent soumettre un argument.' });

    if (courtCase.status === 'VERDICT_GIVEN' || courtCase.status === 'CLOSED') {
      return res.status(400).json({ error: 'L\'affaire est terminée.' });
    }

    const argument = await prisma.courtArgument.upsert({
      where: { caseId_side: { caseId: courtCase.id, side } },
      create: { caseId: courtCase.id, authorId: user.id, side, content },
      update: { content, authorId: user.id },
    });

    // Notify judges that an argument was submitted/updated
    const judgeParts = courtCase.parties.filter((p) => p.courtRole === 'JUDGE');
    await Promise.all(
      judgeParts.map((p) =>
        createNotification({
          userId: p.userId,
          type: 'SYSTEM',
          title: '⚖️ Argument soumis',
          body: `${user.username} a soumis/mis à jour son argument écrit dans l'affaire ${courtCase.caseNumber}.`,
          data: { courtCaseId: courtCase.id },
          link: `/messages?conversation=${courtCase.conversationId}`,
          icon: 'file-text',
        }).catch(() => {})
      )
    );

    res.json({
      argument: {
        id: argument.id,
        caseId: argument.caseId,
        side: argument.side,
        content: argument.content,
        authorId: argument.authorId,
        createdAt: argument.createdAt instanceof Date ? argument.createdAt.toISOString() : argument.createdAt,
        updatedAt: argument.updatedAt instanceof Date ? argument.updatedAt.toISOString() : argument.updatedAt,
      },
    });
  } catch (error) {
    console.error('Submit argument error:', error);
    res.status(500).json({ error: 'Erreur lors de la soumission de l\'argument.' });
  }
});

// ─── GET ARGUMENTS (judge sees both; parties see own) ─────────────────────────
router.get('/cases/:id/arguments', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const courtCase = await prisma.courtCase.findUnique({
      where: { id: req.params.id },
      include: { parties: true },
    });
    if (!courtCase) return res.status(404).json({ error: 'Affaire introuvable.' });

    const myParty = courtCase.parties.find((p) => p.userId === user.id);
    const isAdmin = user.isAdmin || user.isSuperAdmin;
    const isJudge = isAdmin || myParty?.courtRole === 'JUDGE';

    if (!myParty && !isAdmin) return res.status(403).json({ error: 'Accès refusé.' });

    const arguments_ = await prisma.courtArgument.findMany({
      where: { caseId: courtCase.id },
      include: { author: { select: USER_PREVIEW_SELECT } },
    });

    // Non-judges can only see their own side
    let visibleArgs = arguments_;
    if (!isJudge && myParty) {
      const mySide =
        myParty.courtRole === 'PLAINTIFF' || myParty.courtRole === 'LAWYER_PLAINTIFF' || myParty.courtRole === 'PUBLIC_DEFENDER_PLAINTIFF'
          ? 'PLAINTIFF'
          : 'DEFENDANT';
      visibleArgs = arguments_.filter((a) => a.side === mySide);
    }

    res.json({
      arguments: visibleArgs.map((a) => ({
        id: a.id,
        caseId: a.caseId,
        side: a.side,
        content: a.content,
        authorId: a.authorId,
        author: a.author,
        canSeeOpposite: isJudge,
        createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
        updatedAt: a.updatedAt instanceof Date ? a.updatedAt.toISOString() : a.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Get arguments error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des arguments.' });
  }
});

// ─── CHANGE CASE STATUS (judge only) ─────────────────────────────────────────
router.patch('/cases/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireAdmin(req, res)) return;

    const status = typeof req.body?.status === 'string' ? req.body.status : '';
    const allowed = ['OPEN', 'DELIBERATION', 'VERDICT_GIVEN', 'CLOSED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Statut invalide. Valeurs autorisées : ${allowed.join(', ')}` });
    }

    const courtCase = await prisma.courtCase.findUnique({ where: { id: req.params.id } });
    if (!courtCase) return res.status(404).json({ error: 'Affaire introuvable.' });

    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.courtCase.update({
        where: { id: courtCase.id },
        data: { status },
        include: {
          plaintif: { select: USER_PREVIEW_SELECT },
          defendant: { select: USER_PREVIEW_SELECT },
          parties: { include: { user: { select: USER_PREVIEW_SELECT } } },
          plainte: true,
        },
      });

      const statusLabels: Record<string, string> = {
        OPEN: '🟢 L\'affaire est rouverte.',
        DELIBERATION: '🔒 Le tribunal entre en délibération. Plus aucun argument ne sera accepté.',
        VERDICT_GIVEN: '⚖️ Le verdict a été rendu.',
        CLOSED: '🔐 L\'affaire est close.',
      };

      await tx.messageConversationMessage.create({
        data: {
          conversationId: courtCase.conversationId,
          senderId: null,
          body: statusLabels[status] ?? `Statut changé en ${status}.`,
          type: 'COURT_SYSTEM',
        },
      });
      await tx.messageConversation.update({ where: { id: courtCase.conversationId }, data: { lastMessageAt: new Date() } });

      return c;
    });

    await emitConversationToParticipants(courtCase.conversationId, 'messaging:message', { conversationId: courtCase.conversationId });

    res.json({ courtCase: serializeCourtCase(updated) });
  } catch (error) {
    console.error('Change status error:', error);
    res.status(500).json({ error: 'Erreur lors du changement de statut.' });
  }
});

// ─── DELIVER VERDICT (judge only) ─────────────────────────────────────────────
router.post('/cases/:id/verdict', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireAdmin(req, res)) return;

    const verdict = typeof req.body?.verdict === 'string' ? req.body.verdict.trim() : '';
    const sentencing = typeof req.body?.sentencing === 'string' ? req.body.sentencing.trim() : null;

    if (!verdict || verdict.length < 10) {
      return res.status(400).json({ error: 'Le verdict doit contenir au moins 10 caractères.' });
    }

    const courtCase = await prisma.courtCase.findUnique({
      where: { id: req.params.id },
      include: {
        plaintif: { select: USER_PREVIEW_SELECT },
        defendant: { select: USER_PREVIEW_SELECT },
        parties: { include: { user: { select: USER_PREVIEW_SELECT } } },
        plainte: true,
      },
    });
    if (!courtCase) return res.status(404).json({ error: 'Affaire introuvable.' });
    if (courtCase.status === 'CLOSED') return res.status(400).json({ error: 'L\'affaire est déjà close.' });

    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.courtCase.update({
        where: { id: courtCase.id },
        data: {
          verdict,
          sentencing: sentencing || null,
          verdictAt: new Date(),
          status: 'VERDICT_GIVEN',
        },
        include: {
          plaintif: { select: USER_PREVIEW_SELECT },
          defendant: { select: USER_PREVIEW_SELECT },
          parties: { include: { user: { select: USER_PREVIEW_SELECT } } },
          plainte: true,
        },
      });

      const verdictMessage = `⚖️ **VERDICT RENDU**\n\n${verdict}${sentencing ? `\n\n**Sanction :** ${sentencing}` : ''}`;
      await tx.messageConversationMessage.create({
        data: {
          conversationId: courtCase.conversationId,
          senderId: user.id,
          body: verdictMessage,
          type: 'COURT_SYSTEM',
          courtRole: 'JUDGE',
        },
      });
      await tx.messageConversation.update({ where: { id: courtCase.conversationId }, data: { lastMessageAt: new Date() } });

      return c;
    });

    // Notify all parties
    const partiesIds = [...new Set(courtCase.parties.map((p) => p.userId))];
    await Promise.all(
      partiesIds.map((uid) =>
        createNotification({
          userId: uid,
          type: 'SYSTEM',
          title: '⚖️ Verdict rendu',
          body: `Le verdict de l'affaire ${courtCase.caseNumber} a été rendu.`,
          data: { courtCaseId: courtCase.id, conversationId: courtCase.conversationId },
          link: `/messages?conversation=${courtCase.conversationId}`,
          icon: 'gavel',
        }).catch(() => {})
      )
    );

    await emitConversationToParticipants(courtCase.conversationId, 'messaging:message', { conversationId: courtCase.conversationId });

    res.json({ courtCase: serializeCourtCase(updated) });
  } catch (error) {
    console.error('Deliver verdict error:', error);
    res.status(500).json({ error: 'Erreur lors de la remise du verdict.' });
  }
});

// ─── GET LAW FIRMS ─────────────────────────────────────────────────────────────
router.get('/law-firms', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const lawFirms = await prisma.business.findMany({
      where: { typeKey: 'law_firm' },
      include: {
        owner: { select: USER_PREVIEW_SELECT },
        members: { include: { user: { select: USER_PREVIEW_SELECT } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      lawFirms: lawFirms.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        logoUrl: f.logoUrl,
        ownerId: f.ownerId,
        owner: f.owner,
        memberCount: f.members.length,
        satisfaction: f.satisfaction,
      })),
    });
  } catch (error) {
    console.error('Get law firms error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des cabinets.' });
  }
});

export default router;
