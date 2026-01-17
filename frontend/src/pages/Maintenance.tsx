interface MaintenanceProps {
  message?: string;
}

export default function Maintenance({ message }: MaintenanceProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-lg text-center space-y-4">
        <div className="text-3xl font-semibold text-foreground">
          Site en maintenance
        </div>
        <p className="text-muted-foreground">
          Le site est temporairement indisponible. Merci de revenir plus tard.
        </p>
        {message && message.trim().length > 0 && (
          <div className="border border-border/40 bg-muted/20 rounded-lg p-4 text-sm text-foreground">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
