import { useState, useEffect, useRef } from 'react';
import { 
  ThumbsUp, 
  ThumbsDown, 
  Share2, 
  MoreHorizontal, 
  Send, 
  Star, 
  ArrowLeft,
  Loader2,
  CheckCircle2,
  User as UserIcon,
  Play
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { youApi, type YoutubeVideo, type YoutubeVideoComment } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function YoutubeWatch({ 
  videoId, 
  onBack,
  onVideoClick 
}: { 
  videoId: string; 
  onBack: () => void;
  onVideoClick: (video: YoutubeVideo) => void;
}) {
  const [video, setVideo] = useState<YoutubeVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentContent, setCommentContent] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<YoutubeVideo[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [viewCounted, setViewCounted] = useState(false);

  useEffect(() => {
    fetchData();
    // Increment view after 5 seconds
    const timer = setTimeout(() => {
      if (!viewCounted) {
        youApi.incrementVideoViews(videoId).catch(() => {});
        setViewCounted(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [videoId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [detailsRes, globalRes] = await Promise.all([
        youApi.getYoutubeVideoDetails(videoId),
        youApi.getGlobalYoutubeVideos()
      ]);
      setVideo(detailsRes.data.video);
      setRelatedVideos(globalRes.data.videos.filter(v => v.id !== videoId).slice(0, 10));
    } catch (err) {
      toast.error('Impossible de charger la vidéo.');
      onBack();
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (isLike: boolean) => {
    if (!video) return;
    try {
      const res = await youApi.toggleYoutubeVideoLike(video.id, isLike);
      // Optimistic update
      setVideo(prev => {
        if (!prev) return null;
        let newLikes = prev.likesCount ?? 0;
        let newDislikes = prev.dislikesCount ?? 0;
        
        if (res.data.action === 'created') {
          if (isLike) newLikes++; else newDislikes++;
        } else if (res.data.action === 'removed') {
          if (isLike) newLikes--; else newDislikes--;
        } else if (res.data.action === 'updated') {
          if (isLike) { newLikes++; newDislikes--; } else { newLikes--; newDislikes++; }
        }

        return {
          ...prev,
          likesCount: newLikes,
          dislikesCount: newDislikes,
          userLike: res.data.action === 'removed' ? null : isLike
        };
      });
    } catch (err) {
      toast.error('Erreur lors du like/dislike.');
    }
  };

  const handleSubmitComment = async () => {
    if (!video || !commentContent.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await youApi.addYoutubeVideoComment(video.id, {
        content: commentContent.trim(),
        rating: rating ?? undefined
      });
      setVideo(prev => prev ? {
        ...prev,
        comments: [res.data.comment, ...(prev.comments ?? [])]
      } : null);
      setCommentContent('');
      setRating(null);
      toast.success('Commentaire ajouté !');
    } catch (err) {
      toast.error('Erreur lors de l\'ajout du commentaire.');
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading || !video) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const videoUrl = `${import.meta.env.VITE_API_URL}${video.videoPath}`;

  return (
    <div className="flex flex-col lg:flex-row gap-6 pb-20 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="sticky top-0 z-10 bg-background lg:static">
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour
          </Button>
          
          {/* Player Wrapper */}
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-border/20 group">
             <video 
               ref={videoRef}
               src={videoUrl} 
               controls 
               autoPlay
               className="w-full h-full"
             />
          </div>
        </div>

        <div className="mt-5 px-1">
          <h1 className="text-xl font-bold leading-tight">{video.title}</h1>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
            {/* Channel Info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-border/50 bg-muted flex-shrink-0">
                {video.business?.logoUrl ? (
                  <img src={video.business.logoUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                    {video.business?.name?.charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-sm">{video.business?.name}</span>
                  {video.business?.verified && <CheckCircle2 className="w-3 h-3 text-primary fill-primary/10" />}
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Business Créateur</p>
              </div>
              <Button size="sm" className="ml-4 rounded-full px-5 h-9 font-semibold transition-all hover:scale-105">
                Suivre
              </Button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted/50 rounded-full h-9 p-1 border border-border/40">
                <button 
                  onClick={() => handleLike(true)}
                  className={cn(
                    "flex items-center gap-2 px-4 h-full rounded-l-full hover:bg-muted transition-colors text-xs font-semibold",
                    video.userLike === true && "text-primary"
                  )}
                >
                  <ThumbsUp className={cn("w-4 h-4", video.userLike === true && "fill-current")} />
                  {video.likesCount}
                </button>
                <div className="w-px h-4 bg-border/50" />
                <button 
                  onClick={() => handleLike(false)}
                  className={cn(
                    "flex items-center px-4 h-full rounded-r-full hover:bg-muted transition-colors text-xs",
                    video.userLike === false && "text-destructive"
                  )}
                >
                  <ThumbsDown className={cn("w-4 h-4", video.userLike === false && "fill-current")} />
                </button>
              </div>

              <Button variant="secondary" size="sm" className="rounded-full h-9 px-4 gap-2 border border-border/40">
                <Share2 className="w-4 h-4" /> Partager
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 border border-border/40">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Description Box */}
          <div className="mt-5 p-4 rounded-2xl bg-muted/30 border border-border/40 hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-3 text-xs font-semibold mb-2">
               <span>{video.views.toLocaleString('fr-FR')} vues</span>
               <span>{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true, locale: fr })}</span>
            </div>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {video.description || 'Aucune description fournie.'}
            </p>
          </div>

          {/* Comments Section */}
          <div className="mt-8">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
              {video._count?.comments ?? 0} Commentaires
            </h3>

            {/* Post Comment */}
            <div className="flex gap-4 mb-10">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary border border-primary/20">
                <UserIcon className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-3">
                <Textarea 
                  placeholder="Ajouter un commentaire..." 
                  className="min-h-[40px] bg-transparent border-0 border-b border-border rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all resize-none px-0"
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground mr-2">Note (Business) :</span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(rating === star ? null : star)}
                        className={cn(
                          "p-1 transition-all hover:scale-110",
                          (rating ?? 0) >= star ? "text-amber-400" : "text-muted-foreground/30"
                        )}
                      >
                        <Star className={cn("w-4 h-4", (rating ?? 0) >= star && "fill-current")} />
                      </button>
                    ))}
                    {rating && <span className="text-xs font-bold text-amber-500 ml-1">{rating}/5</span>}
                  </div>
                  
                  <div className="flex gap-2">
                    {commentContent && (
                      <Button variant="ghost" size="sm" onClick={() => { setCommentContent(''); setRating(null); }}>
                        Annuler
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      className="rounded-full px-5"
                      disabled={!commentContent.trim() || submittingComment}
                      onClick={handleSubmitComment}
                    >
                      {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Commenter
                    </Button>
                  </div>
                </div>
                {rating && (
                  <p className="text-[10px] text-amber-500 font-medium">
                    * Cette note sera appliquée au business du créateur.
                  </p>
                )}
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-6">
              {video.comments?.map((comment: YoutubeVideoComment) => (
                <div key={comment.id} className="flex gap-4 group">
                   <div className="w-10 h-10 rounded-full overflow-hidden border border-border/50 bg-muted flex-shrink-0">
                      {comment.user.profilePicture ? (
                        <img src={comment.user.profilePicture} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground font-bold">
                          {comment.user.username?.charAt(0)}
                        </div>
                      )}
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">@{comment.user.username}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: fr })}
                        </span>
                      </div>
                      <div className="mt-1">
                        {comment.rating && (
                          <div className="flex items-center gap-1 mb-1">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={cn("w-2.5 h-2.5", s <= (comment.rating ?? 0) ? "text-amber-400 fill-current" : "text-muted-foreground/20")} />
                            ))}
                          </div>
                        )}
                        <p className="text-sm leading-relaxed text-foreground/80">{comment.content}</p>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                           <ThumbsUp className="w-3 h-3" /> 0
                        </button>
                        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                           <ThumbsDown className="w-3 h-3" />
                        </button>
                        <button className="text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-tight">Répondre</button>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar - Related Videos */}
      <div className="w-full lg:w-[350px] xl:w-[400px] flex-shrink-0">
        <h4 className="font-bold text-sm mb-4 px-1 uppercase tracking-wider text-muted-foreground/60">Vidéos suggérées</h4>
        <div className="space-y-4">
          {relatedVideos.map((v) => (
            <div 
              key={v.id} 
              className="flex gap-3 group cursor-pointer"
              onClick={() => onVideoClick(v)}
            >
              <div className="relative w-40 h-24 bg-black rounded-xl overflow-hidden flex-shrink-0 border border-border/50 group-hover:border-primary/30 transition-colors">
                {v.thumbnailPath ? (
                  <img src={`${import.meta.env.VITE_API_URL}${v.thumbnailPath}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted/20">
                     <Play className="w-6 h-6 text-white/20" />
                  </div>
                )}
                {v.duration && (
                  <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 text-[8px] font-medium text-white rounded">
                    {Math.floor(v.duration / 60)}:{Math.floor(v.duration % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="font-semibold text-xs leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                  {v.title}
                </h5>
                <p className="text-[10px] text-muted-foreground mt-1 truncate">
                  {v.business?.name}
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[9px] text-muted-foreground/80">
                  <span>{v.views.toLocaleString('fr-FR')} vues</span>
                  <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/30" />
                  <span>{formatDistanceToNow(new Date(v.createdAt), { locale: fr })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
