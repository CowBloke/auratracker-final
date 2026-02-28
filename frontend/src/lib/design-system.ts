/**
 * Design System Constants
 *
 * Centralized design tokens and utilities for consistent UI across the application.
 * All pages should use these constants to ensure visual harmony.
 */

// Spacing Scale
export const SPACING = {
  // Page-level spacing
  PAGE_PADDING: 'px-4 py-6 sm:px-6 lg:px-8 lg:py-8',
  PAGE_BODY_PADDING: 'px-4 pb-6 sm:px-6 lg:px-8 lg:pb-8',
  PAGE_HEADER_PADDING: 'px-4 pt-6 pb-8 sm:px-6 lg:px-8 lg:pt-8 lg:pb-8',
  PAGE_SPACING: 'space-y-8',
  PAGE_CONTENT: 'space-y-6',
  PAGE_HEADER: 'mb-2',

  // Section spacing
  SECTION_SPACING: 'space-y-6',
  CARD_SPACING: 'space-y-4',

  // Component spacing
  COMPACT_SPACING: 'space-y-4',
  TIGHT_SPACING: 'space-y-2',
} as const;

// Container Widths
export const CONTAINER = {
  DEFAULT: 'max-w-6xl',
  COMPACT: 'max-w-5xl',
  WIDE: 'max-w-7xl',
  FULL: 'max-w-full',
} as const;

// Typography Scale
export const TYPOGRAPHY = {
  PAGE_TITLE: 'text-2xl font-semibold tracking-tight sm:text-3xl',
  PAGE_DESCRIPTION: 'text-sm text-muted-foreground',
  PAGE_META: 'text-sm text-muted-foreground',
  SECTION_TITLE: 'text-lg font-semibold tracking-tight',
  H1: 'text-3xl font-semibold tracking-tight sm:text-4xl',
  H2: 'text-2xl font-semibold tracking-tight sm:text-3xl',
  H3: 'text-xl font-semibold tracking-tight sm:text-2xl',
  H4: 'text-lg font-semibold tracking-tight',
  H5: 'text-base font-semibold tracking-tight',
  H6: 'text-sm font-semibold tracking-tight',
  BODY: 'text-base',
  SMALL: 'text-sm',
  XS: 'text-xs',
  LABEL: 'text-sm font-medium',
  MUTED: 'text-sm text-muted-foreground',
} as const;

// Border Styles
export const BORDER = {
  DEFAULT: 'border border-border',
  CARD: 'border border-border/40',
  INTERACTIVE: 'border border-border/60',
  STRONG: 'border border-border',
  NONE: 'border-0',
} as const;

// Shadow Styles
export const SHADOW = {
  NONE: 'shadow-none',
  SM: 'shadow-sm',
  DEFAULT: 'shadow',
  MD: 'shadow-md',
  LG: 'shadow-lg',
} as const;

// Border Radius
export const RADIUS = {
  NONE: 'rounded-none',
  SM: 'rounded-sm',
  DEFAULT: 'rounded-md',
  LG: 'rounded-lg',
  XL: 'rounded-xl',
  '2XL': 'rounded-2xl',
  FULL: 'rounded-full',
} as const;

// Utility function to combine classes
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
