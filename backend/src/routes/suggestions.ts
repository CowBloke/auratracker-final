import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all suggestions with vote counts
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const suggestions = await prisma.suggestion.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            usernameColor: true,
          },
        },
        votes: {
          select: {
            userId: true,
            value: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to include vote count and user's vote
    const transformedSuggestions = suggestions.map((suggestion) => {
      const upvotes = suggestion.votes.filter((v) => v.value === 1).length;
      const downvotes = suggestion.votes.filter((v) => v.value === -1).length;
      const userVote = suggestion.votes.find((v) => v.userId === req.user!.id);

      return {
        id: suggestion.id,
        title: suggestion.title,
        description: suggestion.description,
        imageUrl: suggestion.imageUrl,
        createdAt: suggestion.createdAt,
        user: suggestion.user,
        upvotes,
        downvotes,
        score: upvotes - downvotes,
        userVote: userVote?.value || 0,
      };
    });

    // Sort by score (highest first)
    transformedSuggestions.sort((a, b) => b.score - a.score);

    res.json({ suggestions: transformedSuggestions });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// Create a new suggestion
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, imageUrl } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    if (title.length > 100) {
      return res.status(400).json({ error: 'Title must be less than 100 characters' });
    }

    if (description.length > 2000) {
      return res.status(400).json({ error: 'Description must be less than 2000 characters' });
    }

    const suggestion = await prisma.suggestion.create({
      data: {
        userId: req.user!.id,
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl?.trim() || null,
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

    res.status(201).json({
      suggestion: {
        ...suggestion,
        upvotes: 0,
        downvotes: 0,
        score: 0,
        userVote: 0,
      },
    });
  } catch (error) {
    console.error('Create suggestion error:', error);
    res.status(500).json({ error: 'Failed to create suggestion' });
  }
});

// Vote on a suggestion
router.post('/:id/vote', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { value } = req.body;

    if (![1, -1, 0].includes(value)) {
      return res.status(400).json({ error: 'Vote value must be 1, -1, or 0' });
    }

    // Check if suggestion exists
    const suggestion = await prisma.suggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    // Get existing vote
    const existingVote = await prisma.suggestionVote.findUnique({
      where: {
        suggestionId_userId: {
          suggestionId: id,
          userId: req.user!.id,
        },
      },
    });

    if (value === 0) {
      // Remove vote
      if (existingVote) {
        await prisma.suggestionVote.delete({
          where: { id: existingVote.id },
        });
      }
    } else {
      // Create or update vote
      await prisma.suggestionVote.upsert({
        where: {
          suggestionId_userId: {
            suggestionId: id,
            userId: req.user!.id,
          },
        },
        update: { value },
        create: {
          suggestionId: id,
          userId: req.user!.id,
          value,
        },
      });
    }

    // Get updated vote counts
    const votes = await prisma.suggestionVote.findMany({
      where: { suggestionId: id },
      select: { value: true },
    });

    const upvotes = votes.filter((v) => v.value === 1).length;
    const downvotes = votes.filter((v) => v.value === -1).length;

    res.json({
      upvotes,
      downvotes,
      score: upvotes - downvotes,
      userVote: value,
    });
  } catch (error) {
    console.error('Vote on suggestion error:', error);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// Delete a suggestion (only by author or admin)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const suggestion = await prisma.suggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    // Only author or admin can delete
    if (suggestion.userId !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this suggestion' });
    }

    await prisma.suggestion.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete suggestion error:', error);
    res.status(500).json({ error: 'Failed to delete suggestion' });
  }
});

export default router;
