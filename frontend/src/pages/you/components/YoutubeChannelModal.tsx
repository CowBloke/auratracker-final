import { useEffect, useState } from 'react';
import { Play, Star, ExternalLink, MessageSquare, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { youApi, type YouBusiness, type YoutubeVideo } from '@/services/api';
import { withRouteError } from '../utils';
import { ModalWrap } from './ui';

export function YoutubeChannelModal({
  open,
  onClose,
  business,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness | null;
  onSubmitted: () => Promise<void>;
}) {
  const [selectedVideo, setSelectedVideo] = useState<YoutubeVideo | null>(null);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);
  const [reviewEligible, setReviewEligible] = useState(false);
  
  // Review form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedVideo(null);
      setPlayingVideoUrl(null);
      setReviewEligible(false);
      setReviewRating(5);
      setReviewComment('');
    }
  }, [open]);

  if (!business) return null;

  const videos = business.youtubeVideos ?? [];

  const handlePlayVideo = async (video: YoutubeVideo) => {
    try {
      // For playing, we use the video object's path or URL. We'll assume videoPath provides what we need, 
      // or we construct the URL from the backend endpoint if it's stored relatively.
      // Since `videoPath` contains the file path, we need an endpoint to serve it or it's a full URL.
      // For now, let's just use a constructed endpoint or the property if it's already a URL.
      const videoUrl = video.videoPath?.startsWith('http') 
        ? video.videoPath 
        : `http://localhost:3000/uploads/youtube-videos/${video.videoPath?.split('/').pop()}`;
        
      setPlayingVideoUrl(videoUrl);
      setSelectedVideo(video);
      
      // Increment views
      await youApi.incrementVideoViews(video.id);
    } catch (e) {
      toast.error('Impossible de charger la vidéo.');
    }
  };

  const handleClosePlayer = async () => {
    if (!selectedVideo) return;
    
    setPlayingVideoUrl(null);
    
    try {
      // Check if user is eligible to leave a review
      const res = await youApi.checkYoutubeExitReview(business.id);
      if (res.data.eligible) {
        setReviewEligible(true);
      } else {
        setSelectedVideo(null);
      }
    } catch (e) {
      setSelectedVideo(null);
    }
  };

  const submitReview = async () => {
    if (!business) return;
    setSubmittingReview(true);
    try {
      await withRouteError(() => youApi.rateBusiness(business.id, reviewRating, reviewComment.trim()), 'Impossible de laisser un avis.');
      toast.success('Avis publié !');
      setReviewEligible(false);
      setSelectedVideo(null);
      await onSubmitted();
    } finally {
      setSubmittingReview(false);
    }
  };

  // 1. Review Form View
  if (reviewEligible) {
    return (
      <ModalWrap open={open} onClose={() => { setReviewEligible(false); setSelectedVideo(null); }} title={`Avis sur ${business.name}`} desc="Merci d'avoir visionné la vidéo ! Qu'as-tu pensé de ce contenu ?">
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-semibold">Ta note</p>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className="transition-transform hover:scale-110"
                >
                  <Star className={`w-8 h-8 ${reviewRating >= star ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                </button>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
             <label className="text-sm font-medium">Commentaire (optionnel)</label>
             <Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Partage ton avis..." rows={4} />
          </div>

          <div className="flex justify-end gap-2 mt-4">
             <Button variant="ghost" onClick={() => { setReviewEligible(false); setSelectedVideo(null); }} disabled={submittingReview}>Passer</Button>
             <Button onClick={submitReview} disabled={submittingReview}>Publier l'avis</Button>
          </div>
        </div>
      </ModalWrap>
    );
  }

  // 2. Video Player View
  if (selectedVideo && playingVideoUrl) {
    return (
      <ModalWrap open={open} onClose={handleClosePlayer} title={selectedVideo.title} desc={business.name} wide>
        <div className="flex flex-col h-full gap-4">
          <div className="bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center relative">
            <video 
              src={playingVideoUrl} 
              controls 
              autoPlay 
              className="w-full h-full object-contain"
            />
          </div>
          <div className="px-1">
             <p className="font-semibold text-lg">{selectedVideo.title}</p>
             <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                 <span>{(selectedVideo.views + 1).toLocaleString('fr-FR')} vues</span>
                 <span>{new Date(selectedVideo.createdAt).toLocaleDateString('fr-FR')}</span>
             </div>
             {selectedVideo.description && (
               <div className="mt-4 p-3 rounded-lg bg-muted/20 text-sm">
                 <p className="whitespace-pre-wrap">{selectedVideo.description}</p>
               </div>
             )}
          </div>
          <div className="mt-auto flex justify-end">
            <Button onClick={handleClosePlayer}>Fermer la vidéo</Button>
          </div>
        </div>
      </ModalWrap>
    );
  }

  // 3. Channel List View
  return (
    <ModalWrap open={open} onClose={onClose} title={`Chaîne de ${business.name}`} desc="Parcours les vidéos disponibles." wide>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {videos.map((video) => (
          <button 
            key={video.id} 
            onClick={() => void handlePlayVideo(video)}
            className="w-full text-left rounded-xl border border-border/40 bg-muted/10 p-3 flex gap-4 transition-all hover:bg-muted/20 hover:border-red-500/30 group"
          >
            <div className="h-24 w-40 shrink-0 bg-black rounded-lg flex items-center justify-center relative overflow-hidden group-hover:shadow-lg transition-shadow">
               <Play className="w-8 h-8 text-white/50 group-hover:text-red-500 transition-colors z-10" />
            </div>
            <div className="flex-1 min-w-0 py-1">
              <p className="font-semibold text-sm line-clamp-2 leading-tight group-hover:text-red-400 transition-colors">{video.title}</p>
              <p className="text-[11px] text-muted-foreground mt-1.5">{business.name}</p>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{video.views.toLocaleString('fr-FR')} vues</span>
                <span>•</span>
                <span>{new Date(video.createdAt).toLocaleDateString('fr-FR')}</span>
              </div>
            </div>
          </button>
        ))}

        {videos.length === 0 && (
          <div className="text-center py-12">
            <Play className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">Cette chaîne n'a pas encore de vidéo.</p>
          </div>
        )}
      </div>
    </ModalWrap>
  );
}
