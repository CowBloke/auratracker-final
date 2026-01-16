import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logSuggestion } from '../utils/logger.js';
import { isAllowedImageUrl } from '../utils/uploads.js';

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
        ratings: {
          select: {
            userId: true,
            rating: true,
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
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
      orderBy: { createdAt: 'desc' },
    });

    // Transform to include vote count and user's vote
    const transformedSuggestions = suggestions.map((suggestion) => {
      const upvotes = suggestion.votes.filter((v) => v.value === 1).length;
      const downvotes = suggestion.votes.filter((v) => v.value === -1).length;
      const userVote = suggestion.votes.find((v) => v.userId === req.user!.id);
      const ratingCount = suggestion.ratings.length;
      const averageRating = ratingCount
        ? suggestion.ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratingCount
        : null;
      const userRating = suggestion.ratings.find((r) => r.userId === req.user!.id);

      return {
        id: suggestion.id,
        title: suggestion.title,
        description: suggestion.description,
        imageUrl: suggestion.imageUrl,
        status: suggestion.status,
        createdAt: suggestion.createdAt,
        resolvedAt: suggestion.resolvedAt,
        user: suggestion.user,
        upvotes,
        downvotes,
        score: upvotes - downvotes,
        userVote: userVote?.value || 0,
        averageRating,
        ratingCount,
        userRating: userRating?.rating ?? null,
        comments: suggestion.comments,
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

    if (imageUrl && !isAllowedImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
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

    // Log suggestion creation
    logSuggestion('suggestion_create', req.user!.id, suggestion.user.username, {
      suggestionId: suggestion.id,
      title: suggestion.title,
    });

    res.status(201).json({
      suggestion: {
        ...suggestion,
        status: suggestion.status,
        resolvedAt: suggestion.resolvedAt,
        upvotes: 0,
        downvotes: 0,
        score: 0,
        userVote: 0,
        averageRating: null,
        ratingCount: 0,
        userRating: null,
        comments: [],
      },
    });
  } catch (error) {
    console.error('Create suggestion error:', error);
    res.status(500).json({ error: 'Failed to create suggestion' });
  }
});

// Add a comment to a suggestion
router.post('/:id/comments', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length > 500) {
      return res.status(400).json({ error: 'Comment must be less than 500 characters' });
    }

    const suggestion = await prisma.suggestion.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    const comment = await prisma.suggestionComment.create({
      data: {
        suggestionId: id,
        userId: req.user!.id,
        content: trimmedContent,
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

    // Log comment creation
    logSuggestion('suggestion_comment', req.user!.id, comment.user.username, {
      suggestionId: id,
      commentId: comment.id,
    });

    res.status(201).json({ comment });
  } catch (error) {
    console.error('Create suggestion comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
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

    // Log vote
    const voter = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { username: true },
    });
    logSuggestion('suggestion_vote', req.user!.id, voter?.username || undefined, {
      suggestionId: id,
      vote: value === 1 ? 'upvote' : value === -1 ? 'downvote' : 'removed',
    });

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

// Update suggestion status (admin only)
router.patch('/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!['PENDING', 'DONE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be PENDING or DONE' });
    }

    const updated = await prisma.suggestion.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === 'DONE' ? new Date() : null,
      },
      include: {
        ratings: {
          select: {
            userId: true,
            rating: true,
          },
        },
      },
    });

    const ratingCount = updated.ratings.length;
    const averageRating = ratingCount
      ? updated.ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratingCount
      : null;
    const userRating = updated.ratings.find((r) => r.userId === req.user!.id);

    logSuggestion('suggestion_status', req.user!.id, req.user!.username, {
      suggestionId: id,
      status,
    });

    res.json({
      status: updated.status,
      resolvedAt: updated.resolvedAt,
      averageRating,
      ratingCount,
      userRating: userRating?.rating ?? null,
    });
  } catch (error) {
    console.error('Update suggestion status error:', error);
    res.status(500).json({ error: 'Failed to update suggestion status' });
  }
});

// Rate a suggestion update (only when done)
router.post('/:id/rating', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;

    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 10' });
    }

    const suggestion = await prisma.suggestion.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    if (suggestion.status !== 'DONE') {
      return res.status(400).json({ error: 'Suggestion must be marked as done before rating' });
    }

    await prisma.suggestionRating.upsert({
      where: {
        suggestionId_userId: {
          suggestionId: id,
          userId: req.user!.id,
        },
      },
      update: { rating },
      create: {
        suggestionId: id,
        userId: req.user!.id,
        rating,
      },
    });

    const ratings = await prisma.suggestionRating.findMany({
      where: { suggestionId: id },
      select: { rating: true, userId: true },
    });

    const ratingCount = ratings.length;
    const averageRating = ratingCount
      ? ratings.reduce((sum, entry) => sum + entry.rating, 0) / ratingCount
      : null;
    const userRating = ratings.find((entry) => entry.userId === req.user!.id)?.rating ?? null;

    logSuggestion('suggestion_rating', req.user!.id, req.user!.username, {
      suggestionId: id,
      rating,
    });

    res.json({
      averageRating,
      ratingCount,
      userRating,
    });
  } catch (error) {
    console.error('Rate suggestion error:', error);
    res.status(500).json({ error: 'Failed to rate suggestion' });
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

    // Log deletion
    const deleter = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { username: true },
    });
    logSuggestion('suggestion_delete', req.user!.id, deleter?.username || undefined, {
      suggestionId: id,
      suggestionTitle: suggestion.title,
      wasOwnSuggestion: suggestion.userId === req.user!.id,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete suggestion error:', error);
    res.status(500).json({ error: 'Failed to delete suggestion' });
  }
});

// Delete a comment (only by author or admin)
router.delete('/:id/comments/:commentId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, commentId } = req.params;

    const comment = await prisma.suggestionComment.findUnique({
      where: { id: commentId },
    });

    if (!comment || comment.suggestionId !== id) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.userId !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    await prisma.suggestionComment.delete({
      where: { id: commentId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete suggestion comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
