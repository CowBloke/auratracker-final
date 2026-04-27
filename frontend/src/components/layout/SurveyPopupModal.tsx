import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usersApi, type UserPendingSurvey } from '@/services/api';
import { useSocketBase } from '@/contexts/SocketContext';
import { toast } from '@/hooks/use-toast';

const BLOCKED_ROUTE_PREFIXES = ['/games', '/party'];

const isBlockedRoute = (pathname: string) => BLOCKED_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

export default function SurveyPopupModal() {
  const location = useLocation();
  const { socket } = useSocketBase();
  const [pendingSurvey, setPendingSurvey] = useState<UserPendingSurvey | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [snoozedSurveyId, setSnoozedSurveyId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const blocked = useMemo(() => isBlockedRoute(location.pathname), [location.pathname]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const fetchPendingSurvey = useCallback(async () => {
    try {
      setLoading(true);
      const res = await usersApi.getPendingSurvey();
      setPendingSurvey(res.data.survey);
      setSelectedOptionId(null);
      if (!res.data.survey) {
        setVisible(false);
        setSnoozedSurveyId(null);
      } else if (snoozedSurveyId && snoozedSurveyId !== res.data.survey.id) {
        setSnoozedSurveyId(null);
      }
    } catch {
      // Silent: survey is secondary UX
    } finally {
      setLoading(false);
    }
  }, [snoozedSurveyId]);

  useEffect(() => {
    void fetchPendingSurvey();
  }, [fetchPendingSurvey]);

  useEffect(() => {
    clearTimer();

    if (!pendingSurvey || blocked || snoozedSurveyId === pendingSurvey.id) {
      if (blocked) {
        setVisible(false);
      }
      return;
    }

    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, pendingSurvey.popupDelaySeconds * 1000);

    return clearTimer;
  }, [blocked, clearTimer, pendingSurvey, snoozedSurveyId]);

  useEffect(() => {
    if (!socket) return;

    const handleAvailable = () => {
      setSnoozedSurveyId(null);
      void fetchPendingSurvey();
    };
    const handleArchived = ({ surveyId }: { surveyId: string }) => {
      if (pendingSurvey?.id === surveyId) {
        setVisible(false);
      }
      if (snoozedSurveyId === surveyId) {
        setSnoozedSurveyId(null);
      }
      void fetchPendingSurvey();
    };

    socket.on('survey:available', handleAvailable);
    socket.on('survey:archived', handleArchived);

    return () => {
      socket.off('survey:available', handleAvailable);
      socket.off('survey:archived', handleArchived);
    };
  }, [fetchPendingSurvey, pendingSurvey?.id, snoozedSurveyId, socket]);

  const handleSubmit = async () => {
    if (!pendingSurvey || !selectedOptionId || submitting) return;

    try {
      setSubmitting(true);
      await usersApi.respondSurvey(pendingSurvey.id, selectedOptionId);
      toast.success('Merci pour ton avis.');
      setVisible(false);
      setSnoozedSurveyId(null);
      await fetchPendingSurvey();
    } catch {
      toast.error('Impossible d’envoyer ta réponse pour le moment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !pendingSurvey) {
    return null;
  }

  return (
    <Dialog open={visible} onOpenChange={(open) => {
      if (!open) {
        setVisible(false);
        setSnoozedSurveyId(pendingSurvey.id);
      }
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{pendingSurvey.title}</DialogTitle>
          {pendingSurvey.description && (
            <DialogDescription>{pendingSurvey.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3">
          {pendingSurvey.options.map((option) => {
            const active = selectedOptionId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedOptionId(option.id)}
                className="w-full rounded-lg border p-3 text-left transition-colors"
                style={{
                  borderColor: active ? option.color : undefined,
                  backgroundColor: active ? `${option.color}22` : undefined,
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: option.color }}
                  />
                  <span className="text-sm font-medium">{option.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => {
            setVisible(false);
            setSnoozedSurveyId(pendingSurvey.id);
          }}>
            Plus tard
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedOptionId || submitting}>
            {submitting ? 'Envoi...' : 'Répondre'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
