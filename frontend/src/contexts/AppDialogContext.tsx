import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type DialogVariant = 'default' | 'destructive';

type DialogInput =
  | string
  | {
      title?: string;
      description?: ReactNode;
      confirmLabel?: string;
      cancelLabel?: string;
      variant?: DialogVariant;
    };

type DialogRequest = {
  kind: 'confirm' | 'alert';
  options: {
    title: string;
    description: ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    variant: DialogVariant;
  };
  resolve: (value: boolean) => void;
};

interface AppDialogContextValue {
  confirm: (input: DialogInput) => Promise<boolean>;
  alert: (input: DialogInput) => Promise<void>;
}

const DEFAULT_CONTEXT: AppDialogContextValue = {
  confirm: async () => false,
  alert: async () => {},
};

const AppDialogContext = createContext<AppDialogContextValue>(DEFAULT_CONTEXT);

function normalizeInput(kind: 'confirm' | 'alert', input: DialogInput): DialogRequest['options'] {
  if (typeof input === 'string') {
    return {
      title: kind === 'confirm' ? 'Confirmer l action' : 'Information',
      description: input,
      confirmLabel: kind === 'confirm' ? 'Confirmer' : 'OK',
      cancelLabel: 'Annuler',
      variant: kind === 'confirm' ? 'destructive' : 'default',
    };
  }

  return {
    title: input.title || (kind === 'confirm' ? 'Confirmer l action' : 'Information'),
    description: input.description || '',
    confirmLabel: input.confirmLabel || (kind === 'confirm' ? 'Confirmer' : 'OK'),
    cancelLabel: input.cancelLabel || 'Annuler',
    variant: input.variant || (kind === 'confirm' ? 'destructive' : 'default'),
  };
}

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const queueRef = useRef<DialogRequest[]>([]);

  const flushNext = useCallback(() => {
    const next = queueRef.current.shift() || null;
    setRequest(next);
  }, []);

  const enqueueRequest = useCallback((nextRequest: DialogRequest) => {
    setRequest((current) => {
      if (!current) {
        return nextRequest;
      }
      queueRef.current.push(nextRequest);
      return current;
    });
  }, []);

  const resolveRequest = useCallback(
    (value: boolean) => {
      setRequest((current) => {
        if (!current) {
          return current;
        }
        current.resolve(value);
        return null;
      });
      flushNext();
    },
    [flushNext]
  );

  const confirm = useCallback(
    (input: DialogInput) =>
      new Promise<boolean>((resolve) => {
        enqueueRequest({
          kind: 'confirm',
          options: normalizeInput('confirm', input),
          resolve,
        });
      }),
    [enqueueRequest]
  );

  const alert = useCallback(
    (input: DialogInput) =>
      new Promise<void>((resolve) => {
        enqueueRequest({
          kind: 'alert',
          options: normalizeInput('alert', input),
          resolve: () => resolve(),
        });
      }),
    [enqueueRequest]
  );

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert]);

  return (
    <AppDialogContext.Provider value={value}>
      {children}

      <AlertDialog
        open={Boolean(request)}
        onOpenChange={(open) => {
          if (open || !request) return;
          resolveRequest(request.kind === 'alert');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.options.title}</AlertDialogTitle>
            <AlertDialogDescription>{request?.options.description}</AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            {request?.kind === 'confirm' ? (
              <AlertDialogCancel onClick={() => resolveRequest(false)}>{request.options.cancelLabel}</AlertDialogCancel>
            ) : null}
            <AlertDialogAction
              className={
                request?.options.variant === 'destructive'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
              onClick={() => resolveRequest(true)}
            >
              {request?.options.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  return useContext(AppDialogContext);
}
