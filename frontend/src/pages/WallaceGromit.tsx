export default function WallaceGromit() {
  return (
    <div className="relative min-h-screen bg-black">
      <iframe
        className="absolute inset-0 h-full w-full"
        src="https://www.youtube-nocookie.com/embed/K7gdWIY9R4s?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1"
        title="Wallace & Gromit"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/70 via-black/10 to-transparent p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-white/70">
          Lecture en cours - mode plein ecran
        </p>
      </div>
    </div>
  );
}
