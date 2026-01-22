import { useState, useEffect } from 'react';

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
      <div className="max-w-2xl text-center space-y-6">
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

        {message && message.trim().length > 0 && (
          <div className="border border-border/40 bg-muted/20 rounded-lg p-4 text-sm text-foreground">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
