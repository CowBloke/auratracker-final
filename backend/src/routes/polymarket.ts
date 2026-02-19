import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logAdmin } from '../utils/logger.js';
import { isAllowedImageUrl } from '../utils/uploads.js';

const router = Router();

// Middleware to check if user is admin
const requireAdmin = (req: AuthRequest, res: Response, next: Function) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ========== SUGGESTIONS ==========

// Get all suggestions
router.get('/suggestions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const suggestions = await prisma.polymarketSuggestion.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            usernameColor: true,
          },
        },
        event: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ suggestions });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// Create a suggestion
router.post('/suggestions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, imageUrl, eventDate, suggestedYesOdds, suggestedNoOdds } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    if (title.length > 200) {
      return res.status(400).json({ error: 'Title must be less than 200 characters' });
    }

    if (description.length > 2000) {
      return res.status(400).json({ error: 'Description must be less than 2000 characters' });
    }

    let eventDateObj: Date | null = null;
    if (eventDate) {
      eventDateObj = new Date(eventDate);
      if (isNaN(eventDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid event date' });
      }

      if (eventDateObj <= new Date()) {
        return res.status(400).json({ error: 'Event date must be in the future' });
      }
    }

    const hasSuggestedYesOdds = suggestedYesOdds !== undefined && suggestedYesOdds !== null && suggestedYesOdds !== '';
    const hasSuggestedNoOdds = suggestedNoOdds !== undefined && suggestedNoOdds !== null && suggestedNoOdds !== '';
    if (hasSuggestedYesOdds !== hasSuggestedNoOdds) {
      return res.status(400).json({ error: 'Both suggested odds are required when proposing odds' });
    }
    if (hasSuggestedYesOdds && parseFloat(suggestedYesOdds) <= 1) {
      return res.status(400).json({ error: 'Suggested yes odds must be greater than 1' });
    }
    if (hasSuggestedNoOdds && parseFloat(suggestedNoOdds) <= 1) {
      return res.status(400).json({ error: 'Suggested no odds must be greater than 1' });
    }

    if (imageUrl && !isAllowedImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
    }

    const suggestion = await prisma.polymarketSuggestion.create({
      data: {
        userId: req.user!.id,
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl?.trim() || null,
        eventDate: eventDateObj,
        suggestedYesOdds: hasSuggestedYesOdds ? parseFloat(suggestedYesOdds) : null,
        suggestedNoOdds: hasSuggestedNoOdds ? parseFloat(suggestedNoOdds) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            usernameColor: true,
          },
        },
      },
    });

    res.status(201).json({ suggestion });
  } catch (error) {
    console.error('Create suggestion error:', error);
    res.status(500).json({ error: 'Failed to create suggestion' });
  }
});

// ========== EVENTS ==========

// Get all events
router.get('/events', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const events = await prisma.polymarketEvent.findMany({
      where,
      include: {
        suggestion: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                usernameColor: true,
              },
            },
          },
        },
        bets: {
          select: {
            userId: true,
            prediction: true,
            amount: true,
          },
        },
        _count: {
          select: {
            bets: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate total volume and yes/no totals
    const eventsWithStats = events.map((event) => {
      const yesBets = event.bets.filter((b) => b.prediction === 'YES');
      const noBets = event.bets.filter((b) => b.prediction === 'NO');
      const totalYes = yesBets.reduce((sum, b) => sum + b.amount, 0);
      const totalNo = noBets.reduce((sum, b) => sum + b.amount, 0);
      const totalVolume = totalYes + totalNo;

      return {
        ...event,
        totalVolume,
        totalYes,
        totalNo,
        betCount: event._count.bets,
      };
    });

    res.json({ events: eventsWithStats });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// Get single event
router.get('/events/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const event = await prisma.polymarketEvent.findUnique({
      where: { id },
      include: {
        suggestion: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                usernameColor: true,
              },
            },
          },
        },
        bets: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                usernameColor: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            bets: true,
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const yesBets = event.bets.filter((b) => b.prediction === 'YES');
    const noBets = event.bets.filter((b) => b.prediction === 'NO');
    const totalYes = yesBets.reduce((sum, b) => sum + b.amount, 0);
    const totalNo = noBets.reduce((sum, b) => sum + b.amount, 0);
    const totalVolume = totalYes + totalNo;

    res.json({
      event: {
        ...event,
        totalVolume,
        totalYes,
        totalNo,
        betCount: event._count.bets,
      },
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to get event' });
  }
});

// Create event (admin only)
router.post('/events', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, imageUrl, eventDate, yesOdds, noOdds, suggestionId } = req.body;

    if (!title || !description || !eventDate || !yesOdds || !noOdds) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (yesOdds <= 1 || noOdds <= 1) {
      return res.status(400).json({ error: 'Odds must be greater than 1' });
    }

    const eventDateObj = new Date(eventDate);
    if (isNaN(eventDateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid event date' });
    }

    if (imageUrl && !isAllowedImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
    }

    const event = await prisma.polymarketEvent.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl?.trim() || null,
        eventDate: eventDateObj,
        yesOdds: parseFloat(yesOdds),
        noOdds: parseFloat(noOdds),
        suggestionId: suggestionId || null,
      },
      include: {
        suggestion: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                usernameColor: true,
              },
            },
          },
        },
      },
    });

    // If created from suggestion, update suggestion status
    if (suggestionId) {
      await prisma.polymarketSuggestion.update({
        where: { id: suggestionId },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedBy: req.user!.id,
        },
      });
    }

    logAdmin('polymarket_event_create', req.user!.id, undefined, event.id, event.title, {
      yesOdds: event.yesOdds,
      noOdds: event.noOdds,
    });

    res.status(201).json({ event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update event (admin only)
router.patch('/events/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, imageUrl, eventDate, yesOdds, noOdds, status } = req.body;

    const updateData: any = {};

    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (imageUrl !== undefined) {
      if (imageUrl && !isAllowedImageUrl(imageUrl)) {
        return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
      }
      updateData.imageUrl = imageUrl?.trim() || null;
    }
    if (eventDate !== undefined) {
      const eventDateObj = new Date(eventDate);
      if (isNaN(eventDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid event date' });
      }
      updateData.eventDate = eventDateObj;
    }
    if (yesOdds !== undefined) {
      if (yesOdds <= 1) {
        return res.status(400).json({ error: 'Yes odds must be greater than 1' });
      }
      updateData.yesOdds = parseFloat(yesOdds);
    }
    if (noOdds !== undefined) {
      if (noOdds <= 1) {
        return res.status(400).json({ error: 'No odds must be greater than 1' });
      }
      updateData.noOdds = parseFloat(noOdds);
    }
    if (status !== undefined) {
      if (!['OPEN', 'CLOSED', 'RESOLVED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updateData.status = status;
      if (status === 'CLOSED') {
        updateData.closedAt = new Date();
      }
    }

    const event = await prisma.polymarketEvent.update({
      where: { id },
      data: updateData,
    });

    logAdmin('polymarket_event_update', req.user!.id, undefined, id, event.title, updateData);

    res.json({ event });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Approve suggestion and create event (admin only)
router.post('/suggestions/:id/approve', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { yesOdds, noOdds, eventDate } = req.body;

    if (!yesOdds || !noOdds) {
      return res.status(400).json({ error: 'Yes and no odds are required' });
    }

    if (yesOdds <= 1 || noOdds <= 1) {
      return res.status(400).json({ error: 'Odds must be greater than 1' });
    }

    const suggestion = await prisma.polymarketSuggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    if (suggestion.status !== 'PENDING') {
      return res.status(400).json({ error: 'Suggestion already reviewed' });
    }

    let eventDateObj: Date | null = null;
    if (eventDate) {
      eventDateObj = new Date(eventDate);
      if (isNaN(eventDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid event date' });
      }
    } else if (suggestion.eventDate) {
      eventDateObj = suggestion.eventDate;
    } else {
      return res.status(400).json({ error: 'Event date is required to approve this suggestion' });
    }

    // Create event from suggestion
    const event = await prisma.polymarketEvent.create({
      data: {
        suggestionId: suggestion.id,
        title: suggestion.title,
        description: suggestion.description,
        imageUrl: suggestion.imageUrl,
        eventDate: eventDateObj,
        yesOdds: parseFloat(yesOdds),
        noOdds: parseFloat(noOdds),
      },
      include: {
        suggestion: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                usernameColor: true,
              },
            },
          },
        },
      },
    });

    // Update suggestion status
    await prisma.polymarketSuggestion.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: req.user!.id,
      },
    });

    logAdmin('polymarket_suggestion_approve', req.user!.id, undefined, id, suggestion.title, {
      eventId: event.id,
      yesOdds: event.yesOdds,
      noOdds: event.noOdds,
    });

    res.json({ event });
  } catch (error) {
    console.error('Approve suggestion error:', error);
    res.status(500).json({ error: 'Failed to approve suggestion' });
  }
});

// Reject suggestion (admin only)
router.post('/suggestions/:id/reject', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const suggestion = await prisma.polymarketSuggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    if (suggestion.status !== 'PENDING') {
      return res.status(400).json({ error: 'Suggestion already reviewed' });
    }

    await prisma.polymarketSuggestion.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: req.user!.id,
      },
    });

    logAdmin('polymarket_suggestion_reject', req.user!.id, undefined, id, suggestion.title, {});

    res.json({ success: true });
  } catch (error) {
    console.error('Reject suggestion error:', error);
    res.status(500).json({ error: 'Failed to reject suggestion' });
  }
});

// ========== BETS ==========

// Get user bets
router.get('/bets', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const bets = await prisma.polymarketBet.findMany({
      where: {
        userId: req.user!.id,
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            status: true,
            resolution: true,
            eventDate: true,
            yesOdds: true,
            noOdds: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ bets });
  } catch (error) {
    console.error('Get bets error:', error);
    res.status(500).json({ error: 'Failed to get bets' });
  }
});

// Get all bets (all users)
router.get('/bets/all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    
    const bets = await prisma.polymarketBet.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            usernameColor: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            status: true,
            resolution: true,
            eventDate: true,
            yesOdds: true,
            noOdds: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string) || 50,
    });

    res.json({ bets });
  } catch (error) {
    console.error('Get all bets error:', error);
    res.status(500).json({ error: 'Failed to get all bets' });
  }
});

// Place a bet
router.post('/bets', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { eventId, prediction, amount } = req.body;

    if (!eventId || !prediction || !amount) {
      return res.status(400).json({ error: 'Event ID, prediction, and amount are required' });
    }

    if (!['YES', 'NO'].includes(prediction)) {
      return res.status(400).json({ error: 'Prediction must be YES or NO' });
    }

    if (amount <= 0 || !Number.isInteger(amount)) {
      return res.status(400).json({ error: 'Amount must be a positive integer' });
    }

    // Get user balance
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { money: true },
    });

    if (!user || user.money < amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    // Get event
    const event = await prisma.polymarketEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.status !== 'OPEN') {
      return res.status(400).json({ error: 'Event is not open for betting' });
    }

    if (event.eventDate <= new Date()) {
      return res.status(400).json({ error: 'Event date has passed' });
    }

    // Check if user already bet on this event
    const existingBet = await prisma.polymarketBet.findUnique({
      where: {
        userId_eventId: {
          userId: req.user!.id,
          eventId: event.id,
        },
      },
    });

    if (existingBet) {
      return res.status(400).json({ error: 'You have already placed a bet on this event' });
    }

    // Create bet and deduct money
    const bet = await prisma.polymarketBet.create({
      data: {
        userId: req.user!.id,
        eventId: event.id,
        prediction,
        amount,
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            status: true,
            yesOdds: true,
            noOdds: true,
          },
        },
      },
    });

    // Deduct money from user
    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        money: {
          decrement: amount,
        },
      },
    });

    res.status(201).json({ bet });
  } catch (error: any) {
    console.error('Place bet error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'You have already placed a bet on this event' });
    }
    res.status(500).json({ error: 'Failed to place bet' });
  }
});

// ========== RESOLUTION ==========

// Resolve event (admin only)
router.post('/events/:id/resolve', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;

    if (!['YES', 'NO'].includes(resolution)) {
      return res.status(400).json({ error: 'Resolution must be YES or NO' });
    }

    const event = await prisma.polymarketEvent.findUnique({
      where: { id },
      include: {
        bets: true,
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.status === 'RESOLVED') {
      return res.status(400).json({ error: 'Event already resolved' });
    }

    // Calculate payouts for winning bets
    const winningBets = event.bets.filter((bet) => bet.prediction === resolution);
    const odds = resolution === 'YES' ? event.yesOdds : event.noOdds;
    const maxInt32 = 2147483647;
    const maxPayout = winningBets.reduce((max, bet) => Math.max(max, Math.floor(bet.amount * odds)), 0);

    if (maxPayout > maxInt32) {
      return res.status(400).json({
        error: `Resolution would create payout ${maxPayout}, which exceeds current user money limit (${maxInt32})`,
      });
    }

    // Update event status
    await prisma.polymarketEvent.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolution,
        resolvedAt: new Date(),
        resolvedBy: req.user!.id,
      },
    });

    // Calculate and update payouts for winning bets
    for (const bet of winningBets) {
      const payoutAmount = Math.floor(bet.amount * odds);
      const payout = BigInt(payoutAmount);
      await prisma.polymarketBet.update({
        where: { id: bet.id },
        data: { payout },
      });

      // Add payout to user balance
      await prisma.user.update({
        where: { id: bet.userId },
        data: {
          money: {
            increment: payoutAmount,
          },
        },
      });
    }

    logAdmin('polymarket_event_resolve', req.user!.id, undefined, id, event.title, {
      resolution,
      winningBets: winningBets.length,
      totalPayout: winningBets.reduce((sum, b) => sum + Math.floor(b.amount * odds), 0),
    });

    res.json({ success: true, resolution });
  } catch (error) {
    console.error('Resolve event error:', error);
    res.status(500).json({ error: 'Failed to resolve event' });
  }
});

export default router;
