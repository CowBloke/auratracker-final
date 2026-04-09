import { Router, Response } from 'express';
import path from 'path';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { writeBase64UploadImage, writeBase64UploadVideo } from '../utils/uploads.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

const UPLOAD_DIR_IMAGES = path.resolve('uploads', 'aura-scroll-images');
const UPLOAD_DIR_VIDEOS = path.resolve('uploads', 'aura-scroll-videos');
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_IMAGES_PER_POST = 10;
const POSTS_PER_PAGE = 10;

// ─── Upload media ──────────────────────────────────────────────────────────────

// POST /api/aura-scroll/upload/image
router.post('/upload/image', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { base64Data, mimeType } = req.body;
    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'base64Data and mimeType are required' });
    }
    const result = await writeBase64UploadImage({ base64Data, mimeType, uploadDir: UPLOAD_DIR_IMAGES, maxBytes: MAX_IMAGE_SIZE });
    if ('error' in result) return res.status(400).json({ error: result.error });
    res.status(201).json({ url: `/api/uploads/aura-scroll-images/${result.fileName}` });
  } catch (error) {
    console.error('AuraScroll image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// POST /api/aura-scroll/upload/video
router.post('/upload/video', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { base64Data, mimeType } = req.body;
    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'base64Data and mimeType are required' });
    }
    const result = await writeBase64UploadVideo({ base64Data, mimeType, uploadDir: UPLOAD_DIR_VIDEOS, maxBytes: MAX_VIDEO_SIZE });
    if ('error' in result) return res.status(400).json({ error: result.error });
    res.status(201).json({ url: `/api/uploads/aura-scroll-videos/${result.fileName}` });
  } catch (error) {
    console.error('AuraScroll video upload error:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// ─── Feed ──────────────────────────────────────────────────────────────────────

// GET /api/aura-scroll?cursor=<postId>
// Returns approved posts in reverse-chronological order, paginated
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const posts = await prisma.auraScrollPost.findMany({
      where: { status: 'APPROVED' },
      take: POSTS_PER_PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, usernameColor: true, profilePicture: true } },
        likes: { select: { userId: true } },
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: {
            user: { select: { id: true, username: true, usernameColor: true, profilePicture: true } },
            likes: { select: { userId: true } },
          },
        },
      },
    });

    const userId = req.user!.id;
    const formatted = posts.map((post) => ({
      id: post.id,
      userId: post.userId,
      user: post.user,
      title: post.title,
      description: post.description,
      mediaUrls: JSON.parse(post.mediaUrls) as string[],
      mediaType: post.mediaType,
      thumbnailUrl: post.thumbnailUrl,
      viewCount: post.viewCount,
      createdAt: post.createdAt,
      likeCount: post.likes.length,
      liked: post.likes.some((l) => l.userId === userId),
      commentCount: post.comments.length,
      comments: post.comments.map((c) => ({
        id: c.id,
        postId: c.postId,
        user: c.user,
        content: c.content,
        createdAt: c.createdAt,
        likeCount: c.likes.length,
        liked: c.likes.some((l) => l.userId === userId),
      })),
    }));

    const nextCursor = posts.length === POSTS_PER_PAGE ? posts[posts.length - 1].id : null;
    res.json({ posts: formatted, nextCursor });
  } catch (error) {
    console.error('AuraScroll feed error:', error);
    res.status(500).json({ error: 'Failed to get feed' });
  }
});

// ─── Create post ───────────────────────────────────────────────────────────────

// POST /api/aura-scroll
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, mediaUrls, mediaType, thumbnailUrl } = req.body;

    if (!mediaUrls || !Array.isArray(mediaUrls) || mediaUrls.length === 0) {
      return res.status(400).json({ error: 'At least one media file is required' });
    }
    if (!['VIDEO', 'PHOTO', 'PHOTOS'].includes(mediaType)) {
      return res.status(400).json({ error: 'mediaType must be VIDEO, PHOTO, or PHOTOS' });
    }
    if (mediaUrls.length > MAX_IMAGES_PER_POST) {
      return res.status(400).json({ error: `Max ${MAX_IMAGES_PER_POST} images per post` });
    }
    if (description && description.length > 2000) {
      return res.status(400).json({ error: 'Description must be under 2000 characters' });
    }
    if (title && title.length > 100) {
      return res.status(400).json({ error: 'Title must be under 100 characters' });
    }

    const post = await prisma.auraScrollPost.create({
      data: {
        userId: req.user!.id,
        title: title?.trim() || null,
        description: description?.trim() || null,
        mediaUrls: JSON.stringify(mediaUrls),
        mediaType,
        thumbnailUrl: thumbnailUrl || mediaUrls[0],
        status: 'PENDING',
      },
      include: {
        user: { select: { id: true, username: true, usernameColor: true, profilePicture: true } },
      },
    });

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { isAdmin: true, isApproved: true },
      select: { id: true },
    });
    await Promise.allSettled(admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: 'SYSTEM',
        title: 'Nouveau post Aura Scroll',
        body: `${post.user.username} a soumis un post à valider.`,
        data: { postId: post.id },
        link: '/admin',
        icon: 'film',
      })
    ));

    res.status(201).json({
      post: {
        id: post.id,
        userId: post.userId,
        user: post.user,
        title: post.title,
        description: post.description,
        mediaUrls: JSON.parse(post.mediaUrls),
        mediaType: post.mediaType,
        thumbnailUrl: post.thumbnailUrl,
        status: post.status,
        createdAt: post.createdAt,
        likeCount: 0,
        liked: false,
        commentCount: 0,
        comments: [],
      },
    });
  } catch (error) {
    console.error('AuraScroll create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// ─── View count ────────────────────────────────────────────────────────────────

// POST /api/aura-scroll/:id/view
router.post('/:id/view', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.auraScrollPost.update({
      where: { id: req.params.id },
      data: { viewCount: { increment: 1 } },
    });
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

// ─── Like ──────────────────────────────────────────────────────────────────────

// POST /api/aura-scroll/:id/like
router.post('/:id/like', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const postId = req.params.id;
    const userId = req.user!.id;

    const post = await prisma.auraScrollPost.findUnique({ where: { id: postId }, select: { id: true, userId: true } });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const existing = await prisma.auraScrollLike.findUnique({ where: { postId_userId: { postId, userId } } });
    let liked: boolean;

    if (existing) {
      await prisma.auraScrollLike.delete({ where: { id: existing.id } });
      liked = false;
    } else {
      await prisma.auraScrollLike.create({ data: { postId, userId } });
      liked = true;

      if (post.userId !== userId) {
        const liker = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
        createNotification({
          userId: post.userId,
          type: 'SYSTEM',
          title: 'Nouveau like',
          body: `${liker?.username ?? 'Quelqu\'un'} a aimé ton Aura Scroll.`,
          data: { postId },
          link: '/aura-scroll',
          icon: 'heart',
        }).catch(() => {});
      }
    }

    const likeCount = await prisma.auraScrollLike.count({ where: { postId } });
    res.json({ liked, likeCount });
  } catch (error) {
    console.error('AuraScroll like error:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// ─── Comments ──────────────────────────────────────────────────────────────────

// POST /api/aura-scroll/:id/comments
router.post('/:id/comments', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const postId = req.params.id;
    const userId = req.user!.id;
    const { content } = req.body;

    if (!content?.trim()) return res.status(400).json({ error: 'Comment content is required' });
    if (content.trim().length > 500) return res.status(400).json({ error: 'Comment must be under 500 characters' });

    const post = await prisma.auraScrollPost.findUnique({ where: { id: postId }, select: { id: true, userId: true } });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const comment = await prisma.auraScrollComment.create({
      data: { postId, userId, content: content.trim() },
      include: {
        user: { select: { id: true, username: true, usernameColor: true, profilePicture: true } },
        likes: { select: { userId: true } },
      },
    });

    if (post.userId !== userId) {
      createNotification({
        userId: post.userId,
        type: 'SYSTEM',
        title: 'Nouveau commentaire',
        body: `${comment.user.username} a commenté ton Aura Scroll.`,
        data: { postId, commentId: comment.id },
        link: '/aura-scroll',
        icon: 'message-circle',
      }).catch(() => {});
    }

    res.status(201).json({
      comment: {
        id: comment.id,
        postId: comment.postId,
        user: comment.user,
        content: comment.content,
        createdAt: comment.createdAt,
        likeCount: 0,
        liked: false,
      },
    });
  } catch (error) {
    console.error('AuraScroll comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// DELETE /api/aura-scroll/:id/comments/:commentId
router.delete('/:id/comments/:commentId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const comment = await prisma.auraScrollComment.findUnique({ where: { id: req.params.commentId } });
    if (!comment || comment.postId !== req.params.id) return res.status(404).json({ error: 'Comment not found' });
    if (comment.userId !== req.user!.id && !req.user!.isAdmin) return res.status(403).json({ error: 'Not authorized' });

    await prisma.auraScrollComment.delete({ where: { id: req.params.commentId } });
    res.json({ success: true });
  } catch (error) {
    console.error('AuraScroll delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// POST /api/aura-scroll/:id/comments/:commentId/like
router.post('/:id/comments/:commentId/like', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user!.id;

    const existing = await prisma.auraScrollCommentLike.findUnique({ where: { commentId_userId: { commentId, userId } } });
    let liked: boolean;

    if (existing) {
      await prisma.auraScrollCommentLike.delete({ where: { id: existing.id } });
      liked = false;
    } else {
      await prisma.auraScrollCommentLike.create({ data: { commentId, userId } });
      liked = true;
    }

    const likeCount = await prisma.auraScrollCommentLike.count({ where: { commentId } });
    res.json({ liked, likeCount });
  } catch (error) {
    console.error('AuraScroll comment like error:', error);
    res.status(500).json({ error: 'Failed to like comment' });
  }
});

// ─── Delete post ───────────────────────────────────────────────────────────────

// DELETE /api/aura-scroll/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const post = await prisma.auraScrollPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.userId !== req.user!.id && !req.user!.isAdmin) return res.status(403).json({ error: 'Not authorized' });

    await prisma.auraScrollPost.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('AuraScroll delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ─── Admin endpoints ──────────────────────────────────────────────────────────

// GET /api/aura-scroll/admin/pending
router.get('/admin/pending', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const posts = await prisma.auraScrollPost.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, username: true, usernameColor: true, profilePicture: true } },
        likes: { select: { userId: true } },
        comments: { select: { id: true } },
      },
    });

    const formatted = posts.map((post) => ({
      id: post.id,
      userId: post.userId,
      user: post.user,
      title: post.title,
      description: post.description,
      mediaUrls: JSON.parse(post.mediaUrls) as string[],
      mediaType: post.mediaType,
      thumbnailUrl: post.thumbnailUrl,
      status: post.status,
      createdAt: post.createdAt,
      likeCount: post.likes.length,
      commentCount: post.comments.length,
    }));

    res.json({ posts: formatted });
  } catch (error) {
    console.error('AuraScroll admin pending error:', error);
    res.status(500).json({ error: 'Failed to get pending posts' });
  }
});

// GET /api/aura-scroll/admin/all
router.get('/admin/all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const posts = await prisma.auraScrollPost.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, username: true, usernameColor: true, profilePicture: true } },
        likes: { select: { userId: true } },
        comments: { select: { id: true } },
      },
    });

    const formatted = posts.map((post) => ({
      id: post.id,
      userId: post.userId,
      user: post.user,
      title: post.title,
      description: post.description,
      mediaUrls: JSON.parse(post.mediaUrls) as string[],
      mediaType: post.mediaType,
      thumbnailUrl: post.thumbnailUrl,
      status: post.status,
      rejectReason: post.rejectReason,
      createdAt: post.createdAt,
      viewCount: post.viewCount,
      likeCount: post.likes.length,
      commentCount: post.comments.length,
    }));

    res.json({ posts: formatted });
  } catch (error) {
    console.error('AuraScroll admin all error:', error);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

// PATCH /api/aura-scroll/:id/status
router.patch('/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const { status, rejectReason } = req.body;
    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      return res.status(400).json({ error: 'Status must be APPROVED, REJECTED, or PENDING' });
    }

    const post = await prisma.auraScrollPost.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true },
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    await prisma.auraScrollPost.update({
      where: { id: req.params.id },
      data: { status, rejectReason: status === 'REJECTED' ? (rejectReason?.trim() || null) : null },
    });

    // Notify the post author
    if (status === 'APPROVED') {
      createNotification({
        userId: post.userId,
        type: 'SYSTEM',
        title: 'Post approuvé !',
        body: 'Ton Aura Scroll a été approuvé et est maintenant visible.',
        data: { postId: post.id },
        link: '/aura-scroll',
        icon: 'check-circle',
      }).catch(() => {});
    } else if (status === 'REJECTED') {
      createNotification({
        userId: post.userId,
        type: 'SYSTEM',
        title: 'Post refusé',
        body: rejectReason ? `Ton Aura Scroll a été refusé : ${rejectReason}` : 'Ton Aura Scroll a été refusé par les admins.',
        data: { postId: post.id },
        link: '/aura-scroll',
        icon: 'x-circle',
      }).catch(() => {});
    }

    res.json({ success: true, status });
  } catch (error) {
    console.error('AuraScroll status update error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router;
