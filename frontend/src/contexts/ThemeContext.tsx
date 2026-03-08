import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  colorScheme: string;
  setTheme: (theme: Theme) => void;
  setColorScheme: (id: string) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Takes raw tweakcn CSS and returns only the :root / .dark variable blocks,
 * stripped of @layer wrappers so they are unlayered and win the cascade.
 */
function unwrapLayers(css: string): string {
  // Remove @tailwind directives
  let src = css.replace(/@tailwind\s+\w+;\s*/g, '');
  let output = '';
  let i = 0;
  while (i < src.length) {
    // Match @layer <name> {
    const ahead = src.slice(i);
    const layerMatch = ahead.match(/^@layer\s+\w+\s*\{/);
    if (layerMatch) {
      i += layerMatch[0].length;
      // Extract inner content by tracking brace depth
      let depth = 1;
      const innerStart = i;
      while (i < src.length && depth > 0) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') depth--;
        i++;
      }
      const inner = src.slice(innerStart, i - 1);
      // Drop @apply lines (not valid in browser)
      output += inner.replace(/[^\n]*@apply[^\n]*/g, '');
    } else {
      output += src[i];
      i++;
    }
  }
  return output;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme') as Theme | null;
      if (stored) return stored;
      return 'light';
    }
    return 'light';
  });
  const [colorScheme, setColorScheme] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('colorScheme') || 'aura-classic';
    }
    return 'aura-classic';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const STYLE_ID = 'tweakcn-theme-style';
    document.getElementById(STYLE_ID)?.remove();

    if (colorScheme === 'default') {
      localStorage.setItem('colorScheme', 'default');
      return;
    }

    fetch(`/themes/${colorScheme}.css`)
      .then((r) => r.text())
      .then((css) => {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = unwrapLayers(css);
        document.head.appendChild(style);
        localStorage.setItem('colorScheme', colorScheme);
      })
      .catch(() => {});
  }, [colorScheme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, colorScheme, setTheme, setColorScheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
