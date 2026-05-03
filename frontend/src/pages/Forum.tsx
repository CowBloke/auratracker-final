import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { forumApi, ForumSubreddit, ForumPost } from '@/services/api';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Plus,
  Users,
  ExternalLink,
  Trash2,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// ─── Vote buttons ────────────────────────────────────────────────────────────

function VoteButtons({
  score,
  userVote,
  onVote,
  vertical = true,
}: {
  score: number;
  userVote: number;
  onVote: (v: number) => void;
  vertical?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-1', vertical ? 'flex-col' : 'flex-row')}>
      <button
        onClick={() => onVote(userVote === 1 ? 0 : 1)}
        className={cn(
          'rounded p-1 transition-colors hover:bg-muted',
          userVote === 1 ? 'text-orange-500' : 'text-muted-foreground'
        )}
      >
        <ChevronUp className="h-5 w-5" />
      </button>
      <span className={cn('text-sm font-bold', userVote === 1 ? 'text-orange-500' : userVote === -1 ? 'text-blue-500' : 'text-foreground')}>
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

// ─── Post card ───────────────────────────────────────────────────────────────

function PostCard({
  post,
  showSubreddit,
  onVote,
  onDelete,
  currentUserId,
  isAdmin,
}: {
  post: ForumPost;
  showSubreddit: boolean;
  onVote: (postId: string, value: number) => void;
  onDelete: (postId: string) => void;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const navigate = useNavigate();
  const age = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: fr });

  return (
    <div className="flex gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-border/80">
      {/* Vote column */}
      <VoteButtons
        score={post.score}
        userVote={post.userVote}
        onVote={(v) => onVote(post.id, v)}
        vertical
      />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {showSubreddit && (
            <Link
              to={`/forum/c/${post.subreddit.name}`}
              className="font-semibold text-foreground hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              #{post.subreddit.name}
            </Link>
          )}
          <span>
            posté par{' '}
            <Link
              to={`/profile/${post.author.id}`}
              className="hover:underline"
              onClick={(e) => e.stopPropagation()}
              style={{ color: post.author.usernameColor ?? undefined }}
            >
              @{post.author.username}
            </Link>
          </span>
          <span>{age}</span>
        </div>

        <button
          className="mt-1 w-full text-left"
          onClick={() => navigate(`/forum/c/${post.subreddit.name}/post/${post.id}`)}
        >
          <h3 className="text-sm font-semibold leading-snug">{post.title}</h3>
          {post.type === 'link' && post.url && (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-xs text-blue-500 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
              {post.url}
            </a>
          )}
          {post.type === 'text' && post.body && (
            <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{post.body}</p>
          )}
        </button>

        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <button
            className="flex items-center gap-1 rounded px-2 py-1 hover:bg-muted"
            onClick={() => navigate(`/forum/c/${post.subreddit.name}/post/${post.id}`)}
          >
            <MessageSquare className="h-4 w-4" />
            {post.commentCount} commentaire{post.commentCount !== 1 ? 's' : ''}
          </button>

          {(post.author.id === currentUserId || isAdmin) && (
            <button
              className="flex items-center gap-1 rounded px-2 py-1 text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(post.id)}
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create post dialog ───────────────────────────────────────────────────────

function CreatePostDialog({
  open,
  onClose,
  subredditName,
  subreddits,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  subredditName?: string;
  subreddits: ForumSubreddit[];
  onCreated: (post: ForumPost) => void;
}) {
  const [type, setType] = useState<'text' | 'link'>('text');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [selectedSub, setSelectedSub] = useState(subredditName ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (subredditName) setSelectedSub(subredditName);
  }, [subredditName]);

  const handleClose = () => {
    setTitle('');
    setBody('');
    setUrl('');
    setError('');
    onClose();
  };

  const submit = async () => {
    if (!title.trim() || !selectedSub) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await forumApi.createPost({
        title,
        body: type === 'text' ? body : undefined,
        url: type === 'link' ? url : undefined,
        type,
        subredditName: selectedSub,
      });
      onCreated(data);
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer un post</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* forum selector */}
          {!subredditName && (
            <select
              value={selectedSub}
              onChange={(e) => setSelectedSub(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Choisir un forum...</option>
              {subreddits.map((s) => (
                <option key={s.id} value={s.name}>#{s.name}</option>
              ))}
            </select>
          )}

          {/* Type tabs */}
          <div className="flex rounded-md border">
            <button
              className={cn('flex-1 py-2 text-sm font-medium transition-colors', type === 'text' ? 'bg-muted' : 'hover:bg-muted/50')}
              onClick={() => setType('text')}
            >
              Texte
            </button>
            <button
              className={cn('flex-1 py-2 text-sm font-medium transition-colors', type === 'link' ? 'bg-muted' : 'hover:bg-muted/50')}
              onClick={() => setType('link')}
            >
              Lien
            </button>
          </div>

          <Input
            placeholder="Titre"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={300}
          />

          {type === 'text' ? (
            <Textarea
              placeholder="Texte (optionnel)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
            />
          ) : (
            <Input
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>Annuler</Button>
            <Button onClick={submit} disabled={loading || !title.trim() || !selectedSub}>
              {loading ? 'Envoi...' : 'Publier'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create forum dialog ──────────────────────────────────────────────────

function CreateSubredditDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (sub: ForumSubreddit) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setName('');
    setDescription('');
    setError('');
    onClose();
  };

  const submit = async () => {
    if (!name.trim() || !description.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await forumApi.createSubreddit({ name, description });
      onCreated(data);
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un forum</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Input
              placeholder="Nom (ex: AuraTracker)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={21}
            />
            <p className="mt-1 text-xs text-muted-foreground">3–21 caractères, lettres, chiffres et underscores uniquement</p>
          </div>
          <Textarea
            placeholder="Description du forum..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>Annuler</Button>
            <Button onClick={submit} disabled={loading || !name.trim() || !description.trim()}>
              {loading ? 'Création...' : 'Créer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

type SortMode = 'hot' | 'new' | 'top';

const SORT_LABELS = {
  hot: 'Tendance',
  new: 'Nouveau',
  top: 'Top',
};

export default function Forum() {
  const { subredditName } = useParams<{ subredditName?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [subreddits, setSubreddits] = useState<ForumSubreddit[]>([]);
  const [currentSub, setCurrentSub] = useState<ForumSubreddit | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [sort, setSort] = useState<SortMode>('hot');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingSubs, setLoadingSubs] = useState(true);

  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateSub, setShowCreateSub] = useState(false);

  // Load forums
  useEffect(() => {
    forumApi.getSubreddits().then(({ data }) => {
      setSubreddits(data);
      setLoadingSubs(false);
    });
  }, []);

  // Load current forum info
  useEffect(() => {
    if (!subredditName) {
      setCurrentSub(null);
      return;
    }
    forumApi.getSubreddit(subredditName).then(({ data }) => setCurrentSub(data)).catch(() => navigate('/forum'));
  }, [subredditName, navigate]);

  const loadPosts = useCallback(async (p: number, s: SortMode, reset: boolean) => {
    setLoadingPosts(true);
    try {
      const { data } = await forumApi.getPosts({ subreddit: subredditName, sort: s, page: p });
      setPosts((prev) => (reset ? data : [...prev, ...data]));
      setHasMore(data.length === 20);
    } finally {
      setLoadingPosts(false);
    }
  }, [subredditName]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadPosts(1, sort, true);
  }, [subredditName, sort, loadPosts]);

  const handleVote = async (postId: string, value: number) => {
    try {
      const { data } = await forumApi.votePost(postId, value);
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, score: data.score, userVote: data.userVote } : p))
      );
    } catch {}
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Supprimer ce post ?')) return;
    try {
      await forumApi.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {}
  };

  const handleJoin = async (subName: string) => {
    try {
      const { data } = await forumApi.toggleJoin(subName);
      setSubreddits((prev) =>
        prev.map((s) =>
          s.name === subName
            ? { ...s, isJoined: data.joined, memberCount: s.memberCount + (data.joined ? 1 : -1) }
            : s
        )
      );
      if (currentSub?.name === subName) {
        setCurrentSub((prev) =>
          prev ? { ...prev, isJoined: data.joined, memberCount: prev.memberCount + (data.joined ? 1 : -1) } : prev
        );
      }
    } catch {}
  };

  const handleSubCreated = (sub: ForumSubreddit) => {
    setSubreddits((prev) => [sub, ...prev]);
    navigate(`/forum/c/${sub.name}`);
  };

  const handlePostCreated = (post: ForumPost) => {
    if (sort === 'new') {
      setPosts((prev) => [post, ...prev]);
    }
    navigate(`/forum/c/${post.subreddit.name}/post/${post.id}`);
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    loadPosts(next, sort, false);
  };

  const joinedSubs = subreddits.filter((s) => s.isJoined);
  const popularSubs = [...subreddits].sort((a, b) => b.memberCount - a.memberCount).slice(0, 10);

  return (
    <PageShell size="wide" className="pb-10">
      <div className="flex gap-6">
        {/* ── Main feed ── */}
        <div className="min-w-0 flex-1">
          {/* forum header */}
          {currentSub && (
            <div className="mb-4 rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-2xl font-bold text-white">
                    {currentSub.icon ? (
                      <span>{currentSub.icon}</span>
                    ) : (
                      currentSub.name[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="mb-2">
                      <button
                        onClick={() => navigate('/forum')}
                        className="flex items-center gap-2 rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Tous les forums
                      </button>
                    </div>
                    <h1 className="text-xl font-bold">#{currentSub.name}</h1>
                    <p className="text-sm text-muted-foreground">{currentSub.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {currentSub.memberCount.toLocaleString()}
                  </span>
                  <Button
                    variant={currentSub.isJoined ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => handleJoin(currentSub.name)}
                  >
                    {currentSub.isJoined ? 'Quitté' : 'Rejoindre'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Sort bar + Create post */}
          <div className="mb-3 flex items-center gap-2">
            <Tabs value={sort} onValueChange={(v) => setSort(v as SortMode)}>
              <TabsList className="border-border/60 bg-muted/20">
                {(Object.keys(SORT_LABELS) as SortMode[]).map((s) => (
                  <TabsTrigger key={s} value={s} className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground">
                    {SORT_LABELS[s]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => setShowCreatePost(true)}
              disabled={!currentSub && subreddits.length === 0}
            >
              <Plus className="mr-1 h-4 w-4" />
              Nouveau post
            </Button>
          </div>

          {/* Posts list */}
          <div className="space-y-2">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                showSubreddit={!subredditName}
                onVote={handleVote}
                onDelete={handleDelete}
                currentUserId={user!.id}
                isAdmin={user!.isAdmin}
              />
            ))}

            {loadingPosts && (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 rounded-lg border bg-card p-3">
                  <div className="flex flex-col items-center gap-1">
                    <Skeleton className="h-5 w-5" />
                    <Skeleton className="h-4 w-6" />
                    <Skeleton className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              ))
            )}

            {!loadingPosts && posts.length === 0 && (
              <div className="rounded-lg border bg-card p-8 text-center">
                <p className="text-muted-foreground">Aucun post pour l'instant.</p>
                <Button className="mt-3" size="sm" onClick={() => setShowCreatePost(true)}>
                  <Plus className="mr-1 h-4 w-4" />
                  Créer le premier post
                </Button>
              </div>
            )}

            {hasMore && posts.length > 0 && !loadingPosts && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" size="sm" onClick={loadMore}>
                  Charger plus
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <aside className="hidden w-72 shrink-0 lg:block">
          {/* Create buttons */}
          <div className="mb-4 space-y-2">
            <Button className="w-full" onClick={() => setShowCreatePost(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Créer un post
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setShowCreateSub(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Créer un forum
            </Button>
          </div>

          {/* My forums */}
          {joinedSubs.length > 0 && (
            <div className="mb-4 rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Mes forums</h3>
              <ul className="space-y-1">
                {joinedSubs.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/forum/c/${s.name}`}
                      className={cn(
                        'flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-muted',
                        subredditName === s.name && 'bg-muted font-medium'
                      )}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                        {s.name[0].toUpperCase()}
                      </span>
                      #{s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Popular forums */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Forums populaires</h3>
            {loadingSubs ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : popularSubs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun forum pour l'instant.</p>
            ) : (
              <ul className="space-y-2">
                {popularSubs.map((s, idx) => (
                  <li key={s.id}>
                    <Link
                      to={`/forum/c/${s.name}`}
                      className={cn(
                        'flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-muted',
                        subredditName === s.name && 'bg-muted font-medium'
                      )}
                    >
                      <span className="w-4 text-xs text-muted-foreground">{idx + 1}</span>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                        {s.name[0].toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate">#{s.name}</span>
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {s.memberCount}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* Dialogs */}
      <CreatePostDialog
        open={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        subredditName={subredditName}
        subreddits={subreddits}
        onCreated={handlePostCreated}
      />
      <CreateSubredditDialog
        open={showCreateSub}
        onClose={() => setShowCreateSub(false)}
        onCreated={handleSubCreated}
      />
    </PageShell>
  );
}
