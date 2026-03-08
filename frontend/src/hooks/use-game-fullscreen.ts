import { useCallback, useEffect, useRef, useState } from 'react';

export function useGameFullscreen<T extends HTMLElement>() {
  const containerRef = useRef<T>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;

    if (document.fullscreenElement === element) {
      void document.exitFullscreen();
      return;
    }

    void element.requestFullscreen();
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return {
    containerRef,
    isFullscreen,
    toggleFullscreen,
  };
}
