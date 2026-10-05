import { Card, CardContent } from '@/components/ui/card';
import { Item, ItemContent, ItemMedia } from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type LoadingSkeletonProps = {
  className?: string;
};

export function CenteredSkeletonCard({ className }: LoadingSkeletonProps) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  );
}

export function ListSkeleton({ className, rows = 5, showAvatar = true, showActions = false }: LoadingSkeletonProps & { rows?: number; showAvatar?: boolean; showActions?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <Item key={index} variant="outline">
          {showAvatar ? (
            <ItemMedia>
              <Skeleton className="size-10 rounded-full" />
            </ItemMedia>
          ) : null}
          <ItemContent>
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </ItemContent>
          {showActions ? <Skeleton className="h-8 w-20 shrink-0 rounded-full" /> : null}
        </Item>
      ))}
    </div>
  );
}

export function GridSkeleton({ className, cards = 6, columns = 'sm:grid-cols-2 xl:grid-cols-3', imageAspect = 'aspect-[16/10]' }: LoadingSkeletonProps & { cards?: number; columns?: string; imageAspect?: string }) {
  return (
    <div className={cn('grid gap-4', columns, className)}>
      {Array.from({ length: cards }).map((_, index) => (
        <Card key={index} className="overflow-hidden py-0">
          <Skeleton className={cn('w-full rounded-none', imageAspect)} />
          <CardContent className="flex flex-col gap-3 pb-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ className, rows = 8 }: LoadingSkeletonProps & { rows?: number }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <Item key={index} variant="outline" size="sm">
          <Skeleton className="h-4 w-8 shrink-0" />
          <ItemMedia>
            <Skeleton className="size-9 rounded-full" />
          </ItemMedia>
          <ItemContent>
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-2/5" />
          </ItemContent>
          <Skeleton className="h-4 w-16 shrink-0" />
        </Item>
      ))}
    </div>
  );
}

export function ChatSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <Card className={cn('h-full min-h-0 gap-0 overflow-hidden py-0 lg:grid lg:grid-cols-[300px_minmax(0,1fr)]', className)}>
      <div className="border-b p-3 lg:border-b-0 lg:border-r">
        <Skeleton className="h-7 w-28" />
        <div className="mt-3 flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-5/6" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-8 w-4/5" />
        </div>
      </div>
      <div className="flex min-h-0 flex-col">
        <div className="border-b p-3">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className={cn('flex', index % 2 === 0 ? 'justify-start' : 'justify-end')}>
              <div className={cn('flex flex-col gap-2 rounded-xl border p-3', index % 2 === 0 ? 'max-w-[70%]' : 'max-w-[55%]')}>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-56 max-w-full" />
                <Skeleton className="h-4 w-32 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
