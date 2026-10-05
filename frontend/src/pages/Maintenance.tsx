import { useState, useEffect } from 'react';
import { Wrench } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { AuthShell } from '@/components/layout/AuthShell';

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

  const units = timeLeft
    ? [
        { value: timeLeft.days, singular: 'Jour', plural: 'Jours' },
        { value: timeLeft.hours, singular: 'Heure', plural: 'Heures' },
        { value: timeLeft.minutes, singular: 'Minute', plural: 'Minutes' },
        { value: timeLeft.seconds, singular: 'Seconde', plural: 'Secondes' },
      ]
    : [];

  return (
    <AuthShell size="lg">
      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Wrench />
              </EmptyMedia>
              <EmptyTitle>Site en maintenance</EmptyTitle>
              <EmptyDescription>Le site est temporairement indisponible. Merci de revenir plus tard.</EmptyDescription>
            </EmptyHeader>
            {message && message.trim().length > 0 ? <EmptyContent>{message}</EmptyContent> : null}
          </Empty>
        </CardContent>
      </Card>

      {timeLeft ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Retour prévu dans</CardTitle>
            <CardDescription>Le site sera de nouveau accessible à la fin du compte à rebours.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {units.map((unit) => (
                <Card key={unit.singular} className="gap-0 py-0 shadow-none"><CardContent className="p-4 flex flex-col items-center gap-1">
                  <span className="text-3xl font-semibold tabular-nums">{String(unit.value).padStart(2, '0')}</span>
                  <span className="text-sm text-muted-foreground">{unit.value === 1 ? unit.singular : unit.plural}</span>
                </CardContent></Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </AuthShell>
  );
}
