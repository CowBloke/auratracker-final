import { useEffect, useState, useCallback } from 'react';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, MessageSquare, Plus, Trash2, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { forumApi, ForumSubreddit, ForumPost } from '@/services/api';
import { VoteButtons } from '@/components/forum/VoteButtons';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// ─── Post card ───────────────────────────────────────────────────────────

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
  const postPath = `/forum/c/${post.subreddit.name}/post/${post.id}`;

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {showSubreddit ? (
            <Link to={`/forum/c/${post.subreddit.name}`} className="font-semibold text-foreground hover:underline">
              #{post.subreddit.name}
            </Link>
          ) : null}
          <span>
            posté par{' '}
            <Link to={`/profile/${post.author.id}`} className="hover:underline" style={{ color: post.author.usernameColor ?? undefined }}>
              @{post.author.username}
            </Link>
          </span>
          <span>{age}</span>
        </CardDescription>
        <CardTitle>
          <Button variant="link" size="xs" type="button" onClick={() => navigate(postPath)} className="justify-start text-left">
            {post.title}
          </Button>
        </CardTitle>
      </CardHeader>
      {(post.type === 'link' && post.url) || (post.type === 'text' && post.body) ? (
        <CardContent>
          {post.type === 'link' && post.url ? (
            <a href={post.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm underline-offset-4 hover:underline">
              <ExternalLink className="size-4" />
              {post.url}
            </a>
          ) : (
            <p className="line-clamp-3 text-sm text-muted-foreground">{post.body}</p>
          )}
        </CardContent>
      ) : null}
      <CardFooter className="flex flex-wrap items-center gap-2">
        <VoteButtons score={post.score} userVote={post.userVote} onVote={(value) => onVote(post.id, value)} />
        <Button variant="ghost" size="sm" onClick={() => navigate(postPath)}>
          <MessageSquare />
          {post.commentCount} commentaire{post.commentCount !== 1 ? 's' : ''}
        </Button>
        {post.author.id === currentUserId || isAdmin ? (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(post.id)}>
            <Trash2 />
            Supprimer
          </Button>
        ) : null}
      </CardFooter>
    </Card>
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
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer un post</DialogTitle>
          <DialogDescription>Partagez un texte ou un lien avec la communauté.</DialogDescription>
        </DialogHeader>

        <FieldGroup>
          {!subredditName ? (
            <Field>
              <FieldLabel htmlFor="post-forum">Forum</FieldLabel>
              <Select value={selectedSub} onValueChange={setSelectedSub}>
                <SelectTrigger id="post-forum" className="w-full">
                  <SelectValue placeholder="Choisir un forum…" />
                </SelectTrigger>
                <SelectContent>
                  {subreddits.map((sub) => (
                    <SelectItem key={sub.id} value={sub.name}>
                      #{sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <ToggleGroup type="single" variant="outline" value={type} onValueChange={(value) => value && setType(value as 'text' | 'link')} className="w-full">
            <ToggleGroupItem value="text" className="flex-1">
              Texte
            </ToggleGroupItem>
            <ToggleGroupItem value="link" className="flex-1">
              Lien
            </ToggleGroupItem>
          </ToggleGroup>

          <Field>
            <FieldLabel htmlFor="post-title">Titre</FieldLabel>
            <Input id="post-title" placeholder="Titre" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} />
          </Field>

          {type === 'text' ? (
            <Field>
              <FieldLabel htmlFor="post-body">Texte (optionnel)</FieldLabel>
              <Textarea id="post-body" value={body} onChange={(event) => setBody(event.target.value)} rows={5} />
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="post-url">Lien</FieldLabel>
              <Input id="post-url" placeholder="https://…" value={url} onChange={(event) => setUrl(event.target.value)} />
            </Field>
          )}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={loading || !title.trim() || !selectedSub}>
            {loading ? <Spinner /> : null}
            Publier
          </Button>
        </DialogFooter>
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
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un forum</DialogTitle>
          <DialogDescription>Créez un espace de discussion thématique.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="forum-name">Nom</FieldLabel>
            <Input id="forum-name" placeholder="Nom (ex : AuraTracker)" value={name} onChange={(event) => setName(event.target.value)} maxLength={21} />
            <FieldDescription>3 à 21 caractères : lettres, chiffres et underscores uniquement.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="forum-description">Description</FieldLabel>
            <Textarea id="forum-description" placeholder="Description du forum…" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </Field>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={loading || !name.trim() || !description.trim()}>
            {loading ? <Spinner /> : null}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────

type SortMode = 'hot' | 'new' | 'top';

const SORT_LABELS = {
  hot: 'Tendance',
  new: 'Nouveau',
  top: 'Top',
};

function ForumLink({ sub, active, rank }: { sub: ForumSubreddit; active: boolean; rank?: number }) {
  return (
    <Item asChild size="sm" variant={active ? 'muted' : 'default'}>
      <Link to={`/forum/c/${sub.name}`}>
        {rank ? <span className="w-4 text-xs text-muted-foreground">{rank}</span> : null}
        <ItemMedia>
          <Avatar className="size-6">
            <AvatarFallback className="text-xs">{sub.name[0].toUpperCase()}</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="truncate">#{sub.name}</ItemTitle>
        </ItemContent>
        {rank ? (
          <ItemActions>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3" />
              {sub.memberCount}
            </span>
          </ItemActions>
        ) : null}
      </Link>
    </Item>
  );
}

export default function Forum() {
  const { subredditName } = useParams<{ subredditName?: string }>();
  const { user } = useAuth();
  const { confirm } = useAppDialog();
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
    if (!(await confirm({ title: 'Supprimer ce post ?', description: 'Cette action est irréversible.', confirmLabel: 'Supprimer' }))) return;
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
    <PageShell>
      <PageHeader
        title={currentSub ? `#${currentSub.name}` : 'Forum'}
        description={currentSub ? currentSub.description : 'Discutez avec la communauté dans des forums thématiques.'}
        actions={
          <>
            {currentSub ? (
              <>
                <Button variant="ghost" onClick={() => navigate('/forum')}>
                  <ArrowLeft />
                  Tous les forums
                </Button>
                <Badge variant="secondary">
                  <Users />
                  {currentSub.memberCount.toLocaleString()}
                </Badge>
                <Button variant={currentSub.isJoined ? 'outline' : 'default'} onClick={() => handleJoin(currentSub.name)}>
                  {currentSub.isJoined ? 'Quitter' : 'Rejoindre'}
                </Button>
              </>
            ) : null}
            <Button onClick={() => setShowCreatePost(true)} disabled={!currentSub && subreddits.length === 0}>
              <Plus />
              Nouveau post
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Tabs value={sort} onValueChange={(value) => setSort(value as SortMode)}>
            <TabsList>
              {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                <TabsTrigger key={mode} value={mode}>
                  {SORT_LABELS[mode]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

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

          {loadingPosts
            ? Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-36 w-full" />)
            : null}

          {!loadingPosts && posts.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>Aucun post</EmptyTitle>
                <EmptyDescription>Aucun post pour l&apos;instant.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setShowCreatePost(true)}>
                  <Plus />
                  Créer le premier post
                </Button>
              </EmptyContent>
            </Empty>
          ) : null}

          {hasMore && posts.length > 0 && !loadingPosts ? (
            <Button variant="outline" className="self-center" onClick={loadMore}>
              Charger plus
            </Button>
          ) : null}
        </div>

        <aside className="hidden flex-col gap-4 lg:flex">
          <Button variant="outline" onClick={() => setShowCreateSub(true)}>
            <Plus />
            Créer un forum
          </Button>

          {joinedSubs.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mes forums</CardTitle>
              </CardHeader>
              <CardContent>
                <ItemGroup>
                  {joinedSubs.map((sub) => (
                    <ForumLink key={sub.id} sub={sub} active={subredditName === sub.name} />
                  ))}
                </ItemGroup>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Forums populaires</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSubs ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Skeleton key={index} className="h-8 w-full" />
                  ))}
                </div>
              ) : popularSubs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun forum pour l&apos;instant.</p>
              ) : (
                <ItemGroup>
                  {popularSubs.map((sub, index) => (
                    <ForumLink key={sub.id} sub={sub} active={subredditName === sub.name} rank={index + 1} />
                  ))}
                </ItemGroup>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <CreatePostDialog
        open={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        subredditName={subredditName}
        subreddits={subreddits}
        onCreated={handlePostCreated}
      />
      <CreateSubredditDialog open={showCreateSub} onClose={() => setShowCreateSub(false)} onCreated={handleSubCreated} />
    </PageShell>
  );
}
