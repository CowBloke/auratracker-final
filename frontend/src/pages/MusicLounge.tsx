import { useEffect, useRef, useState } from 'react';

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
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="rounded-3xl border border-border/40 bg-gradient-to-br from-emerald-500/20 via-background to-background p-8">
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
            Playlist interlude
          </p>
          <h1 className="mt-3 text-3xl font-semibold">AuraTracker Music Lounge</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Une interface inspiree des players modernes pour patienter. Depose tes fichiers mp3 dans
            <span className="font-medium text-foreground"> frontend/public/music/auratracker-playlist</span> et renomme-les
            <span className="font-medium text-foreground"> track-01.mp3</span>,
            <span className="font-medium text-foreground"> track-02.mp3</span>, etc.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
          <aside className="rounded-2xl border border-border/50 bg-muted/20 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Mixes</h2>
            <ul className="mt-4 space-y-3 text-sm">
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
          </aside>

          <section className="rounded-2xl border border-border/50 bg-muted/20 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Playlist AuraTracker</h2>
                <p className="text-sm text-muted-foreground">{tracks.length} tracks • curated for maintenance</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="rounded-full border border-border/50 px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={handleToggle}
                  className="rounded-full bg-emerald-500/90 px-6 py-2 text-sm font-semibold text-foreground transition hover:bg-emerald-500"
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-full border border-border/50 px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-border/40">
              <div className="grid grid-cols-[44px,1fr,64px] gap-4 border-b border-border/40 bg-background/80 px-4 py-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <span>#</span>
                <span>Title</span>
                <span className="text-right">Time</span>
              </div>
              <div className="divide-y divide-border/40">
                {tracks.map((track, index) => {
                  const isActive = index === currentIndex;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => handleSelect(index)}
                      className={`grid w-full grid-cols-[44px,1fr,64px] gap-4 px-4 py-4 text-left text-sm transition ${
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
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-border/40 bg-muted/30 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Now playing</p>
              <h3 className="text-lg font-semibold">{currentTrack.title}</h3>
              <p className="text-sm text-muted-foreground">{currentTrack.artist}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrev}
                className="rounded-full border border-border/50 px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={handleToggle}
                className="rounded-full bg-emerald-500/90 px-5 py-2 text-xs font-semibold text-foreground transition hover:bg-emerald-500"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="rounded-full border border-border/50 px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground"
              >
                Next
              </button>
            </div>
          </div>
          <audio
            ref={audioRef}
            src={currentTrack.src}
            onEnded={handleNext}
            className="mt-4 w-full"
            controls
          />
        </section>
      </div>
    </div>
  );
}
