import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { forumApi, ForumPost as ForumPostType, ForumComment } from '@/services/api';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  MessageSquare,
  Trash2,
  ExternalLink,
  CornerDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// ─── Vote buttons ────────────────────────────────────────────────────────────

function VoteButtons({
  score,
  userVote,
  onVote,
}: {
  score: number;
  userVote: number;
  onVote: (v: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={() => onVote(userVote === 1 ? 0 : 1)}
        className={cn(
          'rounded p-1 transition-colors hover:bg-muted',
          userVote === 1 ? 'text-orange-500' : 'text-muted-foreground'
        )}
      >
        <ChevronUp className="h-5 w-5" />
      </button>
      <span
        className={cn(
          'text-sm font-bold',
          userVote === 1 ? 'text-orange-500' : userVote === -1 ? 'text-blue-500' : 'text-foreground'
        )}
      >
        {score}
      </span>
      <button
        onClick={() => onVote(userVote === -1 ? 0 : -1)}
        className={cn(
          'rounded p-1 transition-colors hover:bg-muted',
          userVote === -1 ? 'text-blue-500' : 'text-muted-foreground'
        )}
      >
        <ChevronDown className="h-5 w-5" />
      </button>
    </div>
  );
}

// ─── Comment node ─────────────────────────────────────────────────────────────

function CommentNode({
  comment,
  postId,
  depth,
  currentUserId,
  isAdmin,
  onVote,
  onReply,
  onDelete,
}: {
  comment: ForumComment;
  postId: string;
  depth: number;
  currentUserId: string;
  isAdmin: boolean;
  onVote: (commentId: string, value: number) => void;
  onReply: (parentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replying, setReplying] = useState(false);
  const age = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: fr });
  const isDeleted = comment.body === '[supprimé]';

  const submitReply = async () => {
    if (!replyBody.trim()) return;
    setReplying(true);
    try {
      await onReply(comment.id, replyBody);
      setReplyBody('');
      setShowReply(false);
    } finally {
      setReplying(false);
    }
  };

  return (
    <div className={cn('flex gap-2', depth > 0 && 'border-l border-border/50 pl-3')}>
      {/* Vote */}
      <VoteButtons
        score={comment.score}
        userVote={comment.userVote}
        onVote={(v) => onVote(comment.id, v)}
      />

      {/* Body */}
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {!isDeleted ? (
            <Link
              to={`/profile/${comment.author.id}`}
              className="font-semibold hover:underline"
              style={{ color: comment.author.usernameColor ?? undefined }}
            >
              @{comment.author.username}
            </Link>
          ) : (
            <span className="font-semibold italic text-muted-foreground">supprimé</span>
          )}
          <span>{age}</span>
        </div>

        <p className={cn('mt-1 whitespace-pre-wrap text-sm', isDeleted && 'italic text-muted-foreground')}>
          {comment.body}
        </p>

        {!isDeleted && (
          <div className="mt-1.5 flex items-center gap-2">
            <button
              className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
              onClick={() => setShowReply((v) => !v)}
            >
              <CornerDownRight className="h-3 w-3" />
              Répondre
            </button>
            {(comment.author.id === currentUserId || isAdmin) && (
              <button
                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(comment.id)}
              >
                <Trash2 className="h-3 w-3" />
                Supprimer
              </button>
            )}
          </div>
        )}

        {showReply && (
          <div className="mt-2 space-y-2">
            <Textarea
              placeholder="Écrire une réponse..."
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={submitReply} disabled={replying || !replyBody.trim()}>
                {replying ? 'Envoi...' : 'Répondre'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowReply(false); setReplyBody(''); }}>
                Annuler
              </Button>
            </div>
          </div>
        )}

        {comment.children && comment.children.length > 0 && (
          <div className="mt-3 space-y-3">
            {comment.children.map((child) => (
              <CommentNode
                key={child.id}
                comment={child}
                postId={postId}
                depth={depth + 1}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onVote={onVote}
                onReply={onReply}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ForumPost() {
  const { subredditName, postId } = useParams<{ subredditName: string; postId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [post, setPost] = useState<(ForumPostType & { comments: ForumComment[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentBody, setCommentBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    forumApi
      .getPost(postId)
      .then(({ data }) => setPost(data))
      .catch(() => navigate(`/forum/c/${subredditName}`))
      .finally(() => setLoading(false));
  }, [postId, subredditName, navigate]);

  const handleVotePost = async (value: number) => {
    if (!post) return;
    try {
      const { data } = await forumApi.votePost(post.id, value);
      setPost((prev) => prev ? { ...prev, score: data.score, userVote: data.userVote } : prev);
    } catch {}
  };

  const handleVoteComment = async (commentId: string, value: number) => {
    try {
      const { data } = await forumApi.voteComment(commentId, value);
      setPost((prev) => {
        if (!prev) return prev;
        return { ...prev, comments: updateCommentScore(prev.comments, commentId, data.score, data.userVote) };
      });
    } catch {}
  };

  const updateCommentScore = (
    comments: ForumComment[],
    id: string,
    score: number,
    userVote: number
  ): ForumComment[] =>
    comments.map((c) =>
      c.id === id
        ? { ...c, score, userVote }
        : { ...c, children: updateCommentScore(c.children, id, score, userVote) }
    );

  const insertComment = (
    comments: ForumComment[],
    parentId: string | null,
    newComment: ForumComment
  ): ForumComment[] => {
    if (!parentId) return [...comments, newComment];
    return comments.map((c) =>
      c.id === parentId
        ? { ...c, children: [...c.children, newComment] }
        : { ...c, children: insertComment(c.children, parentId, newComment) }
    );
  };

  const removeComment = (comments: ForumComment[], id: string): ForumComment[] =>
    comments.map((c) =>
      c.id === id
        ? { ...c, body: '[supprimé]' }
        : { ...c, children: removeComment(c.children, id) }
    );

  const handleSubmitComment = async () => {
    if (!post || !commentBody.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await forumApi.addComment(post.id, { body: commentBody });
      setPost((prev) =>
        prev
          ? { ...prev, comments: [...prev.comments, data], commentCount: prev.commentCount + 1 }
          : prev
      );
      setCommentBody('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId: string, body: string) => {
    if (!post) return;
    const { data } = await forumApi.addComment(post.id, { body, parentId });
    setPost((prev) =>
      prev
        ? { ...prev, comments: insertComment(prev.comments, parentId, data), commentCount: prev.commentCount + 1 }
        : prev
    );
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Supprimer ce commentaire ?')) return;
    try {
      await forumApi.deleteComment(commentId);
      setPost((prev) =>
        prev ? { ...prev, comments: removeComment(prev.comments, commentId) } : prev
      );
    } catch {}
  };

  const handleDeletePost = async () => {
    if (!post || !confirm('Supprimer ce post ?')) return;
    try {
      await forumApi.deletePost(post.id);
      navigate(`/forum/c/${subredditName}`);
    } catch {}
  };

  // Build flat comment list into tree for display (already a tree from API)
  const rootComments = post?.comments ?? [];

  return (
    <PageShell size="default" className="pb-10">
      {/* Back link */}
      <button
        onClick={() => navigate(`/forum/c/${subredditName}`)}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à #{subredditName}
      </button>

      {loading ? (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg border bg-card p-4">
            <div className="flex flex-col items-center gap-1">
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-6 w-6" />
            </div>
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </div>
      ) : post ? (
        <div className="space-y-4">
          {/* Post card */}
          <div className="flex gap-3 rounded-lg border bg-card p-4">
            <VoteButtons score={post.score} userVote={post.userVote} onVote={handleVotePost} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <Link to={`/forum/c/${post.subreddit.name}`} className="font-semibold text-foreground hover:underline">
                  #{post.subreddit.name}
                </Link>
                <span>
                  posté par{' '}
                  <Link
                    to={`/profile/${post.author.id}`}
                    className="hover:underline"
                    style={{ color: post.author.usernameColor ?? undefined }}
                  >
                    @{post.author.username}
                  </Link>
                </span>
                <span>
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: fr })}
                </span>
              </div>

              <h1 className="mt-1 text-lg font-bold leading-snug">{post.title}</h1>

              {post.type === 'link' && post.url && (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-1 text-sm text-blue-500 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  {post.url}
                </a>
              )}

              {post.type === 'text' && post.body && (
                <p className="mt-2 whitespace-pre-wrap text-sm">{post.body}</p>
              )}

              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  {post.commentCount} commentaire{post.commentCount !== 1 ? 's' : ''}
                </span>
                {(post.author.id === user!.id || user!.isAdmin) && (
                  <button
                    className="flex items-center gap-1 rounded px-2 py-1 text-destructive hover:bg-destructive/10"
                    onClick={handleDeletePost}
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* New comment box */}
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm text-muted-foreground">
              Commenter en tant que{' '}
              <span className="font-semibold text-foreground">@{user!.username}</span>
            </p>
            <Textarea
              ref={textareaRef}
              placeholder="Qu'avez-vous à dire ?"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={4}
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                onClick={handleSubmitComment}
                disabled={submitting || !commentBody.trim()}
              >
                {submitting ? 'Envoi...' : 'Commenter'}
              </Button>
            </div>
          </div>

          {/* Comments */}
          {rootComments.length > 0 ? (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="mb-4 text-sm font-semibold">
                {post.commentCount} commentaire{post.commentCount !== 1 ? 's' : ''}
              </h2>
              <div className="space-y-4">
                {rootComments.map((comment) => (
                  <CommentNode
                    key={comment.id}
                    comment={comment}
                    postId={post.id}
                    depth={0}
                    currentUserId={user!.id}
                    isAdmin={user!.isAdmin}
                    onVote={handleVoteComment}
                    onReply={handleReply}
                    onDelete={handleDeleteComment}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
              Aucun commentaire. Soyez le premier !
            </div>
          )}
        </div>
      ) : null}
    </PageShell>
  );
}
