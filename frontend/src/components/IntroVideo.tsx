import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const FADE_DURATION = 2000;

export default function IntroVideo() {
  const { markIntroSeen } = useAuth();
  const [videoReady, setVideoReady] = useState(false);
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    videoRef.current?.setAttribute('x-webkit-airplay', 'deny');
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (volIntervalRef.current) clearInterval(volIntervalRef.current);
    };
  }, []);

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

  // Schedule the fade the moment the video actually starts playing
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

  if (done) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black"
      style={{
        opacity: fading ? 0 : 1,
        transition: fading ? `opacity ${FADE_DURATION}ms ease-in-out` : 'none',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <video
        ref={videoRef}
        src="/videos/intro.mp4"
        onCanPlay={handleCanPlay}
        onPlay={handlePlay}
        onEnded={handleEnded}
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
    </div>
  );
}
