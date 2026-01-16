import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { suggestionsApi, uploadsApi, Suggestion } from '../services/api';
import { ChevronUp, ChevronDown, Loader2, Plus, ImageIcon, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { readFileAsDataUrl } from '@/lib/uploads';
import { resolveImageUrl } from '@/lib/images';

export default function Suggestions() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});
  const [commentDeleting, setCommentDeleting] = useState<Record<string, boolean>>({});
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [ratingInputs, setRatingInputs] = useState<Record<string, number>>({});
  const [ratingSubmitting, setRatingSubmitting] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'pending' | 'done'>('pending');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const res = await suggestionsApi.getAll();
      setSuggestions(res.data.suggestions);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setSubmitting(true);
    try {
      let uploadedUrl: string | undefined;
      if (imageInputMode === 'upload' && imageDataUrl) {
        const uploadRes = await uploadsApi.uploadImage({
          purpose: 'suggestion',
          imageData: imageDataUrl,
        });
        uploadedUrl = uploadRes.data.url;
      }
      if (imageInputMode === 'url' && imageUrl.trim()) {
        uploadedUrl = imageUrl.trim();
      }

      const res = await suggestionsApi.create({
        title: title.trim(),
        description: description.trim(),
        imageUrl: uploadedUrl,
      });
      setSuggestions((prev) => [res.data.suggestion, ...prev]);
      setTitle('');
      setDescription('');
      setImageDataUrl('');
      setImageUrl('');
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to create suggestion:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (suggestionId: string, value: number) => {
    const suggestion = suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return;

    // If clicking the same vote, remove it
    const newValue = suggestion.userVote === value ? 0 : value;

    // Optimistic update
    setSuggestions((prev) =>
      prev.map((s) => {
        if (s.id !== suggestionId) return s;

        let newUpvotes = s.upvotes;
        let newDownvotes = s.downvotes;

        // Remove old vote effect
        if (s.userVote === 1) newUpvotes--;
        if (s.userVote === -1) newDownvotes--;

        // Add new vote effect
        if (newValue === 1) newUpvotes++;
        if (newValue === -1) newDownvotes++;

        return {
          ...s,
          upvotes: newUpvotes,
          downvotes: newDownvotes,
          score: newUpvotes - newDownvotes,
          userVote: newValue,
        };
      })
    );

    try {
      await suggestionsApi.vote(suggestionId, newValue);
    } catch (error) {
      console.error('Failed to vote:', error);
      // Revert on error
      fetchSuggestions();
    }
  };

  const handleDelete = async (suggestionId: string) => {
    try {
      await suggestionsApi.delete(suggestionId);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    } catch (error) {
      console.error('Failed to delete suggestion:', error);
    }
  };

  const handleCommentChange = (suggestionId: string, value: string) => {
    setCommentInputs((prev) => ({ ...prev, [suggestionId]: value }));
  };

  const handleCommentSubmit = async (suggestionId: string) => {
    const content = commentInputs[suggestionId]?.trim();
    if (!content) return;

    setCommentSubmitting((prev) => ({ ...prev, [suggestionId]: true }));
    try {
      const res = await suggestionsApi.addComment(suggestionId, { content });
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === suggestionId
            ? { ...s, comments: [...s.comments, res.data.comment] }
            : s
        )
      );
      setCommentInputs((prev) => ({ ...prev, [suggestionId]: '' }));
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setCommentSubmitting((prev) => ({ ...prev, [suggestionId]: false }));
    }
  };

  const handleCommentDelete = async (suggestionId: string, commentId: string) => {
    setCommentDeleting((prev) => ({ ...prev, [commentId]: true }));
    try {
      await suggestionsApi.deleteComment(suggestionId, commentId);
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === suggestionId
            ? { ...s, comments: s.comments.filter((c) => c.id !== commentId) }
            : s
        )
      );
    } catch (error) {
      console.error('Failed to delete comment:', error);
    } finally {
      setCommentDeleting((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  const handleStatusUpdate = async (suggestionId: string, status: 'PENDING' | 'DONE') => {
    setStatusUpdating((prev) => ({ ...prev, [suggestionId]: true }));
    try {
      const res = await suggestionsApi.updateStatus(suggestionId, status);
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === suggestionId
            ? {
                ...s,
                status: res.data.status,
                resolvedAt: res.data.resolvedAt,
                averageRating: res.data.averageRating,
                ratingCount: res.data.ratingCount,
                userRating: res.data.userRating,
              }
            : s
        )
      );
    } catch (error) {
      console.error('Failed to update suggestion status:', error);
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [suggestionId]: false }));
    }
  };

  const handleRatingSubmit = async (suggestionId: string) => {
    const suggestion = suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return;

    const ratingValue = ratingInputs[suggestionId] ?? suggestion.userRating ?? 5;
    setRatingSubmitting((prev) => ({ ...prev, [suggestionId]: true }));
    try {
      const res = await suggestionsApi.rate(suggestionId, ratingValue);
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === suggestionId
            ? {
                ...s,
                averageRating: res.data.averageRating,
                ratingCount: res.data.ratingCount,
                userRating: res.data.userRating,
              }
            : s
        )
      );
    } catch (error) {
      console.error('Failed to rate suggestion:', error);
    } finally {
      setRatingSubmitting((prev) => ({ ...prev, [suggestionId]: false }));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingSuggestions = suggestions.filter((suggestion) => suggestion.status === 'PENDING');
  const doneSuggestions = suggestions.filter((suggestion) => suggestion.status === 'DONE');

  const renderSuggestions = (items: Suggestion[], showRatings: boolean) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg">
            {showRatings ? 'Aucune suggestion réalisée pour le moment' : 'Aucune suggestion active'}
          </p>
          <p className="text-muted-foreground/60 mt-1">
            {showRatings ? 'Revenez plus tard pour noter les mises à jour !' : 'Soyez le premier à proposer une idée !'}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {items.map((suggestion) => {
          const ratingValue = ratingInputs[suggestion.id] ?? suggestion.userRating ?? 5;

          return (
            <article
              key={suggestion.id}
              className="group relative bg-card/30 border border-border/40 rounded-lg overflow-hidden hover:border-border/60 transition-colors"
            >
              <div className="flex">
                {/* Vote Column */}
                <div className="flex flex-col items-center py-4 px-3 bg-muted/20 border-r border-border/30">
                  <button
                    onClick={() => handleVote(suggestion.id, 1)}
                    className={cn(
                      'p-1 rounded hover:bg-muted/50 transition-colors',
                      suggestion.userVote === 1 && 'text-emerald-500'
                    )}
                  >
                    <ChevronUp className="h-5 w-5" />
                  </button>
                  <span
                    className={cn(
                      'text-lg font-medium tabular-nums py-1',
                      suggestion.score > 0 && 'text-emerald-500',
                      suggestion.score < 0 && 'text-rose-500'
                    )}
                  >
                    {suggestion.score}
                  </span>
                  <button
                    onClick={() => handleVote(suggestion.id, -1)}
                    className={cn(
                      'p-1 rounded hover:bg-muted/50 transition-colors',
                      suggestion.userVote === -1 && 'text-rose-500'
                    )}
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-4 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-medium leading-tight">{suggestion.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        par{' '}
                        <span
                          style={
                            suggestion.user.usernameColor
                              ? { color: suggestion.user.usernameColor }
                              : undefined
                          }
                        >
                          {suggestion.user.username}
                        </span>
                        {' · '}
                        {formatDate(suggestion.createdAt)}
                        {suggestion.resolvedAt && (
                          <>
                            {' · '}
                            réalisée le {formatDate(suggestion.resolvedAt)}
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {user?.isAdmin && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleStatusUpdate(
                              suggestion.id,
                              suggestion.status === 'DONE' ? 'PENDING' : 'DONE'
                            )
                          }
                          disabled={statusUpdating[suggestion.id]}
                        >
                          {statusUpdating[suggestion.id] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : suggestion.status === 'DONE' ? (
                            'Remettre en cours'
                          ) : (
                            'Marquer comme réalisée'
                          )}
                        </Button>
                      )}

                      {/* Delete button for author or admin */}
                      {(suggestion.user.id === user?.id || user?.isAdmin) && (
                        <button
                          onClick={() => handleDelete(suggestion.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive transition-all"
                          aria-label="Supprimer la suggestion"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-muted-foreground whitespace-pre-wrap break-words">
                    {suggestion.description}
                  </p>

                  {suggestion.imageUrl && (
                    <div className="mt-4">
                      <img
                        src={resolveImageUrl(suggestion.imageUrl)}
                        alt={suggestion.title}
                        className="max-h-64 rounded-md object-cover border border-border/30"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Vote stats */}
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground/60">
                    <span className="flex items-center gap-1">
                      <ChevronUp className="h-3 w-3" />
                      {suggestion.upvotes}
                    </span>
                    <span className="flex items-center gap-1">
                      <ChevronDown className="h-3 w-3" />
                      {suggestion.downvotes}
                    </span>
                  </div>

                  {showRatings && (
                    <div className="mt-6 border-t border-border/30 pt-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground/70">
                        <span>
                          {suggestion.ratingCount > 0 && suggestion.averageRating !== null
                            ? `Note moyenne: ${suggestion.averageRating.toFixed(1)}/10 (${suggestion.ratingCount})`
                            : 'Pas encore de note'}
                        </span>
                        <span>Votre note: {ratingValue}/10</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <Slider
                          value={[ratingValue]}
                          min={1}
                          max={10}
                          step={1}
                          onValueChange={(value) =>
                            setRatingInputs((prev) => ({ ...prev, [suggestion.id]: value[0] }))
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleRatingSubmit(suggestion.id)}
                          disabled={ratingSubmitting[suggestion.id]}
                        >
                          {ratingSubmitting[suggestion.id] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Noter'
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Comments */}
                  <div className="mt-6 border-t border-border/30 pt-4 space-y-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground/60">
                      <span>Commentaires ({suggestion.comments.length})</span>
                    </div>

                    {suggestion.comments.length > 0 && (
                      <div className="space-y-3">
                        {suggestion.comments.map((comment) => (
                          <div key={comment.id} className="flex gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                                <span
                                  style={
                                    comment.user.usernameColor
                                      ? { color: comment.user.usernameColor }
                                      : undefined
                                  }
                                >
                                  {comment.user.username}
                                </span>
                                <span>·</span>
                                <span>{formatDateTime(comment.createdAt)}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                                {comment.content}
                              </p>
                            </div>

                            {(comment.user.id === user?.id || user?.isAdmin) && (
                              <button
                                onClick={() => handleCommentDelete(suggestion.id, comment.id)}
                                className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                                disabled={commentDeleting[comment.id]}
                                aria-label="Supprimer le commentaire"
                              >
                                {commentDeleting[comment.id] ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Textarea
                        value={commentInputs[suggestion.id] || ''}
                        onChange={(e) => handleCommentChange(suggestion.id, e.target.value)}
                        placeholder="Ajouter un commentaire..."
                        maxLength={500}
                        className="min-h-[80px] bg-transparent border-border/50 resize-none"
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground/60">
                        <span>{(commentInputs[suggestion.id] || '').length}/500</span>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleCommentSubmit(suggestion.id)}
                          disabled={
                            commentSubmitting[suggestion.id] ||
                            !(commentInputs[suggestion.id] || '').trim()
                          }
                        >
                          {commentSubmitting[suggestion.id] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Commenter'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground tracking-wide uppercase">
            Proposez vos idées
          </p>
          <h1 className="text-5xl md:text-7xl font-light tracking-tight">Suggestions</h1>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setImageDataUrl('');
              setImageUrl('');
              setImageInputMode('upload');
            }
          }}
        >
          <DialogTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors">
              <Plus className="h-4 w-4" />
              Créer
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-light">Nouvelle suggestion</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Input
                  placeholder="Titre de la suggestion"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  className="h-12 bg-transparent border-border/50"
                  required
                />
              </div>
              <div className="space-y-2">
                <Textarea
                  placeholder="Description détaillée..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  className="min-h-[120px] bg-transparent border-border/50 resize-none"
                  required
                />
                <p className="text-xs text-muted-foreground/60 text-right tabular-nums">
                  {description.length}/2000
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={imageInputMode === 'upload' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setImageInputMode('upload')}
                  >
                    Upload
                  </Button>
                  <Button
                    type="button"
                    variant={imageInputMode === 'url' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setImageInputMode('url')}
                  >
                    URL
                  </Button>
                </div>
                {imageInputMode === 'upload' ? (
                  <>
                    <div className="relative">
                      <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="file"
                        accept="image/*"
                        className="h-12 bg-transparent border-border/50 pl-10"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) {
                            setImageDataUrl('');
                            return;
                          }
                          try {
                            const dataUrl = await readFileAsDataUrl(file);
                            setImageDataUrl(dataUrl);
                          } catch (error) {
                            console.error('Failed to read image:', error);
                            setImageDataUrl('');
                          }
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <Input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-12 bg-transparent border-border/50"
                  />
                )}
                {(imageInputMode === 'upload' ? imageDataUrl : imageUrl) && (
                  <div className="relative">
                    <img
                      src={imageInputMode === 'upload' ? imageDataUrl : imageUrl}
                      alt="Preview"
                      className="max-h-40 rounded-md object-cover border border-border/30"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageDataUrl('');
                        setImageUrl('');
                      }}
                      className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center bg-background/80 border border-border rounded-full text-muted-foreground hover:text-foreground"
                      aria-label="Retirer l'image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting || !title.trim() || !description.trim()}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Publier'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {/* Divider */}
      <div className="h-px bg-border" />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'pending' | 'done')}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="pending">Suggestions ({pendingSuggestions.length})</TabsTrigger>
          <TabsTrigger value="done">Réalisées ({doneSuggestions.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">{renderSuggestions(pendingSuggestions, false)}</TabsContent>
        <TabsContent value="done">{renderSuggestions(doneSuggestions, true)}</TabsContent>
      </Tabs>
    </div>
  );
}
