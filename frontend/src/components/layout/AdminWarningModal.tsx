import { useEffect, useMemo, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usersApi, UserPendingWarning } from '@/services/api';
import { useSocketBase } from '@/contexts/SocketContext';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SocketWarning {
  id: string;
  type: 'AVERTISSEMENT' | 'AMENDE';
  title?: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  amount?: number | null;
  issuedBy: string;
  createdAt: string;
}

type WarningQueueItem = UserPendingWarning & {
  customTitle?: string | null;
};

export default function AdminWarningModal() {
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<WarningQueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [acknowledging, setAcknowledging] = useState(false);
  const { socket } = useSocketBase();

  const loadPendingWarnings = useCallback(async () => {
    try {
      const res = await usersApi.getPendingWarnings();
      setWarnings((res.data.warnings || []).map((warning) => ({ ...warning, customTitle: null })));
      setIndex(0);
    } catch {
      // Ignore errors to avoid blocking UI
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingWarnings();
  }, [loadPendingWarnings]);

  // Listen for real-time warnings from socket
  useEffect(() => {
    if (!socket) return;

    const handleNewWarning = (warning: SocketWarning) => {
      const newWarning: WarningQueueItem = {
        id: warning.id,
        type: warning.type,
        customTitle: warning.title || null,
        message: warning.message,
        severity: warning.severity,
        amount: warning.amount,
        createdAt: warning.createdAt,
        issuedBy: {
          id: '',
          username: warning.issuedBy,
        },
      };
      setWarnings((prev) => [...prev, newWarning]);
    };

    socket.on('admin:warning', handleNewWarning);

    return () => {
      socket.off('admin:warning', handleNewWarning);
    };
  }, [socket]);

  const currentWarning = useMemo(() => {
    if (index < 0 || index >= warnings.length) {
      return null;
    }
    return warnings[index];
  }, [index, warnings]);

  const handleAcknowledge = async () => {
    if (!currentWarning || acknowledging) {
      return;
    }

    setAcknowledging(true);
    try {
      await usersApi.acknowledgeWarning(currentWarning.id);
    } catch {
      // Continue even if acknowledgment fails
    } finally {
      setAcknowledging(false);
    }

    if (index >= warnings.length - 1) {
      setWarnings([]);
      setIndex(0);
      return;
    }

    setIndex((value) => value + 1);
  };

  if (loading || !currentWarning) {
    return null;
  }

  const isAmende = currentWarning.type === 'AMENDE';

  const severityConfig = {
    LOW: {
      icon: Info,
      color: 'text-primary',
      bgColor: 'bg-muted/10',
      borderColor: 'border-border/30',
      label: 'Information',
    },
    MEDIUM: {
      icon: AlertCircle,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/30',
      label: 'Avertissement',
    },
    HIGH: {
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/30',
      label: 'Avertissement Grave',
    },
  };

  const config = isAmende 
    ? {
        icon: AlertTriangle,
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
        borderColor: 'border-destructive/30',
        label: 'Amende',
      }
    : severityConfig[currentWarning.severity];

  const Icon = config.icon;

  const createdDate = new Date(currentWarning.createdAt);
  const createdDateLabel = isNaN(createdDate.getTime())
    ? currentWarning.createdAt
    : createdDate.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  const isLast = index === warnings.length - 1;

  return (
    <Dialog open>
      <DialogContent
        className={cn("max-w-lg", isAmende && 'border-destructive/50 ')}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('rounded-full p-2', config.bgColor)}>
              <Icon className={cn('h-6 w-6', config.color)} />
            </div>
            <div>
              <DialogTitle className={config.color}>
                {currentWarning.customTitle || config.label}
                {isAmende && currentWarning.amount && (
                  <span className="block text-xl font-bold text-destructive">
                    {currentWarning.amount}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription>
                Message de l'administration - {index + 1}/{warnings.length}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {isAmende && currentWarning.amount ? (
            <div className={cn('rounded-lg border-2 p-4 text-center', 'border-destructive/50 bg-destructive/20')}>
              <p className="text-xs text-destructive font-medium mb-1">MONTANT DE L'AMENDE</p>
              <p className="text-5xl font-bold text-destructive mb-3">{currentWarning.amount}</p>
              <p className="text-sm text-destructive font-semibold">Pièces d'or</p>
            </div>
          ) : null}

          <div className={cn('rounded-lg border p-4', config.borderColor, config.bgColor)}>
            <p className="whitespace-pre-wrap text-sm text-foreground">{currentWarning.message}</p>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Envoyé par {currentWarning.issuedBy.username}</span>
            <span>{createdDateLabel}</span>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleAcknowledge}
            disabled={acknowledging}
            variant={isAmende || currentWarning.severity === 'HIGH' ? 'destructive' : 'default'}
          >
            {acknowledging ? 'Confirmation...' : isLast ? "J'ai compris" : 'Suivant'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
