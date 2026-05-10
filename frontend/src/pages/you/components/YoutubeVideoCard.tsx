import { Play, MessageCircle, ThumbsUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { type YoutubeVideo } from '@/services/api';

export function YoutubeVideoCard({ video, onClick }: { video: YoutubeVideo; onClick: (video: YoutubeVideo) => void }) {
  const thumbnail = video.thumbnailPath ? `${import.meta.env.VITE_API_URL}${video.thumbnailPath}` : null;
  const logo = video.business?.logoUrl ? video.business.logoUrl : null;

  return (
    <div 
      className="group cursor-pointer flex flex-col gap-3"
      onClick={() => onClick(video)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-border/50 group-hover:border-primary/30 transition-colors">
        {thumbnail ? (
          <img src={thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/20 to-muted/10">
            <Play className="w-10 h-10 text-white/20" />
          </div>
        )}
        
        {video.duration && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-[10px] font-medium text-white rounded shadow-sm">
            {Math.floor(video.duration / 60)}:{Math.floor(video.duration % 60).toString().padStart(2, '0')}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex gap-3 px-1">
        {/* Channel Logo */}
        <div className="w-9 h-9 rounded-full bg-muted overflow-hidden flex-shrink-0 border border-border/50">
          {logo ? (
            <img src={logo} alt={video.business?.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-xs font-bold">
              {video.business?.name?.charAt(0) ?? 'Y'}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {video.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {video.business?.name}
          </p>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/80">
            <span>{video.views.toLocaleString('fr-FR')} vues</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <span>{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true, locale: fr })}</span>
          </div>
          
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <ThumbsUp className="w-3 h-3" /> {video._count?.likes ?? 0}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <MessageCircle className="w-3 h-3" /> {video._count?.comments ?? 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
