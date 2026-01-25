import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

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
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-5xl text-center space-y-6">
        <div className="text-3xl font-semibold text-foreground">
          Site en maintenance
        </div>
        <p className="text-muted-foreground">
          Le site est temporairement indisponible. Merci de revenir plus tard.
        </p>
        
        {timeLeft && (
          <div className="space-y-4">
            <div className="text-lg font-medium text-foreground">
              Retour prévu dans :
            </div>
            <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
              <div className="bg-muted/30 border border-border/40 rounded-lg p-6">
                <div className="text-4xl font-bold text-foreground mb-2">
                  {String(timeLeft.days).padStart(2, '0')}
                </div>
                <div className="text-sm text-muted-foreground uppercase">
                  {timeLeft.days === 1 ? 'Jour' : 'Jours'}
                </div>
              </div>
              <div className="bg-muted/30 border border-border/40 rounded-lg p-6">
                <div className="text-4xl font-bold text-foreground mb-2">
                  {String(timeLeft.hours).padStart(2, '0')}
                </div>
                <div className="text-sm text-muted-foreground uppercase">
                  {timeLeft.hours === 1 ? 'Heure' : 'Heures'}
                </div>
              </div>
              <div className="bg-muted/30 border border-border/40 rounded-lg p-6">
                <div className="text-4xl font-bold text-foreground mb-2">
                  {String(timeLeft.minutes).padStart(2, '0')}
                </div>
                <div className="text-sm text-muted-foreground uppercase">
                  {timeLeft.minutes === 1 ? 'Minute' : 'Minutes'}
                </div>
              </div>
              <div className="bg-muted/30 border border-border/40 rounded-lg p-6">
                <div className="text-4xl font-bold text-foreground mb-2">
                  {String(timeLeft.seconds).padStart(2, '0')}
                </div>
                <div className="text-sm text-muted-foreground uppercase">
                  {timeLeft.seconds === 1 ? 'Seconde' : 'Secondes'}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="text-lg font-medium text-foreground">
            En attendant, choisis ton ambiance :
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Link
              to="/maintenance/wallace-gromit"
              className="rounded-xl border border-border/50 bg-muted/20 p-5 text-left transition hover:-translate-y-1 hover:border-border"
            >
              <div className="text-sm font-semibold text-foreground">Wallace & Gromit</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Installe-toi confortablement, prends du pop-corn et lance un episode culte.
              </p>
            </Link>
            <Link
              to="/maintenance/news"
              className="rounded-xl border border-border/50 bg-muted/20 p-5 text-left transition hover:-translate-y-1 hover:border-border"
            >
              <div className="text-sm font-semibold text-foreground">News lounge</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Feuillette une selection d'articles courts pour passer le temps.
              </p>
            </Link>
            <Link
              to="/maintenance/musique"
              className="rounded-xl border border-border/50 bg-muted/20 p-5 text-left transition hover:-translate-y-1 hover:border-border"
            >
              <div className="text-sm font-semibold text-foreground">Playlist AuraTracker</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Detends-toi avec la playlist speciale AuraTracker et laisse la musique faire le reste.
              </p>
            </Link>
          </div>
        </div>

        {message && message.trim().length > 0 && (
          <div className="border border-border/40 bg-muted/20 rounded-lg p-4 text-sm text-foreground">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
