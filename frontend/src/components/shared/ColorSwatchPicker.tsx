import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ColorSwatchPickerProps {
  value: string;
  onChange: (color: string) => void;
  colors: readonly string[];
  label?: string;
  className?: string;
}

/** Choix d'une couleur de contenu (pseudo, badge, tag) : pastilles prédéfinies + sélecteur libre. */
export function ColorSwatchPicker({ value, onChange, colors, label = 'Couleur', className }: ColorSwatchPickerProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} role="group" aria-label={label}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
          className={cn('size-6 rounded-full border-2 transition-transform hover:scale-110', value === color ? 'border-foreground' : 'border-transparent')}
          style={{ backgroundColor: color }}
        />
      ))}
      <Input type="color" aria-label={`${label} personnalisée`} value={value} onChange={(event) => onChange(event.target.value)} className="h-7 w-9 cursor-pointer p-0.5" />
    </div>
  );
}
