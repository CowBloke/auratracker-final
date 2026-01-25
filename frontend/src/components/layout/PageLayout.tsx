import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PAGE_LAYOUT_CLASSES, type PageLayoutVariant } from '@/lib/design-system';

interface PageLayoutProps {
  children: ReactNode;
  variant?: PageLayoutVariant;
  className?: string;
}

/**
 * Standardized page layout wrapper component.
 * 
 * Ensures consistent spacing, container width, and padding across all pages.
 * 
 * @example
 * ```tsx
 * <PageLayout>
 *   <h1>Page Title</h1>
 *   <p>Content...</p>
 * </PageLayout>
 * ```
 * 
 * @example
 * ```tsx
 * <PageLayout variant="compact">
 *   <Form>...</Form>
 * </PageLayout>
 * ```
 */
export default function PageLayout({ 
  children, 
  variant = 'default',
  className 
}: PageLayoutProps) {
  return (
    <div className={cn(PAGE_LAYOUT_CLASSES[variant], className)}>
      {children}
    </div>
  );
}
