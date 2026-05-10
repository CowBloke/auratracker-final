import { useState, useEffect } from 'react';
import { 
  Search, 
  TrendingUp, 
  Clock, 
  Play, 
  Filter,
  Video as VideoIcon,
  Upload,
  Settings
} from 'lucide-react';
import { youApi, type YoutubeVideo, type YouBusiness } from '@/services/api';
import { YoutubeVideoCard } from '../components/YoutubeVideoCard';
import { YoutubeWatch } from '../components/YoutubeWatch';
import { YoutubeOwnerDashboard } from '../components/YoutubeOwnerDashboard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function YoutubeTab({ ownedBusinesses, onReload }: { ownedBusinesses: YouBusiness[]; onReload: () => Promise<void> }) {
  const [videos, setVideos] = useState<YoutubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [watchVideoId, setWatchVideoId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const youtubeBusiness = ownedBusinesses.find(b => b.typeKey === 'youtube');

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const res = await youApi.getGlobalYoutubeVideos();
      setVideos(res.data.videos);
    } catch (err) {
      console.error('Failed to fetch videos', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredVideos = videos.filter(v => {
    const matchesSearch = v.title.toLowerCase().includes(search.toLowerCase()) || 
                         v.business?.name?.toLowerCase().includes(search.toLowerCase());
    
    if (activeCategory === 'trending') {
       return matchesSearch; // For now just search, in real app would sort by views
    }
    return matchesSearch;
  });

  const categories = [
    { id: 'all', label: 'Tout', icon: Play },
    { id: 'trending', label: 'Tendances', icon: TrendingUp },
    { id: 'recent', label: 'Nouveautés', icon: Clock },
  ];

  if (watchVideoId) {
    return (
      <YoutubeWatch 
        videoId={watchVideoId} 
        onBack={() => setWatchVideoId(null)} 
        onVideoClick={(v) => setWatchVideoId(v.id)}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header / Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">YouTube YOU</h2>
          <p className="text-sm text-muted-foreground">Découvre les contenus créés par les entrepreneurs de YOU.</p>
        </div>

        <div className="relative w-full md:w-96 group flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Rechercher une vidéo..." 
              className="pl-10 h-11 bg-muted/20 border-border/50 focus:border-primary/50 focus:ring-primary/20 rounded-xl transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          {youtubeBusiness && (
            <Button 
              className="h-11 rounded-xl px-5 gap-2 shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => setManageOpen(true)}
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Uploader</span>
            </Button>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2 no-scrollbar">
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={activeCategory === cat.id ? 'default' : 'secondary'}
            size="sm"
            className={cn(
              "rounded-full px-5 h-9 gap-2 transition-all",
              activeCategory === cat.id ? "shadow-md" : "bg-muted/50 hover:bg-muted"
            )}
            onClick={() => setActiveCategory(cat.id)}
          >
            <cat.icon className="w-3.5 h-3.5" />
            {cat.label}
          </Button>
        ))}
        <div className="w-px h-6 bg-border mx-2 flex-shrink-0" />
        <Button variant="ghost" size="sm" className="rounded-full h-9 gap-2 text-muted-foreground">
          <Filter className="w-3.5 h-3.5" /> Filtrer
        </Button>
      </div>

      {/* Video Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col gap-3 animate-pulse">
               <div className="aspect-video bg-muted rounded-xl" />
               <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                     <div className="h-4 bg-muted rounded w-3/4" />
                     <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
               </div>
            </div>
          ))}
        </div>
      ) : filteredVideos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
          {filteredVideos.map((video) => (
            <YoutubeVideoCard 
              key={video.id} 
              video={video} 
              onClick={(v) => setWatchVideoId(v.id)} 
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
             <VideoIcon className="w-10 h-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-semibold">Aucune vidéo trouvée</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Essaie une autre recherche ou reviens plus tard pour voir de nouveaux contenus.
          </p>
          <Button variant="outline" className="mt-6 rounded-full" onClick={() => { setSearch(''); setActiveCategory('all'); }}>
            Tout afficher
          </Button>
        </div>
      )}

      {youtubeBusiness && (
        <YoutubeOwnerDashboard 
          open={manageOpen} 
          onClose={() => setManageOpen(false)} 
          business={youtubeBusiness} 
          onSubmitted={onReload} 
        />
      )}
    </div>
  );
}
