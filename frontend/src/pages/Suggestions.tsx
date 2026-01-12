import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { suggestionsApi, Suggestion } from '../services/api';
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
import { cn } from '@/lib/utils';

export default function Suggestions() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

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
      const res = await suggestionsApi.create({
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim() || undefined,
      });
      setSuggestions((prev) => [res.data.suggestion, ...prev]);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-12">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-light tracking-tight">Suggestions</h1>
          <p className="text-muted-foreground">
            Proposez vos idées et votez pour les meilleures
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="h-12 w-12 shrink-0">
              <Plus className="h-5 w-5" />
            </Button>
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
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="URL de l'image (optionnel)"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="h-12 bg-transparent border-border/50 pl-10"
                  />
                </div>
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

      {/* Suggestions List */}
      {suggestions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg">Aucune suggestion pour le moment</p>
          <p className="text-muted-foreground/60 mt-1">
            Soyez le premier à proposer une idée !
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
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
                      </p>
                    </div>

                    {/* Delete button for author or admin */}
                    {(suggestion.user.id === user?.id || user?.isAdmin) && (
                      <button
                        onClick={() => handleDelete(suggestion.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <p className="mt-3 text-muted-foreground whitespace-pre-wrap break-words">
                    {suggestion.description}
                  </p>

                  {suggestion.imageUrl && (
                    <div className="mt-4">
                      <img
                        src={suggestion.imageUrl}
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
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
