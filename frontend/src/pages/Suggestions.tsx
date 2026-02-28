import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { suggestionsApi, Suggestion } from '../services/api';
import { ChevronUp, ChevronDown, Loader2, Plus, Trash2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { PageShell } from '@/components/layout/page-shell';

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
  const [imageUrl, setImageUrl] = useState('');

  // Calculate boost based on suggestion age
  const calculateBoost = (createdAt: string, status: string): number => {
    if (status !== 'PENDING') return 0;
    
    const now = new Date();
    const created = new Date(createdAt);
    const ageInMs = now.getTime() - created.getTime();
    const ageInHours = ageInMs / (1000 * 60 * 60);
    
    if (ageInHours < 24) {
      return 5; // Boost of +5 for suggestions less than 24 hours old
    } else if (ageInHours < 48) {
      return 2; // Boost of +2 for suggestions between 24-48 hours old
    }
    
    return 0;
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const res = await suggestionsApi.getAll();
      // Ensure suggestions are sorted by boosted score
      const sorted = [...res.data.suggestions].sort((a, b) => {
        const aBoosted = a.boostedScore ?? a.score + (a.boost ?? calculateBoost(a.createdAt, a.status));
        const bBoosted = b.boostedScore ?? b.score + (b.boost ?? calculateBoost(b.createdAt, b.status));
        if (bBoosted !== aBoosted) {
          return bBoosted - aBoosted;
        }
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setSuggestions(sorted);
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
      const uploadedUrl = imageUrl.trim() || undefined;

      const res = await suggestionsApi.create({
        title: title.trim(),
        description: description.trim(),
        imageUrl: uploadedUrl,
      });
      // Add boost to new suggestion
      const newSuggestion = {
        ...res.data.suggestion,
        boost: calculateBoost(res.data.suggestion.createdAt, res.data.suggestion.status),
        boostedScore: res.data.suggestion.score + calculateBoost(res.data.suggestion.createdAt, res.data.suggestion.status),
      };
      setSuggestions((prev) => {
        const updated = [newSuggestion, ...prev];
        // Re-sort by boosted score
        return updated.sort((a, b) => {
          const aBoosted = a.boostedScore ?? a.score + (a.boost ?? calculateBoost(a.createdAt, a.status));
          const bBoosted = b.boostedScore ?? b.score + (b.boost ?? calculateBoost(b.createdAt, b.status));
          if (bBoosted !== aBoosted) {
            return bBoosted - aBoosted;
          }
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      });
      setTitle('');
      setDescription('');
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
    setSuggestions((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== suggestionId) return s;

        let newUpvotes = s.upvotes;
        let newDownvotes = s.downvotes;

        // Remove old vote effect
        if (s.userVote === 1) newUpvotes--;
        if (s.userVote === -1) newDownvotes--;

        // Add new vote effect
        if (newValue === 1) newUpvotes++;
        if (newValue === -1) newDownvotes++;

        const newScore = newUpvotes - newDownvotes;
        const boost = calculateBoost(s.createdAt, s.status);
        const boostedScore = newScore + boost;

        return {
          ...s,
          upvotes: newUpvotes,
          downvotes: newDownvotes,
          score: newScore,
          boostedScore,
          boost,
          userVote: newValue,
        };
      });

      // Re-sort by boosted score
      return updated.sort((a, b) => {
        const aBoosted = a.boostedScore ?? a.score + (a.boost ?? 0);
        const bBoosted = b.boostedScore ?? b.score + (b.boost ?? 0);
        if (bBoosted !== aBoosted) {
          return bBoosted - aBoosted;
        }
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });

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
          <p className={cn(TYPOGRAPHY.H5, "text-muted-foreground")}>
            {showRatings ? 'Aucune suggestion réalisée pour le moment' : 'Aucune suggestion active'}
          </p>
          <p className={cn(TYPOGRAPHY.MUTED, "mt-1")}>
            {showRatings ? 'Revenez plus tard pour noter les mises à jour !' : 'Soyez le premier à proposer une idée !'}
          </p>
        </div>
      );
    }

    return (
      <div className={SPACING.CARD_SPACING}>
        {items.map((suggestion) => {
          const ratingValue = ratingInputs[suggestion.id] ?? suggestion.userRating ?? 5;

          return (
            <Card
              key={suggestion.id}
              className="group hover:border-border/60 transition-colors"
            >
              <div className="flex">
                {/* Vote Column */}
                <div className="flex flex-col items-center py-4 px-3 bg-muted/20 border-r border-border/30">
                  <Button
                    onClick={() => handleVote(suggestion.id, 1)}
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-7 w-7',
                      suggestion.userVote === 1 && 'text-emerald-500'
                    )}
                  >
                    <ChevronUp className="h-5 w-5" />
                  </Button>
                  <span
                    className={cn(
                      TYPOGRAPHY.H5,
                      'tabular-nums py-1',
                      suggestion.score > 0 && 'text-emerald-500',
                      suggestion.score < 0 && 'text-rose-500'
                    )}
                  >
                    {suggestion.score}
                  </span>
                  <Button
                    onClick={() => handleVote(suggestion.id, -1)}
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-7 w-7',
                      suggestion.userVote === -1 && 'text-rose-500'
                    )}
                  >
                    <ChevronDown className="h-5 w-5" />
                  </Button>
                </div>

                {/* Content */}
                <CardContent className="flex-1 p-4 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className={TYPOGRAPHY.H5}>{suggestion.title}</h3>
                        {suggestion.boost && suggestion.boost > 0 && (
                          <span className={cn(TYPOGRAPHY.XS, "px-2 py-0.5 font-medium bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded")}>
                            Nouveau
                          </span>
                        )}
                      </div>
                      <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground mt-1")}>
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
                          onClick={() =>
                            handleStatusUpdate(
                              suggestion.id,
                              suggestion.status === 'DONE' ? 'PENDING' : 'DONE'
                            )
                          }
                          disabled={statusUpdating[suggestion.id]}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          {statusUpdating[suggestion.id] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : null}
                          {suggestion.status === 'DONE' ? 'Remettre en cours' : 'Marquer comme réalisée'}
                        </Button>
                      )}

                      {/* Delete button for author or admin */}
                      {(suggestion.user.id === user?.id || user?.isAdmin) && (
                        <Button
                          onClick={() => handleDelete(suggestion.id)}
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 h-8 w-8 text-muted-foreground hover:text-destructive"
                          aria-label="Supprimer la suggestion"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className={cn("mt-3 whitespace-pre-wrap break-words", TYPOGRAPHY.MUTED)}>
                    {suggestion.description}
                  </p>

                  {suggestion.imageUrl && (
                    <Card className="mt-4 ">
                      <CardContent className="p-0">
                        <img
                          src={resolveImageUrl(suggestion.imageUrl)}
                          alt={suggestion.title}
                          className="max-h-64 rounded-md object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Vote stats */}
                  <div className={cn("mt-4 flex items-center gap-4", TYPOGRAPHY.XS, "text-muted-foreground/60")}>
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
                    <div className={cn("mt-6 border-t border-border/30 pt-4", SPACING.CARD_SPACING)}>
                      <div className={cn("flex flex-wrap items-center justify-between gap-2", TYPOGRAPHY.XS, "text-muted-foreground/70")}>
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
                          onClick={() => handleRatingSubmit(suggestion.id)}
                          disabled={ratingSubmitting[suggestion.id]}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          {ratingSubmitting[suggestion.id] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : null}
                          Noter
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Comments */}
                  <div className={cn("mt-6 border-t border-border/30 pt-4", SPACING.CARD_SPACING)}>
                    <div className={cn("flex items-center justify-between", TYPOGRAPHY.XS, "text-muted-foreground/60")}>
                      <span>Commentaires ({suggestion.comments.length})</span>
                    </div>

                    {suggestion.comments.length > 0 && (
                      <div className="space-y-3">
                        {suggestion.comments.map((comment) => (
                          <Card key={comment.id}>
                            <CardContent className="p-3">
                              <div className="flex gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className={cn("flex items-center gap-2", TYPOGRAPHY.XS, "text-muted-foreground/70")}>
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
                                  <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground mt-1 whitespace-pre-wrap break-words")}>
                                    {comment.content}
                                  </p>
                                </div>

                                {(comment.user.id === user?.id || user?.isAdmin) && (
                                  <Button
                                    onClick={() => handleCommentDelete(suggestion.id, comment.id)}
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    disabled={commentDeleting[comment.id]}
                                    aria-label="Supprimer le commentaire"
                                  >
                                    {commentDeleting[comment.id] ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <X className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
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
                      <div className={cn("flex items-center justify-between", TYPOGRAPHY.XS, "text-muted-foreground/60")}>
                        <span>{(commentInputs[suggestion.id] || '').length}/500</span>
                        <Button
                          type="button"
                          onClick={() => handleCommentSubmit(suggestion.id)}
                          disabled={
                            commentSubmitting[suggestion.id] ||
                            !(commentInputs[suggestion.id] || '').trim()
                          }
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          {commentSubmitting[suggestion.id] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : null}
                          Commenter
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
            );
          })}
        </div>
      );
    };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-8 space-y-8">
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
        </div>
      </div>
    );
  }

    return (
      <>
        <PageShell>
        <div className={SPACING.PAGE_CONTENT}>
          <div className="flex items-center justify-between gap-3">
            <p className={TYPOGRAPHY.SMALL}>Propose une idée ou consulte l’avancement des demandes.</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Créer
            </Button>
          </div>

          {/* Tab Selector */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'done')}>
            <TabsList>
              <TabsTrigger value="pending">
                Suggestions ({pendingSuggestions.length})
              </TabsTrigger>
              <TabsTrigger value="done">
                Réalisées ({doneSuggestions.length})
              </TabsTrigger>
            </TabsList>

            {/* Content */}
            <TabsContent value="pending" className={SPACING.SECTION_SPACING}>
              {renderSuggestions(pendingSuggestions, false)}
            </TabsContent>
            <TabsContent value="done" className={SPACING.SECTION_SPACING}>
              {renderSuggestions(doneSuggestions, true)}
            </TabsContent>
          </Tabs>
        </div>
      </PageShell>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setImageUrl('');
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className={TYPOGRAPHY.H4}>Nouvelle suggestion</DialogTitle>
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
              <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground/60 text-right tabular-nums")}>
                {description.length}/2000
              </p>
            </div>
            <div className="space-y-2">
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="h-12 bg-transparent border-border/50"
              />
              {imageUrl && (
                <div className="relative">
                  <Card>
                    <CardContent className="p-0">
                      <img
                        src={imageUrl}
                        alt="Preview"
                        className="max-h-40 rounded-md object-cover"
                      />
                    </CardContent>
                  </Card>
                  <Button
                    type="button"
                    onClick={() => {
                      setImageUrl('');
                    }}
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 bg-background/80"
                    aria-label="Retirer l'image"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                onClick={() => setDialogOpen(false)}
                variant="outline"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={submitting || !title.trim() || !description.trim()}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Publier
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
