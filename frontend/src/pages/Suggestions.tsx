import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, LayoutGrid, List, MessageSquare, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { suggestionsApi, Suggestion, uploadUserImage } from '../services/api';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { ImagePicker } from '@/components/ui/image-picker';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { prepareImageUploadPayload } from '@/lib/image-upload';

type PendingSortOption = 'trending' | 'newest' | 'top' | 'discussed';
type DoneSortOption = 'recently-done' | 'best-rated' | 'most-rated' | 'discussed';
type RejectedSortOption = 'recently-updated' | 'newest' | 'top' | 'discussed';
type ParticipationFilter = 'all' | 'mine' | 'voted' | 'commented';
type ContentFilter = 'all' | 'with-image' | 'without-image' | 'boosted';
type FeedbackFilter = 'all' | 'rated' | 'to-rate' | 'with-comments';
type RejectedFilter = 'all' | 'with-image' | 'without-image' | 'with-comments';
type SuggestionsViewMode = 'list' | 'grid';

const SUGGESTIONS_VIEW_STORAGE_KEY = 'auratracker:suggestions-view-mode';

const PENDING_SORT_LABELS: Record<PendingSortOption, string> = {
  trending: 'Tendance',
  newest: 'Plus récentes',
  top: 'Mieux votées',
  discussed: 'Plus discutées',
};

const DONE_SORT_LABELS: Record<DoneSortOption, string> = {
  'recently-done': 'Réalisées récemment',
  'best-rated': 'Mieux notées',
  'most-rated': 'Plus notées',
  discussed: 'Plus discutées',
};

const REJECTED_SORT_LABELS: Record<RejectedSortOption, string> = {
  'recently-updated': 'Mises à jour récemment',
  newest: 'Plus récentes',
  top: 'Mieux votées',
  discussed: 'Plus discutées',
};

const CONTENT_FILTER_LABELS: Record<ContentFilter, string> = {
  all: 'Tous les formats',
  'with-image': 'Avec image',
  'without-image': 'Sans image',
  boosted: 'Nouvelles en avant',
};

const FEEDBACK_FILTER_LABELS: Record<FeedbackFilter, string> = {
  all: 'Tous les retours',
  rated: 'Déjà notées',
  'to-rate': 'À noter',
  'with-comments': 'Avec commentaires',
};

const REJECTED_FILTER_LABELS: Record<RejectedFilter, string> = {
  all: 'Toutes',
  'with-image': 'Avec image',
  'without-image': 'Sans image',
  'with-comments': 'Avec commentaires',
};

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
  const [activeTab, setActiveTab] = useState<'pending' | 'done' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingSortBy, setPendingSortBy] = useState<PendingSortOption>('trending');
  const [doneSortBy, setDoneSortBy] = useState<DoneSortOption>('recently-done');
  const [rejectedSortBy, setRejectedSortBy] = useState<RejectedSortOption>('recently-updated');
  const [participationFilter, setParticipationFilter] = useState<ParticipationFilter>('all');
  const [pendingContentFilter, setPendingContentFilter] = useState<ContentFilter>('all');
  const [doneFeedbackFilter, setDoneFeedbackFilter] = useState<FeedbackFilter>('all');
  const [rejectedFilter, setRejectedFilter] = useState<RejectedFilter>('all');
  const [viewMode, setViewMode] = useState<SuggestionsViewMode>(() => {
    if (typeof window === 'undefined') return 'list';
    const stored = window.localStorage.getItem(SUGGESTIONS_VIEW_STORAGE_KEY);
    return stored === 'grid' ? 'grid' : 'list';
  });

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

  const sortPendingSuggestions = (items: Suggestion[]) =>
    [...items].sort((a, b) => {
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

  const sortDoneSuggestions = (items: Suggestion[]) =>
    [...items].sort((a, b) => {
      const aResolvedAt = a.resolvedAt ? new Date(a.resolvedAt).getTime() : 0;
      const bResolvedAt = b.resolvedAt ? new Date(b.resolvedAt).getTime() : 0;
      if (bResolvedAt !== aResolvedAt) {
        return bResolvedAt - aResolvedAt;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const getPendingSuggestionsSorted = (items: Suggestion[], sortBy: PendingSortOption) => {
    if (sortBy === 'trending') {
      return sortPendingSuggestions(items);
    }

    return [...items].sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'top') {
        return b.score - a.score || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return b.comments.length - a.comments.length || b.score - a.score;
    });
  };

  const getDoneSuggestionsSorted = (items: Suggestion[], sortBy: DoneSortOption) => {
    if (sortBy === 'recently-done') {
      return sortDoneSuggestions(items);
    }

    return [...items].sort((a, b) => {
      if (sortBy === 'best-rated') {
        return (b.averageRating ?? 0) - (a.averageRating ?? 0) || b.ratingCount - a.ratingCount;
      }
      if (sortBy === 'most-rated') {
        return b.ratingCount - a.ratingCount || (b.averageRating ?? 0) - (a.averageRating ?? 0);
      }
      return b.comments.length - a.comments.length || b.ratingCount - a.ratingCount;
    });
  };

  const getRejectedSuggestionsSorted = (items: Suggestion[], sortBy: RejectedSortOption) => {
    return [...items].sort((a, b) => {
      if (sortBy === 'recently-updated') {
        const aResolvedAt = a.resolvedAt ? new Date(a.resolvedAt).getTime() : 0;
        const bResolvedAt = b.resolvedAt ? new Date(b.resolvedAt).getTime() : 0;
        return bResolvedAt - aResolvedAt || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'top') {
        return b.score - a.score || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return b.comments.length - a.comments.length || b.score - a.score;
    });
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SUGGESTIONS_VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  // Handle scroll to suggestion from notification link
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const searchParams = new URLSearchParams(window.location.search);
    const suggestionId = searchParams.get('suggestionId');
    
    if (suggestionId) {
      // Wait a bit for the page to render before scrolling
      const timeoutId = setTimeout(() => {
        const element = document.getElementById(`suggestion-${suggestionId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Remove the query parameter from URL
          window.history.replaceState({}, '', window.location.pathname);
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, []);


  const fetchSuggestions = async () => {
    try {
      const res = await suggestionsApi.getAll();
      const sorted = [
        ...sortPendingSuggestions(res.data.suggestions.filter((suggestion) => suggestion.status === 'PENDING')),
        ...sortDoneSuggestions(res.data.suggestions.filter((suggestion) => suggestion.status === 'DONE')),
        ...sortDoneSuggestions(res.data.suggestions.filter((suggestion) => suggestion.status === 'REJECTED')),
      ];
      setSuggestions(sorted);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const uploadSuggestionImageFile = async (file: File): Promise<string> => {
    const { base64Data, mimeType } = await prepareImageUploadPayload(file);
    const res = await uploadUserImage({ base64Data, mimeType });
    return res.data.imageUrl;
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
        return [
          ...sortPendingSuggestions(updated.filter((suggestion) => suggestion.status === 'PENDING')),
          ...sortDoneSuggestions(updated.filter((suggestion) => suggestion.status === 'DONE')),
          ...sortDoneSuggestions(updated.filter((suggestion) => suggestion.status === 'REJECTED')),
        ];
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

      return [
        ...sortPendingSuggestions(updated.filter((suggestion) => suggestion.status === 'PENDING')),
        ...sortDoneSuggestions(updated.filter((suggestion) => suggestion.status === 'DONE')),
        ...sortDoneSuggestions(updated.filter((suggestion) => suggestion.status === 'REJECTED')),
      ];
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

  const handleStatusUpdate = async (suggestionId: string, status: 'PENDING' | 'DONE' | 'REJECTED') => {
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

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const activeSortLabel =
    activeTab === 'pending'
      ? PENDING_SORT_LABELS[pendingSortBy]
      : activeTab === 'done'
        ? DONE_SORT_LABELS[doneSortBy]
        : REJECTED_SORT_LABELS[rejectedSortBy];
  const activeSecondaryFilterLabel =
    activeTab === 'pending'
      ? CONTENT_FILTER_LABELS[pendingContentFilter]
      : activeTab === 'done'
        ? FEEDBACK_FILTER_LABELS[doneFeedbackFilter]
        : REJECTED_FILTER_LABELS[rejectedFilter];
  const defaultSortLabel =
    activeTab === 'pending'
      ? PENDING_SORT_LABELS.trending
      : activeTab === 'done'
        ? DONE_SORT_LABELS['recently-done']
        : REJECTED_SORT_LABELS['recently-updated'];
  const defaultSecondaryFilterLabel =
    activeTab === 'pending'
      ? CONTENT_FILTER_LABELS.all
      : activeTab === 'done'
        ? FEEDBACK_FILTER_LABELS.all
        : REJECTED_FILTER_LABELS.all;
  const activeFiltersCount =
    (activeSortLabel !== defaultSortLabel ? 1 : 0) +
    (participationFilter !== 'all' ? 1 : 0) +
    (activeSecondaryFilterLabel !== defaultSecondaryFilterLabel ? 1 : 0);

  const matchesParticipationFilter = (suggestion: Suggestion) => {
    if (!user) return participationFilter === 'all';
    if (participationFilter === 'mine') return suggestion.user.id === user.id;
    if (participationFilter === 'voted') return suggestion.userVote !== 0;
    if (participationFilter === 'commented') {
      return suggestion.comments.some((comment) => comment.user.id === user.id);
    }
    return true;
  };

  const matchesSearchQuery = (suggestion: Suggestion) => {
    if (!normalizedSearchQuery) return true;

    const searchableText = [
      suggestion.title,
      suggestion.description,
      suggestion.user.username,
      ...suggestion.comments.map((comment) => `${comment.user.username} ${comment.content}`),
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedSearchQuery);
  };

  const filteredPendingSuggestions = useMemo(() => {
    const filtered = suggestions.filter((suggestion) => {
      if (suggestion.status !== 'PENDING') return false;
      if (!matchesParticipationFilter(suggestion)) return false;
      if (!matchesSearchQuery(suggestion)) return false;
      if (pendingContentFilter === 'with-image' && !suggestion.imageUrl) return false;
      if (pendingContentFilter === 'without-image' && suggestion.imageUrl) return false;
      if (pendingContentFilter === 'boosted' && !(suggestion.boost && suggestion.boost > 0)) return false;
      return true;
    });

    return getPendingSuggestionsSorted(filtered, pendingSortBy);
  }, [suggestions, participationFilter, normalizedSearchQuery, pendingContentFilter, pendingSortBy, user?.id]);

  const filteredDoneSuggestions = useMemo(() => {
    const filtered = suggestions.filter((suggestion) => {
      if (suggestion.status !== 'DONE') return false;
      if (!matchesParticipationFilter(suggestion)) return false;
      if (!matchesSearchQuery(suggestion)) return false;
      if (doneFeedbackFilter === 'rated' && suggestion.ratingCount === 0) return false;
      if (doneFeedbackFilter === 'to-rate' && suggestion.userRating !== null) return false;
      if (doneFeedbackFilter === 'with-comments' && suggestion.comments.length === 0) return false;
      return true;
    });

    return getDoneSuggestionsSorted(filtered, doneSortBy);
  }, [suggestions, participationFilter, normalizedSearchQuery, doneFeedbackFilter, doneSortBy, user?.id]);

  const filteredRejectedSuggestions = useMemo(() => {
    const filtered = suggestions.filter((suggestion) => {
      if (suggestion.status !== 'REJECTED') return false;
      if (!matchesParticipationFilter(suggestion)) return false;
      if (!matchesSearchQuery(suggestion)) return false;
      if (rejectedFilter === 'with-image' && !suggestion.imageUrl) return false;
      if (rejectedFilter === 'without-image' && suggestion.imageUrl) return false;
      if (rejectedFilter === 'with-comments' && suggestion.comments.length === 0) return false;
      return true;
    });

    return getRejectedSuggestionsSorted(filtered, rejectedSortBy);
  }, [suggestions, participationFilter, normalizedSearchQuery, rejectedFilter, rejectedSortBy, user?.id]);

  const renderSuggestions = (
    items: Suggestion[],
    options: {
      showRatings: boolean;
      emptyTitle: string;
      emptySubtitle: string;
    }
  ) => {
    const { showRatings, emptyTitle, emptySubtitle } = options;
    if (items.length === 0) {
      return (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription>{emptySubtitle}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    return (
      <div className={cn('flex flex-col gap-6', viewMode === 'grid' && 'grid grid-cols-1 xl:grid-cols-3')}>
        {items.map((suggestion) => {
          const ratingValue = ratingInputs[suggestion.id] ?? suggestion.userRating ?? 5;
          const canDelete = suggestion.user.id === user?.id || user?.isAdmin;

          return (
            <Card key={suggestion.id} id={`suggestion-${suggestion.id}`}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {suggestion.title}
                  {suggestion.boost && suggestion.boost > 0 ? <Badge variant="warning">Nouveau</Badge> : null}
                </CardTitle>
                <CardDescription>
                  par{' '}
                  <span style={suggestion.user.usernameColor ? { color: suggestion.user.usernameColor } : undefined}>
                    {suggestion.user.username}
                  </span>
                  {' · '}
                  {formatDate(suggestion.createdAt)}
                  {suggestion.resolvedAt ? (
                    <>
                      {' · '}
                      {suggestion.status === 'DONE' ? 'réalisée le ' : 'non réalisée le '}
                      {formatDate(suggestion.resolvedAt)}
                    </>
                  ) : null}
                </CardDescription>
                <CardAction className="flex items-center gap-1">
                  <div className="flex items-center rounded-md border">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => handleVote(suggestion.id, 1)}
                          variant={suggestion.userVote === 1 ? 'secondary' : 'ghost'}
                          size="icon-sm"
                          aria-label="Voter pour"
                          aria-pressed={suggestion.userVote === 1}
                        >
                          <ChevronUp />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{suggestion.upvotes} pour</TooltipContent>
                    </Tooltip>
                    <span
                      className={cn(
                        'min-w-8 text-center text-sm font-semibold tabular-nums',
                        suggestion.score > 0 && 'text-success',
                        suggestion.score < 0 && 'text-destructive'
                      )}
                    >
                      {suggestion.score}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => handleVote(suggestion.id, -1)}
                          variant={suggestion.userVote === -1 ? 'secondary' : 'ghost'}
                          size="icon-sm"
                          aria-label="Voter contre"
                          aria-pressed={suggestion.userVote === -1}
                        >
                          <ChevronDown />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{suggestion.downvotes} contre</TooltipContent>
                    </Tooltip>
                  </div>
                  {canDelete ? (
                    <Button onClick={() => handleDelete(suggestion.id)} variant="ghost" size="icon-sm" aria-label="Supprimer la suggestion">
                      <Trash2 />
                    </Button>
                  ) : null}
                </CardAction>
              </CardHeader>

              <CardContent className="flex flex-col gap-4">
                <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{suggestion.description}</p>

                {suggestion.imageUrl ? (
                  <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-md border">
                    <img
                      src={resolveImageUrl(suggestion.imageUrl)}
                      alt={suggestion.title}
                      className="size-full object-cover"
                      onError={(event) => {
                        (event.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </AspectRatio>
                ) : null}

                {user?.isAdmin ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {statusUpdating[suggestion.id] ? <Spinner /> : null}
                    {suggestion.status !== 'PENDING' ? (
                      <Button type="button" onClick={() => handleStatusUpdate(suggestion.id, 'PENDING')} disabled={statusUpdating[suggestion.id]} variant="outline" size="sm">
                        Remettre en cours
                      </Button>
                    ) : null}
                    {suggestion.status !== 'DONE' ? (
                      <Button type="button" onClick={() => handleStatusUpdate(suggestion.id, 'DONE')} disabled={statusUpdating[suggestion.id]} variant="outline" size="sm">
                        Marquer réalisée
                      </Button>
                    ) : null}
                    {suggestion.status !== 'REJECTED' ? (
                      <Button type="button" onClick={() => handleStatusUpdate(suggestion.id, 'REJECTED')} disabled={statusUpdating[suggestion.id]} variant="destructive" size="sm">
                        Marquer non réalisée
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {showRatings ? (
                  <>
                    <Separator />
                    <Field>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <FieldLabel htmlFor={`rating-${suggestion.id}`}>
                          {suggestion.ratingCount > 0 && suggestion.averageRating !== null
                            ? `Note moyenne : ${suggestion.averageRating.toFixed(1)}/10 (${suggestion.ratingCount})`
                            : 'Pas encore de note'}
                        </FieldLabel>
                        <span className="text-muted-foreground">Votre note : {ratingValue}/10</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Slider
                          id={`rating-${suggestion.id}`}
                          value={[ratingValue]}
                          min={1}
                          max={10}
                          step={1}
                          onValueChange={(value) => setRatingInputs((prev) => ({ ...prev, [suggestion.id]: value[0] }))}
                        />
                        <Button type="button" onClick={() => handleRatingSubmit(suggestion.id)} disabled={ratingSubmitting[suggestion.id]} variant="outline" size="sm">
                          {ratingSubmitting[suggestion.id] ? <Spinner /> : null}
                          Noter
                        </Button>
                      </div>
                    </Field>
                  </>
                ) : null}

                <Separator />
                <section className="flex flex-col gap-3">
                  <h4 className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="size-4" />
                    Commentaires ({suggestion.comments.length})
                  </h4>

                  {suggestion.comments.length > 0 ? (
                    <ItemGroup>
                      {suggestion.comments.map((comment, index) => (
                        <div key={comment.id}>
                          {index > 0 ? <ItemSeparator /> : null}
                          <Item size="sm">
                            <ItemContent>
                              <ItemDescription className="flex items-center gap-2">
                                <span style={comment.user.usernameColor ? { color: comment.user.usernameColor } : undefined}>
                                  {comment.user.username}
                                </span>
                                <span>·</span>
                                <span>{formatDateTime(comment.createdAt)}</span>
                              </ItemDescription>
                              <ItemTitle className="whitespace-pre-wrap break-words font-normal">{comment.content}</ItemTitle>
                            </ItemContent>
                            {comment.user.id === user?.id || user?.isAdmin ? (
                              <ItemActions>
                                <Button
                                  onClick={() => handleCommentDelete(suggestion.id, comment.id)}
                                  variant="ghost"
                                  size="icon-xs"
                                  disabled={commentDeleting[comment.id]}
                                  aria-label="Supprimer le commentaire"
                                >
                                  {commentDeleting[comment.id] ? <Spinner /> : <X />}
                                </Button>
                              </ItemActions>
                            ) : null}
                          </Item>
                        </div>
                      ))}
                    </ItemGroup>
                  ) : null}

                  <Field>
                    <Textarea
                      value={commentInputs[suggestion.id] || ''}
                      onChange={(event) => handleCommentChange(suggestion.id, event.target.value)}
                      placeholder="Ajouter un commentaire…"
                      maxLength={500}
                      rows={3}
                      aria-label="Ajouter un commentaire"
                    />
                    <div className="flex items-center justify-between">
                      <FieldDescription>{(commentInputs[suggestion.id] || '').length}/500</FieldDescription>
                      <Button
                        type="button"
                        onClick={() => handleCommentSubmit(suggestion.id)}
                        disabled={commentSubmitting[suggestion.id] || !(commentInputs[suggestion.id] || '').trim()}
                        variant="outline"
                        size="sm"
                      >
                        {commentSubmitting[suggestion.id] ? <Spinner /> : null}
                        Commenter
                      </Button>
                    </div>
                  </Field>
                </section>
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground">
                {suggestion.upvotes} pour · {suggestion.downvotes} contre
              </CardFooter>
            </Card>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <PageShell>
        <PageHeader />
        <div className="flex flex-col gap-6">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-56 w-full" />
          ))}
        </div>
      </PageShell>
    );
  }

  const searchPlaceholder =
    activeTab === 'pending' ? 'Rechercher une suggestion' : activeTab === 'done' ? 'Rechercher une réalisation' : 'Rechercher une suggestion non réalisée';

  return (
    <>
      <PageShell>
        <PageHeader
          actions={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus />
              Créer
            </Button>
          }
        />

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'pending' | 'done' | 'rejected')} className="gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="pending">Suggestions ({filteredPendingSuggestions.length})</TabsTrigger>
              <TabsTrigger value="done">Réalisées ({filteredDoneSuggestions.length})</TabsTrigger>
              <TabsTrigger value="rejected">Non réalisées ({filteredRejectedSuggestions.length})</TabsTrigger>
            </TabsList>

            <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row">
              <InputGroup className="lg:w-64">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={searchPlaceholder} />
              </InputGroup>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <SlidersHorizontal />
                    Filtres ({activeFiltersCount})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Tri</DropdownMenuLabel>
                  {activeTab === 'pending' ? (
                    <DropdownMenuRadioGroup value={pendingSortBy} onValueChange={(value) => setPendingSortBy(value as PendingSortOption)}>
                      <DropdownMenuRadioItem value="trending">Tendance</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="newest">Plus récentes</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="top">Mieux votées</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="discussed">Plus discutées</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  ) : activeTab === 'done' ? (
                    <DropdownMenuRadioGroup value={doneSortBy} onValueChange={(value) => setDoneSortBy(value as DoneSortOption)}>
                      <DropdownMenuRadioItem value="recently-done">Réalisées récemment</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="best-rated">Mieux notées</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="most-rated">Plus notées</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="discussed">Plus discutées</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  ) : (
                    <DropdownMenuRadioGroup value={rejectedSortBy} onValueChange={(value) => setRejectedSortBy(value as RejectedSortOption)}>
                      <DropdownMenuRadioItem value="recently-updated">Mises à jour récemment</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="newest">Plus récentes</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="top">Mieux votées</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="discussed">Plus discutées</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Participation</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      <DropdownMenuRadioGroup value={participationFilter} onValueChange={(value) => setParticipationFilter(value as ParticipationFilter)}>
                        <DropdownMenuRadioItem value="all">Toute la communauté</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="mine">Mes suggestions</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="voted">J&apos;ai voté</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="commented">J&apos;ai commenté</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>{activeTab === 'done' ? 'Retours' : 'Contenu'}</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      {activeTab === 'pending' ? (
                        <DropdownMenuRadioGroup value={pendingContentFilter} onValueChange={(value) => setPendingContentFilter(value as ContentFilter)}>
                          <DropdownMenuRadioItem value="all">Tous les formats</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="with-image">Avec image</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="without-image">Sans image</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="boosted">Nouvelles en avant</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      ) : activeTab === 'done' ? (
                        <DropdownMenuRadioGroup value={doneFeedbackFilter} onValueChange={(value) => setDoneFeedbackFilter(value as FeedbackFilter)}>
                          <DropdownMenuRadioItem value="all">Tous les retours</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="rated">Déjà notées</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="to-rate">À noter</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="with-comments">Avec commentaires</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      ) : (
                        <DropdownMenuRadioGroup value={rejectedFilter} onValueChange={(value) => setRejectedFilter(value as RejectedFilter)}>
                          <DropdownMenuRadioItem value="all">Toutes</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="with-image">Avec image</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="without-image">Sans image</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="with-comments">Avec commentaires</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>

              <ToggleGroup type="single" variant="outline" value={viewMode} onValueChange={(value) => value && setViewMode(value as SuggestionsViewMode)}>
                <ToggleGroupItem value="list" aria-label="Vue liste">
                  <List />
                </ToggleGroupItem>
                <ToggleGroupItem value="grid" aria-label="Vue grille">
                  <LayoutGrid />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <TabsContent value="pending">
            {renderSuggestions(filteredPendingSuggestions, {
              showRatings: false,
              emptyTitle: 'Aucune suggestion active',
              emptySubtitle: 'Soyez le premier à proposer une idée !',
            })}
          </TabsContent>
          <TabsContent value="done">
            {renderSuggestions(filteredDoneSuggestions, {
              showRatings: true,
              emptyTitle: 'Aucune suggestion réalisée pour le moment',
              emptySubtitle: 'Revenez plus tard pour noter les mises à jour !',
            })}
          </TabsContent>
          <TabsContent value="rejected">
            {renderSuggestions(filteredRejectedSuggestions, {
              showRatings: false,
              emptyTitle: 'Aucune suggestion non réalisée',
              emptySubtitle: 'Les suggestions refusées apparaîtront ici.',
            })}
          </TabsContent>
        </Tabs>
      </PageShell>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setImageUrl('');
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle suggestion</DialogTitle>
            <DialogDescription>Décrivez votre idée pour que la communauté puisse voter.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="suggestion-title">Titre</FieldLabel>
                <Input id="suggestion-title" placeholder="Titre de la suggestion" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="suggestion-description">Description</FieldLabel>
                <Textarea
                  id="suggestion-description"
                  placeholder="Description détaillée…"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2000}
                  rows={5}
                  required
                />
                <FieldDescription className="text-right tabular-nums">{description.length}/2000</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Image (optionnel)</FieldLabel>
                <ImagePicker value={imageUrl} onChange={setImageUrl} uploadFn={uploadSuggestionImageFile} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" onClick={() => setDialogOpen(false)} variant="outline">
                Annuler
              </Button>
              <Button type="submit" disabled={submitting || !title.trim() || !description.trim()}>
                {submitting ? <Spinner /> : null}
                Publier
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
