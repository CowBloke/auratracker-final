import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { suggestionsApi, Suggestion, uploadUserImage } from '../services/api';
import { ImagePicker } from '@/components/ui/image-picker';
import { ChevronUp, ChevronDown, Loader2, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { prepareImageUploadPayload } from '@/lib/image-upload';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { PageShell } from '@/components/layout/PageShell';
import { ViewModeSwitcher } from '@/components/ui/view-mode-switcher';

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
        <div className="text-center py-16">
          <p className={cn(TYPOGRAPHY.H5, "text-muted-foreground")}>
            {emptyTitle}
          </p>
          <p className={cn(TYPOGRAPHY.MUTED, "mt-1")}>
            {emptySubtitle}
          </p>
        </div>
      );
    }

    return (
      <div className={cn(SPACING.CARD_SPACING, viewMode === 'grid' && 'grid grid-cols-1 gap-4 xl:grid-cols-3')}>
        {items.map((suggestion) => {
          const ratingValue = ratingInputs[suggestion.id] ?? suggestion.userRating ?? 5;

          return (
            <Card
              key={suggestion.id}
              id={`suggestion-${suggestion.id}`}
              className={cn('group hover:border-border/60 transition-colors', viewMode === 'grid' && 'h-full')}
            >
              <div className={cn('flex', viewMode === 'grid' && 'h-full flex-col')}>
                {/* Vote Column */}
                <div
                  className={cn(
                    'flex items-center bg-muted/20 border-border/30',
                    viewMode === 'list'
                      ? 'flex-col px-3 py-4 border-r'
                      : 'gap-1 border-b px-4 py-3'
                  )}
                >
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
                      viewMode === 'grid' && 'min-w-[3ch] text-center',
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
                            {suggestion.status === 'DONE' ? 'réalisée le ' : 'non réalisée le '}
                            {formatDate(suggestion.resolvedAt)}
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {user?.isAdmin && (
                        <div className="flex flex-wrap items-center gap-2">
                          {statusUpdating[suggestion.id] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          {suggestion.status !== 'PENDING' && (
                            <Button
                              type="button"
                              onClick={() => handleStatusUpdate(suggestion.id, 'PENDING')}
                              disabled={statusUpdating[suggestion.id]}
                              variant="outline"
                              size="sm"
                              className="text-xs"
                            >
                              Remettre en cours
                            </Button>
                          )}
                          {suggestion.status !== 'DONE' && (
                            <Button
                              type="button"
                              onClick={() => handleStatusUpdate(suggestion.id, 'DONE')}
                              disabled={statusUpdating[suggestion.id]}
                              variant="outline"
                              size="sm"
                              className="text-xs"
                            >
                              Marquer réalisée
                            </Button>
                          )}
                          {suggestion.status !== 'REJECTED' && (
                            <Button
                              type="button"
                              onClick={() => handleStatusUpdate(suggestion.id, 'REJECTED')}
                              disabled={statusUpdating[suggestion.id]}
                              variant="outline"
                              size="sm"
                              className="text-xs text-rose-500 border-rose-500/40 hover:text-rose-400"
                            >
                              Marquer non réalisée
                            </Button>
                          )}
                        </div>
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
                          className={cn('rounded-md object-cover', viewMode === 'grid' ? 'h-56 w-full' : 'max-h-64')}
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
      <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8 space-y-8">
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
          {/* Tab Selector */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'done' | 'rejected')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="pending">
                  Suggestions ({filteredPendingSuggestions.length})
                </TabsTrigger>
                <TabsTrigger value="done">
                  Réalisées ({filteredDoneSuggestions.length})
                </TabsTrigger>
                <TabsTrigger value="rejected">
                  Non réalisées ({filteredRejectedSuggestions.length})
                </TabsTrigger>
              </TabsList>

              <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row">
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={
                    activeTab === 'pending'
                      ? 'Rechercher une suggestion'
                      : activeTab === 'done'
                        ? 'Rechercher une réalisation'
                        : 'Rechercher une suggestion non réalisée'
                  }
                  className="lg:w-[250px]"
                />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 shrink-0" />
                        <span className="truncate">filtres ({activeFiltersCount})</span>
                      </span>
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

                <ViewModeSwitcher value={viewMode} onChange={setViewMode} />

                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer
                </Button>
              </div>
            </div>

            {/* Content */}
            <TabsContent value="pending" className={SPACING.SECTION_SPACING}>
              {renderSuggestions(filteredPendingSuggestions, {
                showRatings: false,
                emptyTitle: 'Aucune suggestion active',
                emptySubtitle: 'Soyez le premier à proposer une idée !',
              })}
            </TabsContent>
            <TabsContent value="done" className={SPACING.SECTION_SPACING}>
              {renderSuggestions(filteredDoneSuggestions, {
                showRatings: true,
                emptyTitle: 'Aucune suggestion réalisée pour le moment',
                emptySubtitle: 'Revenez plus tard pour noter les mises à jour !',
              })}
            </TabsContent>
            <TabsContent value="rejected" className={SPACING.SECTION_SPACING}>
              {renderSuggestions(filteredRejectedSuggestions, {
                showRatings: false,
                emptyTitle: 'Aucune suggestion non réalisée',
                emptySubtitle: 'Les suggestions refusées apparaîtront ici.',
              })}
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
              <ImagePicker
                value={imageUrl}
                onChange={setImageUrl}
                uploadFn={uploadSuggestionImageFile}
              />
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
