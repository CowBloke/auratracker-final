import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logForum } from '../utils/logger.js';

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

const userSelect = {
  id: true,
  username: true,
  usernameColor: true,
  profilePicture: true,
};

function hotScore(score: number, createdAt: Date): number {
  const ageHours = (Date.now() - createdAt.getTime()) / 3_600_000;
  return score / Math.pow(ageHours + 2, 1.8);
}

function buildCommentTree(comments: RawComment[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const c of comments) {
    map.set(c.id, { ...c, children: [] });
  }
  for (const node of map.values()) {
    if (node.parentId) {
      map.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

type RawComment = {
  id: string;
  body: string;
  score: number;
  createdAt: Date;
  parentId: string | null;
  authorId: string;
  author: { id: string; username: string; usernameColor: string | null; profilePicture: string | null };
  votes: { userId: string; value: number }[];
};

type CommentNode = RawComment & { children: CommentNode[] };

// ─── Subreddits ──────────────────────────────────────────────────────────────

// GET /forum/subreddits
router.get('/subreddits', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const subreddits = await prisma.forumSubreddit.findMany({
      include: {
        creator: { select: userSelect },
        _count: { select: { members: true, posts: true } },
        members: { where: { userId: req.user!.id }, select: { userId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      subreddits.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        icon: s.icon,
        createdAt: s.createdAt,
        creator: s.creator,
        memberCount: s._count.members,
        postCount: s._count.posts,
        isJoined: s.members.length > 0,
      }))
    );
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /forum/subreddits
router.post('/subreddits', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, description, icon } = req.body as { name: string; description: string; icon?: string };

  if (!name || !description) {
    return res.status(400).json({ error: 'Nom et description requis' });
  }

  const clean = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  if (clean.length < 3 || clean.length > 21) {
    return res.status(400).json({ error: 'Le nom doit faire entre 3 et 21 caractères' });
  }

  try {
    const sub = await prisma.forumSubreddit.create({
      data: {
        name: clean,
        description,
        icon: icon ?? null,
        creatorId: req.user!.id,
        members: { create: { userId: req.user!.id } },
      },
      include: { creator: { select: userSelect }, _count: { select: { members: true, posts: true } } },
    });

    logForum('subreddit_create', req.user!.id, req.user!.username, { subredditName: sub.name });
    res.status(201).json({
      id: sub.id,
      name: sub.name,
      description: sub.description,
      icon: sub.icon,
      createdAt: sub.createdAt,
      creator: sub.creator,
      memberCount: sub._count.members,
      postCount: sub._count.posts,
      isJoined: true,
    });
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Ce nom existe déjà' });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /forum/subreddits/:name
router.get('/subreddits/:name', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sub = await prisma.forumSubreddit.findUnique({
      where: { name: req.params.name },
      include: {
        creator: { select: userSelect },
        _count: { select: { members: true, posts: true } },
        members: { where: { userId: req.user!.id }, select: { userId: true } },
      },
    });

    if (!sub) return res.status(404).json({ error: 'Subreddit introuvable' });

    res.json({
      id: sub.id,
      name: sub.name,
      description: sub.description,
      icon: sub.icon,
      createdAt: sub.createdAt,
      creator: sub.creator,
      memberCount: sub._count.members,
      postCount: sub._count.posts,
      isJoined: sub.members.length > 0,
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /forum/subreddits/:name/join — toggle join/leave
router.post('/subreddits/:name/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sub = await prisma.forumSubreddit.findUnique({ where: { name: req.params.name } });
    if (!sub) return res.status(404).json({ error: 'Subreddit introuvable' });

    const existing = await prisma.forumSubredditMember.findUnique({
      where: { userId_subredditId: { userId: req.user!.id, subredditId: sub.id } },
    });

    if (existing) {
      await prisma.forumSubredditMember.delete({
        where: { userId_subredditId: { userId: req.user!.id, subredditId: sub.id } },
      });
      logForum('subreddit_leave', req.user!.id, req.user!.username, { subredditName: sub.name });
      res.json({ joined: false });
    } else {
      await prisma.forumSubredditMember.create({ data: { userId: req.user!.id, subredditId: sub.id } });
      logForum('subreddit_join', req.user!.id, req.user!.username, { subredditName: sub.name });
      res.json({ joined: true });
    }
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Posts ───────────────────────────────────────────────────────────────────

// GET /forum/posts?subreddit=&sort=hot|new|top&page=
router.get('/posts', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { subreddit, sort = 'hot', page = '1' } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const take = 20;
  const skip = (pageNum - 1) * take;

  try {
    const where = subreddit ? { subreddit: { name: subreddit } } : {};

    const posts = await prisma.forumPost.findMany({
      where,
      include: {
        author: { select: userSelect },
        subreddit: { select: { name: true, icon: true } },
        votes: { select: { userId: true, value: true } },
        _count: { select: { comments: true } },
      },
      orderBy: sort === 'new' ? { createdAt: 'desc' } : sort === 'top' ? { score: 'desc' } : { createdAt: 'desc' },
      take: sort === 'hot' ? 200 : take,
      skip: sort === 'hot' ? 0 : skip,
    });

    let sorted = posts;
    if (sort === 'hot') {
      sorted = [...posts].sort((a, b) => hotScore(b.score, b.createdAt) - hotScore(a.score, a.createdAt));
      sorted = sorted.slice(skip, skip + take);
    }

    const result = sorted.map((p) => {
      const userVote = p.votes.find((v) => v.userId === req.user!.id);
      return {
        id: p.id,
        title: p.title,
        body: p.body,
        url: p.url,
        type: p.type,
        score: p.score,
        createdAt: p.createdAt,
        author: p.author,
        subreddit: p.subreddit,
        commentCount: p._count.comments,
        userVote: userVote?.value ?? 0,
      };
    });

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /forum/posts
router.post('/posts', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { title, body, url, type = 'text', subredditName } = req.body as {
    title: string; body?: string; url?: string; type?: string; subredditName: string;
  };

  if (!title?.trim() || !subredditName) {
    return res.status(400).json({ error: 'Titre et subreddit requis' });
  }
  if (type === 'link' && !url?.trim()) {
    return res.status(400).json({ error: 'URL requise pour un post lien' });
  }

  try {
    const sub = await prisma.forumSubreddit.findUnique({ where: { name: subredditName } });
    if (!sub) return res.status(404).json({ error: 'Subreddit introuvable' });

    const post = await prisma.forumPost.create({
      data: {
        title: title.trim(),
        body: body?.trim() ?? null,
        url: url?.trim() ?? null,
        type,
        authorId: req.user!.id,
        subredditId: sub.id,
      },
      include: {
        author: { select: userSelect },
        subreddit: { select: { name: true, icon: true } },
        _count: { select: { comments: true } },
      },
    });

    logForum('forum_post_create', req.user!.id, req.user!.username, { postId: post.id, title: post.title, subreddit: post.subreddit.name });
    res.status(201).json({
      id: post.id,
      title: post.title,
      body: post.body,
      url: post.url,
      type: post.type,
      score: post.score,
      createdAt: post.createdAt,
      author: post.author,
      subreddit: post.subreddit,
      commentCount: post._count.comments,
      userVote: 0,
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /forum/posts/:postId
router.get('/posts/:postId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const post = await prisma.forumPost.findUnique({
      where: { id: req.params.postId },
      include: {
        author: { select: userSelect },
        subreddit: { select: { name: true, icon: true, description: true } },
        votes: { select: { userId: true, value: true } },
        _count: { select: { comments: true } },
        comments: {
          include: {
            author: { select: userSelect },
            votes: { select: { userId: true, value: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!post) return res.status(404).json({ error: 'Post introuvable' });

    const userVote = post.votes.find((v) => v.userId === req.user!.id);

    const rawComments: RawComment[] = post.comments.map((c) => ({
      id: c.id,
      body: c.body,
      score: c.score,
      createdAt: c.createdAt,
      parentId: c.parentId,
      authorId: c.authorId,
      author: c.author,
      votes: c.votes,
    }));

    const commentsWithVote = rawComments.map((c) => ({
      ...c,
      userVote: c.votes.find((v) => v.userId === req.user!.id)?.value ?? 0,
    }));

    const commentTree = buildCommentTree(commentsWithVote as any);

    res.json({
      id: post.id,
      title: post.title,
      body: post.body,
      url: post.url,
      type: post.type,
      score: post.score,
      createdAt: post.createdAt,
      author: post.author,
      subreddit: post.subreddit,
      commentCount: post._count.comments,
      userVote: userVote?.value ?? 0,
      comments: commentTree,
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /forum/posts/:postId
router.delete('/posts/:postId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const post = await prisma.forumPost.findUnique({ where: { id: req.params.postId } });
    if (!post) return res.status(404).json({ error: 'Post introuvable' });
    if (post.authorId !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    await prisma.forumPost.delete({ where: { id: req.params.postId } });
    logForum('forum_post_delete', req.user!.id, req.user!.username, { postId: post.id, title: post.title });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /forum/posts/:postId/vote
router.post('/posts/:postId/vote', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { value } = req.body as { value: number };
  if (value !== 1 && value !== -1 && value !== 0) {
    return res.status(400).json({ error: 'Valeur invalide' });
  }

  try {
    const post = await prisma.forumPost.findUnique({ where: { id: req.params.postId } });
    if (!post) return res.status(404).json({ error: 'Post introuvable' });

    const existing = await prisma.forumPostVote.findUnique({
      where: { userId_postId: { userId: req.user!.id, postId: post.id } },
    });

    let scoreDelta = 0;

    if (value === 0) {
      if (existing) {
        scoreDelta = -existing.value;
        await prisma.forumPostVote.delete({
          where: { userId_postId: { userId: req.user!.id, postId: post.id } },
        });
      }
    } else if (existing) {
      scoreDelta = value - existing.value;
      await prisma.forumPostVote.update({
        where: { userId_postId: { userId: req.user!.id, postId: post.id } },
        data: { value },
      });
    } else {
      scoreDelta = value;
      await prisma.forumPostVote.create({ data: { userId: req.user!.id, postId: post.id, value } });
    }

    const updated = await prisma.forumPost.update({
      where: { id: post.id },
      data: { score: { increment: scoreDelta } },
    });

    res.json({ score: updated.score, userVote: value });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Comments ────────────────────────────────────────────────────────────────

// POST /forum/posts/:postId/comments
router.post('/posts/:postId/comments', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { body, parentId } = req.body as { body: string; parentId?: string };
  if (!body?.trim()) return res.status(400).json({ error: 'Commentaire vide' });

  try {
    const post = await prisma.forumPost.findUnique({ where: { id: req.params.postId } });
    if (!post) return res.status(404).json({ error: 'Post introuvable' });

    if (parentId) {
      const parent = await prisma.forumComment.findUnique({ where: { id: parentId } });
      if (!parent || parent.postId !== post.id) return res.status(400).json({ error: 'Parent invalide' });
    }

    const comment = await prisma.forumComment.create({
      data: {
        body: body.trim(),
        authorId: req.user!.id,
        postId: post.id,
        parentId: parentId ?? null,
      },
      include: { author: { select: userSelect } },
    });

    logForum('forum_comment_create', req.user!.id, req.user!.username, { commentId: comment.id, postId: post.id });
    res.status(201).json({ ...comment, votes: [], children: [], userVote: 0 });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /forum/comments/:commentId/vote
router.post('/comments/:commentId/vote', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { value } = req.body as { value: number };
  if (value !== 1 && value !== -1 && value !== 0) {
    return res.status(400).json({ error: 'Valeur invalide' });
  }

  try {
    const comment = await prisma.forumComment.findUnique({ where: { id: req.params.commentId } });
    if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });

    const existing = await prisma.forumCommentVote.findUnique({
      where: { userId_commentId: { userId: req.user!.id, commentId: comment.id } },
    });

    let scoreDelta = 0;

    if (value === 0) {
      if (existing) {
        scoreDelta = -existing.value;
        await prisma.forumCommentVote.delete({
          where: { userId_commentId: { userId: req.user!.id, commentId: comment.id } },
        });
      }
    } else if (existing) {
      scoreDelta = value - existing.value;
      await prisma.forumCommentVote.update({
        where: { userId_commentId: { userId: req.user!.id, commentId: comment.id } },
        data: { value },
      });
    } else {
      scoreDelta = value;
      await prisma.forumCommentVote.create({ data: { userId: req.user!.id, commentId: comment.id, value } });
    }

    const updated = await prisma.forumComment.update({
      where: { id: comment.id },
      data: { score: { increment: scoreDelta } },
    });

    res.json({ score: updated.score, userVote: value });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /forum/comments/:commentId
router.delete('/comments/:commentId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const comment = await prisma.forumComment.findUnique({ where: { id: req.params.commentId } });
    if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });
    if (comment.authorId !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    await prisma.forumComment.update({
      where: { id: req.params.commentId },
      data: { body: '[supprimé]', authorId: req.user!.id },
    });
    logForum('forum_comment_delete', req.user!.id, req.user!.username, { commentId: comment.id, postId: comment.postId });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
