export interface CustomThemeConfig {
  primary: string;
  accent: string;
  backgroundLight: string;
  surfaceLight: string;
  backgroundDark: string;
  surfaceDark: string;
  radius: number;
  shadowOpacity: number;
}

export const CUSTOM_THEME_STORAGE_KEY = 'customTheme';

export const DEFAULT_CUSTOM_THEME: CustomThemeConfig = {
  primary: '#6366f1',
  accent: '#8b5cf6',
  backgroundLight: '#f8fafc',
  surfaceLight: '#ffffff',
  backgroundDark: '#09090b',
  surfaceDark: '#18181b',
  radius: 18,
  shadowOpacity: 0.18,
};

const LIGHT_TEXT = '#111827';
const DARK_TEXT = '#f8fafc';
const DEFAULT_DESTRUCTIVE = '#ef4444';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(hex: string, fallback: string) {
  const raw = hex.trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return fallback;
  if (raw.length === 4) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  return raw.toLowerCase();
}

function hexToRgb(hex: string) {
  const value = normalizeHex(hex, '#000000').slice(1);
  const int = Number.parseInt(value, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixHex(base: string, target: string, ratio: number) {
  const safeRatio = clamp(ratio, 0, 1);
  const a = hexToRgb(base);
  const b = hexToRgb(target);
  return rgbToHex(
    a.r + (b.r - a.r) * safeRatio,
    a.g + (b.g - a.g) * safeRatio,
    a.b + (b.b - a.b) * safeRatio
  );
}

function rgbChannelToLinear(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const rl = rgbChannelToLinear(r);
  const gl = rgbChannelToLinear(g);
  const bl = rgbChannelToLinear(b);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function getReadableText(hex: string) {
  return getRelativeLuminance(hex) > 0.58 ? LIGHT_TEXT : DARK_TEXT;
}

function hexToHslTriplet(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return `0 0% ${(lightness * 100).toFixed(1)}%`;
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;
  switch (max) {
    case red:
      hue = (green - blue) / delta + (green < blue ? 6 : 0);
      break;
    case green:
      hue = (blue - red) / delta + 2;
      break;
    default:
      hue = (red - green) / delta + 4;
      break;
  }

  hue /= 6;

  return `${(hue * 360).toFixed(1)} ${(saturation * 100).toFixed(1)}% ${(
    lightness * 100
  ).toFixed(1)}%`;
}

function createShadowVars(opacity: number) {
  const base = clamp(opacity, 0.04, 0.6);
  return {
    '--shadow-x': '0px',
    '--shadow-y': '10px',
    '--shadow-blur': '30px',
    '--shadow-spread': '-12px',
    '--shadow-opacity': base.toFixed(2),
    '--shadow-color': 'hsl(240 10% 4%)',
    '--shadow-2xs': `0px 4px 10px -8px hsl(240 10% 4% / ${(base * 0.35).toFixed(2)})`,
    '--shadow-xs': `0px 6px 14px -10px hsl(240 10% 4% / ${(base * 0.45).toFixed(2)})`,
    '--shadow-sm': `0px 10px 20px -14px hsl(240 10% 4% / ${(base * 0.6).toFixed(2)})`,
    '--shadow': `0px 14px 30px -18px hsl(240 10% 4% / ${(base * 0.72).toFixed(2)})`,
    '--shadow-md': `0px 18px 36px -18px hsl(240 10% 4% / ${(base * 0.85).toFixed(2)})`,
    '--shadow-lg': `0px 24px 48px -22px hsl(240 10% 4% / ${base.toFixed(2)})`,
    '--shadow-xl': `0px 28px 64px -24px hsl(240 10% 4% / ${(base * 1.1).toFixed(2)})`,
    '--shadow-2xl': `0px 36px 84px -28px hsl(240 10% 4% / ${(base * 1.2).toFixed(2)})`,
  };
}

function createModeVars({
  background,
  surface,
  primary,
  accent,
  radius,
  shadowOpacity,
}: {
  background: string;
  surface: string;
  primary: string;
  accent: string;
  radius: number;
  shadowOpacity: number;
}) {
  const foreground = getReadableText(background);
  const cardForeground = getReadableText(surface);
  const muted = mixHex(background, foreground, 0.06);
  const secondary = mixHex(surface, foreground, 0.05);
  const border = mixHex(background, foreground, 0.12);
  const input = mixHex(surface, foreground, 0.08);
  const mutedForeground = mixHex(foreground, background, 0.48);
  const chart3 = mixHex(primary, accent, 0.35);

  return {
    '--background': hexToHslTriplet(background),
    '--foreground': hexToHslTriplet(foreground),
    '--card': hexToHslTriplet(surface),
    '--card-foreground': hexToHslTriplet(cardForeground),
    '--popover': hexToHslTriplet(surface),
    '--popover-foreground': hexToHslTriplet(cardForeground),
    '--primary': hexToHslTriplet(primary),
    '--primary-foreground': hexToHslTriplet(getReadableText(primary)),
    '--secondary': hexToHslTriplet(secondary),
    '--secondary-foreground': hexToHslTriplet(getReadableText(secondary)),
    '--muted': hexToHslTriplet(muted),
    '--muted-foreground': hexToHslTriplet(mutedForeground),
    '--accent': hexToHslTriplet(accent),
    '--accent-foreground': hexToHslTriplet(getReadableText(accent)),
    '--destructive': hexToHslTriplet(DEFAULT_DESTRUCTIVE),
    '--destructive-foreground': hexToHslTriplet(getReadableText(DEFAULT_DESTRUCTIVE)),
    '--border': hexToHslTriplet(border),
    '--input': hexToHslTriplet(input),
    '--ring': hexToHslTriplet(primary),
    '--chart-1': hexToHslTriplet(primary),
    '--chart-2': hexToHslTriplet(accent),
    '--chart-3': hexToHslTriplet(chart3),
    '--chart-4': hexToHslTriplet(mixHex(accent, background, 0.22)),
    '--chart-5': hexToHslTriplet(mixHex(primary, background, 0.35)),
    '--sidebar': hexToHslTriplet(surface),
    '--sidebar-foreground': hexToHslTriplet(cardForeground),
    '--sidebar-primary': hexToHslTriplet(primary),
    '--sidebar-primary-foreground': hexToHslTriplet(getReadableText(primary)),
    '--sidebar-accent': hexToHslTriplet(accent),
    '--sidebar-accent-foreground': hexToHslTriplet(getReadableText(accent)),
    '--sidebar-border': hexToHslTriplet(border),
    '--sidebar-ring': hexToHslTriplet(primary),
    '--radius': `${clamp(radius, 4, 32) / 16}rem`,
    ...createShadowVars(shadowOpacity),
  };
}

function varsToCss(selector: string, vars: Record<string, string>) {
  return `${selector} {\n${Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')}\n}`;
}

export function sanitizeCustomTheme(
  value: Partial<CustomThemeConfig> | null | undefined
): CustomThemeConfig {
  return {
    primary: normalizeHex(value?.primary ?? '', DEFAULT_CUSTOM_THEME.primary),
    accent: normalizeHex(value?.accent ?? '', DEFAULT_CUSTOM_THEME.accent),
    backgroundLight: normalizeHex(
      value?.backgroundLight ?? '',
      DEFAULT_CUSTOM_THEME.backgroundLight
    ),
    surfaceLight: normalizeHex(value?.surfaceLight ?? '', DEFAULT_CUSTOM_THEME.surfaceLight),
    backgroundDark: normalizeHex(value?.backgroundDark ?? '', DEFAULT_CUSTOM_THEME.backgroundDark),
    surfaceDark: normalizeHex(value?.surfaceDark ?? '', DEFAULT_CUSTOM_THEME.surfaceDark),
    radius: clamp(Number(value?.radius ?? DEFAULT_CUSTOM_THEME.radius), 4, 32),
    shadowOpacity: clamp(
      Number(value?.shadowOpacity ?? DEFAULT_CUSTOM_THEME.shadowOpacity),
      0.04,
      0.6
    ),
  };
}

export function readStoredCustomTheme() {
  if (typeof window === 'undefined') return DEFAULT_CUSTOM_THEME;
  try {
    const raw = window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOM_THEME;
    return sanitizeCustomTheme(JSON.parse(raw));
  } catch {
    return DEFAULT_CUSTOM_THEME;
  }
}

export function buildCustomThemeCss(config: CustomThemeConfig) {
  const safeConfig = sanitizeCustomTheme(config);
  const rootVars = createModeVars({
    background: safeConfig.backgroundLight,
    surface: safeConfig.surfaceLight,
    primary: safeConfig.primary,
    accent: safeConfig.accent,
    radius: safeConfig.radius,
    shadowOpacity: safeConfig.shadowOpacity,
  });
  const darkVars = createModeVars({
    background: safeConfig.backgroundDark,
    surface: safeConfig.surfaceDark,
    primary: safeConfig.primary,
    accent: safeConfig.accent,
    radius: safeConfig.radius,
    shadowOpacity: safeConfig.shadowOpacity,
  });

  return `${varsToCss(':root', rootVars)}\n\n${varsToCss('.dark', darkVars)}`;
}

export function getCustomThemePreviewVars(config: CustomThemeConfig) {
  return createModeVars({
    background: config.backgroundLight,
    surface: config.surfaceLight,
    primary: config.primary,
    accent: config.accent,
    radius: config.radius,
    shadowOpacity: config.shadowOpacity,
  });
}
