import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/layout/page-shell';

const tracks = [
  {
    id: 'auratracker-intro',
    title: 'AuraTracker Intro',
    artist: 'AuraStudio',
    duration: '1:42',
    src: '/music/auratracker-playlist/track-01.mp3',
  },
  {
    id: 'northern-glow',
    title: 'Northern Glow',
    artist: 'Skyline Drift',
    duration: '3:12',
    src: '/music/auratracker-playlist/track-02.mp3',
  },
  {
    id: 'soft-frequency',
    title: 'Soft Frequency',
    artist: 'Luma Labs',
    duration: '2:54',
    src: '/music/auratracker-playlist/track-03.mp3',
  },
  {
    id: 'late-night',
    title: 'Late Night Circuit',
    artist: 'Neon Harbor',
    duration: '4:06',
    src: '/music/auratracker-playlist/track-04.mp3',
  },
  {
    id: 'deep-breath',
    title: 'Deep Breath',
    artist: 'Mossy Waves',
    duration: '3:37',
    src: '/music/auratracker-playlist/track-05.mp3',
  },
];

export default function MusicLounge() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = tracks[currentIndex];

  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [currentIndex, isPlaying]);

  const handleSelect = (index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  const handleToggle = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % tracks.length);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
    setIsPlaying(true);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Maintenance"
        title="Music Lounge"
        description="Player simple, playlist claire et cartes homogènes avec le reste de l'interface."
      />
      <Card className="bg-gradient-to-br from-emerald-500/20 via-background to-background">
        <CardContent className="pt-6">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Une interface inspiree des players modernes pour patienter. Depose tes fichiers mp3 dans
            <span className="font-medium text-foreground"> frontend/public/music/auratracker-playlist</span> et renomme-les
            <span className="font-medium text-foreground"> track-01.mp3</span>,
            <span className="font-medium text-foreground"> track-02.mp3</span>, etc.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
        <Card className="bg-muted/20">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Mixes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="rounded-xl border border-border/40 bg-background/70 px-4 py-3">
                AuraTracker Focus
              </li>
              <li className="rounded-xl border border-border/30 px-4 py-3 text-muted-foreground">
                Maintenance Chill
              </li>
              <li className="rounded-xl border border-border/30 px-4 py-3 text-muted-foreground">
                Late Night Drift
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-muted/20">
          <CardContent className="space-y-6 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Playlist AuraTracker</h2>
                <p className="text-sm text-muted-foreground">{tracks.length} tracks • curated for maintenance</p>
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" onClick={handlePrev} variant="outline" size="sm">
                  Prev
                </Button>
                <Button type="button" onClick={handleToggle} size="sm" className="bg-emerald-500/90 hover:bg-emerald-500">
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
                <Button type="button" onClick={handleNext} variant="outline" size="sm">
                  Next
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/40">
              <div className="grid grid-cols-[44px,1fr,64px] gap-4 border-b border-border/40 bg-background/80 px-4 py-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <span>#</span>
                <span>Title</span>
                <span className="text-right">Time</span>
              </div>
              <div className="divide-y divide-border/40">
                {tracks.map((track, index) => {
                  const isActive = index === currentIndex;
                  return (
                    <Button
                      key={track.id}
                      type="button"
                      onClick={() => handleSelect(index)}
                      variant="ghost"
                      className={`grid h-auto w-full grid-cols-[44px,1fr,64px] gap-4 rounded-none px-4 py-4 text-left text-sm ${
                        isActive
                          ? 'bg-emerald-500/10 text-foreground'
                          : 'bg-background/60 text-muted-foreground hover:bg-background/80 hover:text-foreground'
                      }`}
                    >
                      <span className="font-semibold">{String(index + 1).padStart(2, '0')}</span>
                      <span>
                        <span className="block font-medium text-foreground">{track.title}</span>
                        <span className="text-xs text-muted-foreground">{track.artist}</span>
                      </span>
                      <span className="text-right text-xs text-muted-foreground">{track.duration}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Now playing</p>
              <h3 className="text-lg font-semibold">{currentTrack.title}</h3>
              <p className="text-sm text-muted-foreground">{currentTrack.artist}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" onClick={handlePrev} variant="outline" size="sm">
                Prev
              </Button>
              <Button type="button" onClick={handleToggle} size="sm" className="bg-emerald-500/90 hover:bg-emerald-500">
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <Button type="button" onClick={handleNext} variant="outline" size="sm">
                Next
              </Button>
            </div>
          </div>
          <audio
            ref={audioRef}
            src={currentTrack.src}
            onEnded={handleNext}
            className="w-full"
            controls
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
