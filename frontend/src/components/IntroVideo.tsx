import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const FADE_DURATION = 2000;

export default function IntroVideo() {
  const { markIntroSeen } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!confirmed) return;
    videoRef.current?.setAttribute('x-webkit-airplay', 'deny');
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (volIntervalRef.current) clearInterval(volIntervalRef.current);
    };
  }, [confirmed]);

  const startFade = () => {
    const v = videoRef.current;
    if (!v) return;
    setFading(true);
    const startVol = v.volume;
    const startTime = performance.now();
    volIntervalRef.current = setInterval(() => {
      const vid = videoRef.current;
      if (!vid) { clearInterval(volIntervalRef.current!); return; }
      const t = Math.min((performance.now() - startTime) / FADE_DURATION, 1);
      vid.volume = Math.max(0, startVol * (1 - t));
      if (t >= 1) clearInterval(volIntervalRef.current!);
    }, 16);
  };

  const handlePlay = () => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration) || fadeTimerRef.current !== null) return;
    const delayMs = Math.max((v.duration * 1000) - FADE_DURATION - 300, 0);
    fadeTimerRef.current = setTimeout(startFade, delayMs);
  };

  const handleCanPlay = () => {
    setVideoReady(true);
    videoRef.current?.play();
  };

  const handleEnded = () => {
    if (volIntervalRef.current) clearInterval(volIntervalRef.current);
    if (videoRef.current) videoRef.current.volume = 0;
    setDone(true);
    markIntroSeen();
  };

  const handleError = () => {
    setDone(true);
    markIntroSeen();
  };

  const watchLater = () => {
    // Close overlay without marking seen — will replay next session
    setDone(true);
  };

  if (done) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      style={{
        opacity: fading ? 0 : 1,
        transition: fading ? `opacity ${FADE_DURATION}ms ease-in-out` : 'none',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      {!confirmed && (
        <div className="flex flex-col items-center gap-6 text-center px-6">
          <p className="text-white text-lg font-medium">
            Une vidéo d'introduction est disponible.
          </p>
          <p className="text-white/60 text-sm">
            Sur certains appareils, la lecture peut prendre quelques secondes.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => setConfirmed(true)}
              className="px-6 py-2.5 rounded-lg bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
            >
              Regarder maintenant
            </button>
            <button
              onClick={watchLater}
              className="px-6 py-2.5 rounded-lg border border-white/30 text-white/70 text-sm hover:border-white/60 hover:text-white transition-colors"
            >
              Plus tard
            </button>
          </div>
        </div>
      )}

      {confirmed && (
        <video
          ref={videoRef}
          src="/videos/intro.mp4"
          onCanPlay={handleCanPlay}
          onPlay={handlePlay}
          onEnded={handleEnded}
          onError={handleError}
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: videoReady ? 1 : 0,
            transition: 'opacity 0.3s',
            border: 'none',
            outline: 'none',
          }}
        />
      )}
    </div>
  );
}
