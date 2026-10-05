import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { FieldDescription, FieldError } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { resolveImageUrl } from '@/lib/images';
import { IMAGE_UPLOAD_INPUT_ACCEPT } from '@/lib/image-upload';
import { cn } from '@/lib/utils';

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
  placeholder = 'https://…',
  className,
  hidePreview = false,
  maxSizeBytes = DEFAULT_MAX_IMAGE_SIZE_BYTES,
  maxSizeLabel = DEFAULT_MAX_IMAGE_SIZE_LABEL,
}: ImagePickerProps) {
  const [uploading, setUploading] = useState(false);
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isDisabled = disabled || uploading;

  const handleFile = async (file: File | null) => {
    if (!file || isDisabled) return;
    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'Seules les images sont acceptées.' });
      return;
    }
    if (file.size > maxSizeBytes) {
      setFeedback({ type: 'error', message: `Image trop lourde. Taille max : ${maxSizeLabel}.` });
      return;
    }
    try {
      setFeedback(null);
      setUploading(true);
      const url = await uploadFn(file);
      onChange(url);
      setFeedback({ type: 'success', message: 'Image téléversée avec succès.' });
    } catch (error: any) {
      const uploadError =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Image refusée. Vérifiez le format, la taille ou l'URL.";
      setFeedback({ type: 'error', message: uploadError });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_UPLOAD_INPUT_ACCEPT}
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0] || null);
          event.currentTarget.value = '';
        }}
      />

      <InputGroup
        data-dragging={dropzoneActive || undefined}
        className="data-[dragging]:border-ring data-[dragging]:ring-[3px] data-[dragging]:ring-ring/50"
        onPaste={(event) => {
          if (isDisabled) return;
          const item = Array.from(event.clipboardData.items).find((entry) => entry.type.startsWith('image/'));
          if (!item) return;
          event.preventDefault();
          void handleFile(item.getAsFile());
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!isDisabled) setDropzoneActive(true);
        }}
        onDragLeave={() => setDropzoneActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDropzoneActive(false);
          void handleFile(event.dataTransfer.files?.[0] || null);
        }}
      >
        <InputGroupInput
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={isDisabled}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton variant="secondary" disabled={isDisabled} onClick={() => fileInputRef.current?.click()}>
            {uploading ? <Spinner /> : <Upload />}
            Téléverser
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <FieldDescription>
        Collez une URL, glissez-déposez ou collez une image (Ctrl+V). Taille max : {maxSizeLabel}. JPG, PNG, WebP, GIF, AVIF.
      </FieldDescription>

      {feedback?.type === 'error' ? <FieldError>{feedback.message}</FieldError> : null}
      {feedback?.type === 'success' ? <p className="text-sm text-success">{feedback.message}</p> : null}

      {!hidePreview && value ? (
        <div className="relative overflow-hidden rounded-md border">
          <AspectRatio ratio={16 / 9}>
            <img
              src={resolveImageUrl(value)}
              alt="Aperçu"
              className="size-full object-cover"
              onError={(event) => {
                (event.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </AspectRatio>
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="absolute right-2 top-2"
            onClick={() => onChange('')}
            disabled={isDisabled}
            aria-label="Retirer l'image"
          >
            <X />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
