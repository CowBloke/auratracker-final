import type { ComponentProps, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { getPageMetaForPath } from '@/lib/page-meta';
import { cn } from '@/lib/utils';

/** Conteneur unique de toutes les pages applicatives : largeur, marges et espacement vertical identiques. */
export function PageShell({ children, className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6', className)} {...props}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  /** Par défaut : titre de la page dans `page-meta`. À ne fournir que pour un titre dynamique (ex. profil). */
  title?: string;
  /** Par défaut : description de la page dans `page-meta`. */
  description?: string;
  actions?: ReactNode;
}

/** En-tête unique de page : titre, description et actions principales. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  const { pathname } = useLocation();
  const meta = getPageMetaForPath(pathname);
  const resolvedDescription = description ?? meta.description;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-semibold">{title ?? meta.title}</h1>
        {resolvedDescription ? <p className="text-sm text-muted-foreground">{resolvedDescription}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
