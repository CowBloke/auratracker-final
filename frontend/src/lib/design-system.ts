/**
 * Design System Constants
 * 
 * Centralized design tokens and utilities for consistent UI across the application.
 * All pages should use these constants to ensure visual harmony.
 */

// Spacing Scale
export const SPACING = {
  // Page-level spacing
  PAGE_PADDING: 'py-12 px-6',
  PAGE_SPACING: 'space-y-12',
  
  // Section spacing
  SECTION_SPACING: 'space-y-8',
  CARD_SPACING: 'space-y-4',
  
  // Component spacing
  COMPACT_SPACING: 'space-y-4',
  TIGHT_SPACING: 'space-y-2',
} as const;

// Container Widths
export const CONTAINER = {
  DEFAULT: 'max-w-6xl',
  COMPACT: 'max-w-4xl',
  WIDE: 'max-w-7xl',
  FULL: 'max-w-full',
} as const;

// Typography Scale
export const TYPOGRAPHY = {
  H1: 'text-4xl font-medium tracking-tight',
  H2: 'text-3xl font-medium tracking-tight',
  H3: 'text-2xl font-medium tracking-tight',
  H4: 'text-xl font-medium tracking-tight',
  H5: 'text-lg font-medium',
  H6: 'text-base font-medium',
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

// Page Layout Variants
export type PageLayoutVariant = 'default' | 'compact' | 'wide' | 'full';

export const PAGE_LAYOUT_CLASSES: Record<PageLayoutVariant, string> = {
  default: `${CONTAINER.DEFAULT} mx-auto ${SPACING.PAGE_PADDING} ${SPACING.PAGE_SPACING}`,
  compact: `${CONTAINER.COMPACT} mx-auto ${SPACING.PAGE_PADDING} ${SPACING.PAGE_SPACING}`,
  wide: `${CONTAINER.WIDE} mx-auto ${SPACING.PAGE_PADDING} ${SPACING.PAGE_SPACING}`,
  full: `${CONTAINER.FULL} ${SPACING.PAGE_PADDING} ${SPACING.PAGE_SPACING}`,
};

// Utility function to combine classes
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
