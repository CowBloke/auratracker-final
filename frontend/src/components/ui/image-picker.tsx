import { useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { resolveImageUrl } from '@/lib/images';

const DEFAULT_MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_SIZE_LABEL = '10 Mo';

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  uploadFn: (file: File) => Promise<string>;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  hidePreview?: boolean;
  maxSizeBytes?: number;
  maxSizeLabel?: string;
}

export function ImagePicker({
  value,
  onChange,
  uploadFn,
  disabled,
  placeholder = 'https://...',
  className,
  hidePreview = false,
  maxSizeBytes = DEFAULT_MAX_IMAGE_SIZE_BYTES,
  maxSizeLabel = DEFAULT_MAX_IMAGE_SIZE_LABEL,
}: ImagePickerProps) {
  const [uploading, setUploading] = useState(false);
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isDisabled = disabled || uploading;

  const handleFile = async (file: File | null) => {
    if (!file || isDisabled) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Seules les images sont acceptées.');
      return;
    }
    if (file.size > maxSizeBytes) {
      setErrorMessage(`Image trop lourde. Taille max: ${maxSizeLabel}.`);
      return;
    }
    try {
      setErrorMessage(null);
      setUploading(true);
      const url = await uploadFn(file);
      onChange(url);
    } catch {
      // uploadFn is responsible for showing error feedback
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] || null);
          e.currentTarget.value = '';
        }}
      />

      <div
        tabIndex={0}
        onPaste={(e) => {
          if (isDisabled) return;
          const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
          if (!item) return;
          e.preventDefault();
          handleFile(item.getAsFile());
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!isDisabled) setDropzoneActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDisabled) setDropzoneActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setDropzoneActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDropzoneActive(false);
          handleFile(e.dataTransfer.files?.[0] || null);
        }}
        onClick={() => {
          if (!isDisabled) fileInputRef.current?.click();
        }}
        className={cn(
          'rounded-md border border-dashed px-4 py-4 text-center text-sm outline-none transition-colors',
          dropzoneActive ? 'border-primary bg-primary/10' : 'border-border bg-background/60',
          isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary/60',
        )}
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Upload en cours...
          </span>
        ) : (
          <span className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
            <span className="flex items-center justify-center gap-2">
              <Upload className="h-4 w-4" />
              Cliquez, glissez ou collez (Ctrl+V)
            </span>
            <span className="text-xs">
              Taille max: {maxSizeLabel}
            </span>
          </span>
        )}
      </div>

      {errorMessage && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}

      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={isDisabled}
        className="bg-transparent"
      />

      {!hidePreview && value && (
        <div className="relative">
          <img
            src={resolveImageUrl(value)}
            alt="Preview"
            className="max-h-40 w-full max-w-full rounded-md border border-border/30 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange('')}
            disabled={isDisabled}
            className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center bg-background/80 border border-border rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Retirer l'image"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
