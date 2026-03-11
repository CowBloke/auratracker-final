const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const darkGameImageMap: Record<string, string> = {
  '/images/games/2048.png': '/images/games/dark2048.png',
  '/images/games/blackjack.png': '/images/games/darkblackjack.png',
  '/images/games/cashmachine.png': '/images/games/darkcashmachine.png',
  '/images/games/knifehit.png': '/images/games/darkknifehit.png',
  '/images/games/minesweeper.png': '/images/games/darkminesweeper.png',
  '/images/games/poker.png': '/images/games/darkpoker.png',
  '/images/games/puissance4.png': '/images/games/darkpuissance4.png',
  '/images/games/racer.png': '/images/games/darkracer.png',
  '/images/games/solitaire.png': '/images/games/darksolitaire.png',
  '/images/games/sudoku.png': '/images/games/darksudoku.png',
};

const getUploadsBaseUrl = () => {
  try {
    const parsed = new URL(API_URL, window.location.origin);
    const origin = parsed.origin;
    const normalizedPath = parsed.pathname.replace(/\/+$/, '');

    // If API URL ends with /api, uploads live one level above that path.
    if (normalizedPath.endsWith('/api')) {
      const withoutApi = normalizedPath.slice(0, -4);
      return `${origin}${withoutApi}`;
    }

    return `${origin}${normalizedPath}`;
  } catch {
    return API_URL.replace(/\/+$/, '');
  }
};

export const resolveImageUrl = (value?: string | null) => {
  if (!value) return '';
  if (value.startsWith('/uploads/') || value.startsWith('/api/uploads/')) {
    // Prefer /api/uploads in production behind reverse proxies that only expose /api/*.
    const normalizedPath = value.startsWith('/uploads/')
      ? `/api${value}`
      : value;
    return `${getUploadsBaseUrl()}${normalizedPath}`;
  }
  return value;
};

export const isUploadPath = (value?: string | null) => {
  return typeof value === 'string' && (value.startsWith('/uploads/') || value.startsWith('/api/uploads/'));
};

export const resolveThemeImageUrl = (value: string | null | undefined, theme: 'light' | 'dark') => {
  const resolved = resolveImageUrl(value);
  if (theme !== 'dark' || !resolved) return resolved;
  return darkGameImageMap[resolved] || resolved;
};
