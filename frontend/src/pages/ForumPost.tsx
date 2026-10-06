import { useEffect, useState } from 'react';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CornerDownRight, ExternalLink, MessageSquare, Trash2, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { forumApi, ForumPost as ForumPostType, ForumComment } from '@/services/api';
import { VoteButtons } from '@/components/forum/VoteButtons';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldLabel } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ─── Comment node ──────────────────────────────────────────────────────────

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
    <div className={cn('flex flex-col gap-2', depth > 0 && 'border-l pl-4')}>
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
          <span className="font-semibold italic">supprimé</span>
        )}
        <span>{age}</span>
      </div>

      <p className={cn('whitespace-pre-wrap text-sm', isDeleted && 'italic text-muted-foreground')}>{comment.body}</p>

      {!isDeleted ? (
        <div className="flex flex-wrap items-center gap-2">
          <VoteButtons score={comment.score} userVote={comment.userVote} onVote={(value) => onVote(comment.id, value)} />
          <Button variant="ghost" size="sm" onClick={() => setShowReply((value) => !value)}>
            <CornerDownRight />
            Répondre
          </Button>
          {comment.author.id === currentUserId || isAdmin ? (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(comment.id)}>
              <Trash2 />
              Supprimer
            </Button>
          ) : null}
        </div>
      ) : null}

      {showReply ? (
        <Field>
          <Textarea
            aria-label="Écrire une réponse"
            placeholder="Écrire une réponse…"
            value={replyBody}
            onChange={(event) => setReplyBody(event.target.value)}
            rows={3}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={submitReply} disabled={replying || !replyBody.trim()}>
              {replying ? <Spinner /> : null}
              Répondre
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowReply(false);
                setReplyBody('');
              }}
            >
              Annuler
            </Button>
          </div>
        </Field>
      ) : null}

      {comment.children && comment.children.length > 0 ? (
        <div className="flex flex-col gap-4 pt-2">
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
      ) : null}
    </div>
  );
}

export default function ForumPost() {
  const { subredditName, postId } = useParams<{ subredditName: string; postId: string }>();
  const { user } = useAuth();
  const { confirm } = useAppDialog();
  const navigate = useNavigate();

  const [post, setPost] = useState<(ForumPostType & { comments: ForumComment[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentBody, setCommentBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    if (!(await confirm({ title: 'Supprimer ce commentaire ?', description: 'Cette action est irréversible.', confirmLabel: 'Supprimer' }))) return;
    try {
      await forumApi.deleteComment(commentId);
      setPost((prev) =>
        prev ? { ...prev, comments: removeComment(prev.comments, commentId) } : prev
      );
    } catch {}
  };

  const handleDeletePost = async () => {
    if (!post) return;
    if (!(await confirm({ title: 'Supprimer ce post ?', description: 'Cette action est irréversible.', confirmLabel: 'Supprimer' }))) return;
    try {
      await forumApi.deletePost(post.id);
      navigate(`/forum/c/${subredditName}`);
    } catch {}
  };

  const rootComments = post?.comments ?? [];

  return (
    <PageShell>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/forum/c/${subredditName}`)}>
          <ArrowLeft />
          Retour à #{subredditName}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/forum')}>
          <Users />
          Tous les forums
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : post ? (
        <>
          <Card>
            <CardHeader>
              <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link to={`/forum/c/${post.subreddit.name}`} className="font-semibold text-foreground hover:underline">
                  #{post.subreddit.name}
                </Link>
                <span>
                  posté par{' '}
                  <Link to={`/profile/${post.author.id}`} className="hover:underline" style={{ color: post.author.usernameColor ?? undefined }}>
                    @{post.author.username}
                  </Link>
                </span>
                <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: fr })}</span>
              </CardDescription>
              <CardTitle className="text-xl">{post.title}</CardTitle>
            </CardHeader>
            {(post.type === 'link' && post.url) || (post.type === 'text' && post.body) ? (
              <CardContent>
                {post.type === 'link' && post.url ? (
                  <a href={post.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm underline-offset-4 hover:underline">
                    <ExternalLink className="size-4" />
                    {post.url}
                  </a>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{post.body}</p>
                )}
              </CardContent>
            ) : null}
            <CardFooter className="flex flex-wrap items-center gap-2">
              <VoteButtons score={post.score} userVote={post.userVote} onVote={handleVotePost} />
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <MessageSquare className="size-4" />
                {post.commentCount} commentaire{post.commentCount !== 1 ? 's' : ''}
              </span>
              {post.author.id === user!.id || user!.isAdmin ? (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDeletePost}>
                  <Trash2 />
                  Supprimer
                </Button>
              ) : null}
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ajouter un commentaire</CardTitle>
              <CardDescription>
                Commenter en tant que <span className="font-semibold text-foreground">@{user!.username}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Field>
                <FieldLabel htmlFor="new-comment" className="sr-only">
                  Commentaire
                </FieldLabel>
                <Textarea
                  id="new-comment"
                  placeholder="Qu'as-tu à dire ?"
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  rows={4}
                />
              </Field>
            </CardContent>
            <CardFooter className="justify-end">
              <Button size="sm" onClick={handleSubmitComment} disabled={submitting || !commentBody.trim()}>
                {submitting ? <Spinner /> : null}
                Commenter
              </Button>
            </CardFooter>
          </Card>

          {rootComments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {post.commentCount} commentaire{post.commentCount !== 1 ? 's' : ''}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
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
              </CardContent>
            </Card>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>Aucun commentaire</EmptyTitle>
                <EmptyDescription>Soyez le premier à commenter !</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </>
      ) : null}
    </PageShell>
  );
}
