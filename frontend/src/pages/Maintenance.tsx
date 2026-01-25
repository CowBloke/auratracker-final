import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';

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
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-6">
      <div className="max-w-4xl text-center space-y-6">
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
            <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
              <Card className="border-border/40">
                <CardContent className="p-6">
                  <div className={cn(TYPOGRAPHY.H1, "mb-2 tabular-nums")}>
                    {String(timeLeft.days).padStart(2, '0')}
                  </div>
                  <div className={cn(TYPOGRAPHY.SMALL, "uppercase")}>
                    {timeLeft.days === 1 ? 'Jour' : 'Jours'}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/40">
                <CardContent className="p-6">
                  <div className={cn(TYPOGRAPHY.H1, "mb-2 tabular-nums")}>
                    {String(timeLeft.hours).padStart(2, '0')}
                  </div>
                  <div className={cn(TYPOGRAPHY.SMALL, "uppercase")}>
                    {timeLeft.hours === 1 ? 'Heure' : 'Heures'}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/40">
                <CardContent className="p-6">
                  <div className={cn(TYPOGRAPHY.H1, "mb-2 tabular-nums")}>
                    {String(timeLeft.minutes).padStart(2, '0')}
                  </div>
                  <div className={cn(TYPOGRAPHY.SMALL, "uppercase")}>
                    {timeLeft.minutes === 1 ? 'Minute' : 'Minutes'}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/40">
                <CardContent className="p-6">
                  <div className={cn(TYPOGRAPHY.H1, "mb-2 tabular-nums")}>
                    {String(timeLeft.seconds).padStart(2, '0')}
                  </div>
                  <div className={cn(TYPOGRAPHY.SMALL, "uppercase")}>
                    {timeLeft.seconds === 1 ? 'Seconde' : 'Secondes'}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className={TYPOGRAPHY.H5}>
            En attendant, choisis ton ambiance :
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Link to="/maintenance/wallace-gromit">
              <Card className="border-border/40 hover:border-foreground/30 transition-colors">
                <CardHeader>
                  <CardTitle className={TYPOGRAPHY.SMALL}>Wallace & Gromit</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Installe-toi confortablement, prends du pop-corn et lance un épisode culte.
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
            <Link to="/maintenance/news">
              <Card className="border-border/40 hover:border-foreground/30 transition-colors">
                <CardHeader>
                  <CardTitle className={TYPOGRAPHY.SMALL}>News lounge</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Feuillette une sélection d'articles courts pour passer le temps.
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
            <Link to="/maintenance/musique">
              <Card className="border-border/40 hover:border-foreground/30 transition-colors">
                <CardHeader>
                  <CardTitle className={TYPOGRAPHY.SMALL}>Playlist AuraTracker</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Détends-toi avec la playlist spéciale AuraTracker et laisse la musique faire le reste.
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {message && message.trim().length > 0 && (
          <Card className="border-border/40">
            <CardContent className="p-4">
              <p className={TYPOGRAPHY.SMALL}>{message}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
