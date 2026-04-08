import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Skeleton from 'react-loading-skeleton';
import { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

type LoadingSkeletonProps = {
  className?: string;
};

const skeletonTheme = {
  baseColor: 'hsl(var(--muted))',
  highlightColor: 'hsl(var(--border))',
};

export function CenteredSkeletonCard({ className }: LoadingSkeletonProps) {
  return (
    <SkeletonTheme {...skeletonTheme}>
      <Card className={cn('border-border/60 bg-card shadow-none', className)}>
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    </SkeletonTheme>
  );
}

export function ListSkeleton({ className, rows = 5, showAvatar = true, showActions = false }: LoadingSkeletonProps & { rows?: number; showAvatar?: boolean; showActions?: boolean }) {
  return (
    <SkeletonTheme {...skeletonTheme}>
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 p-3">
            {showAvatar ? <Skeleton className="h-10 w-10 shrink-0 rounded-full" /> : null}
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            {showActions ? <Skeleton className="h-8 w-20 shrink-0 rounded-full" /> : null}
          </div>
        ))}
      </div>
    </SkeletonTheme>
  );
}

export function GridSkeleton({ className, cards = 6, columns = 'sm:grid-cols-2 xl:grid-cols-3', imageAspect = 'aspect-[16/10]' }: LoadingSkeletonProps & { cards?: number; columns?: string; imageAspect?: string }) {
  return (
    <SkeletonTheme {...skeletonTheme}>
      <div className={cn('grid gap-4', columns, className)}>
        {Array.from({ length: cards }).map((_, index) => (
          <Card key={index} className="overflow-hidden border-border/60 bg-card/90 shadow-none">
            <CardContent className="p-0">
              <Skeleton className={cn('w-full rounded-none', imageAspect)} />
              <div className="space-y-3 p-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-24 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </SkeletonTheme>
  );
}

export function TableSkeleton({ className, rows = 8 }: LoadingSkeletonProps & { rows?: number }) {
  return (
    <SkeletonTheme {...skeletonTheme}>
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 px-4 py-3">
            <Skeleton className="h-4 w-8 shrink-0" />
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </SkeletonTheme>
  );
}

export function ChatSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <SkeletonTheme {...skeletonTheme}>
      <div className={cn('grid h-full min-h-0 gap-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm lg:grid-cols-[300px_minmax(0,1fr)]', className)}>
        <div className="border-b border-border/60 p-3 lg:border-b-0 lg:border-r">
          <Skeleton className="h-7 w-28" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-5/6 rounded-lg" />
            <Skeleton className="h-8 w-2/3 rounded-lg" />
            <Skeleton className="h-8 w-4/5 rounded-lg" />
          </div>
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="border-b border-border/60 p-3">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
          <div className="flex-1 space-y-3 bg-muted/10 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className={cn('flex', index % 2 === 0 ? 'justify-start' : 'justify-end')}>
                <div className={cn('space-y-2 rounded-2xl border border-border/60 bg-card/80 p-3', index % 2 === 0 ? 'max-w-[70%]' : 'max-w-[55%]')}>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="h-4 w-32 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonTheme>
  );
}
