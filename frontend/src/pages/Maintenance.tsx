import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Wrench } from 'lucide-react';
import { TYPOGRAPHY } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { CenteredShell } from '@/components/layout/CenteredShell';

interface MaintenanceProps {
  message?: string;
  endDate?: string | null;
}

export default function Maintenance({ message, endDate }: MaintenanceProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    if (!endDate || endDate.trim() === '') {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const end = new Date(endDate).getTime();
      
      if (isNaN(end)) {
        setTimeLeft(null);
        return;
      }
      
      const difference = end - now;

      if (difference <= 0) {
        setTimeLeft(null);
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [endDate]);

  return (
    <CenteredShell widthClassName="max-w-2xl">
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <Wrench className="h-14 w-14 text-muted-foreground" />
        </div>
        <div className={TYPOGRAPHY.H2}>
          Site en maintenance
        </div>
        <p className={TYPOGRAPHY.MUTED}>
          Le site est temporairement indisponible. Merci de revenir plus tard.
        </p>
        
        {timeLeft && (
          <div className="space-y-4">
            <div className={TYPOGRAPHY.H5}>
              Retour prévu dans :
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card>
                <CardContent className="p-6">
                  <div className={cn(TYPOGRAPHY.H1, "mb-2 tabular-nums")}>
                    {String(timeLeft.days).padStart(2, '0')}
                  </div>
                  <div className={cn(TYPOGRAPHY.SMALL, "")}>
                    {timeLeft.days === 1 ? 'Jour' : 'Jours'}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className={cn(TYPOGRAPHY.H1, "mb-2 tabular-nums")}>
                    {String(timeLeft.hours).padStart(2, '0')}
                  </div>
                  <div className={cn(TYPOGRAPHY.SMALL, "")}>
                    {timeLeft.hours === 1 ? 'Heure' : 'Heures'}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className={cn(TYPOGRAPHY.H1, "mb-2 tabular-nums")}>
                    {String(timeLeft.minutes).padStart(2, '0')}
                  </div>
                  <div className={cn(TYPOGRAPHY.SMALL, "")}>
                    {timeLeft.minutes === 1 ? 'Minute' : 'Minutes'}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className={cn(TYPOGRAPHY.H1, "mb-2 tabular-nums")}>
                    {String(timeLeft.seconds).padStart(2, '0')}
                  </div>
                  <div className={cn(TYPOGRAPHY.SMALL, "")}>
                    {timeLeft.seconds === 1 ? 'Seconde' : 'Secondes'}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {message && message.trim().length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className={TYPOGRAPHY.SMALL}>{message}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </CenteredShell>
  );
}
