import { useState, type FormEvent, type ReactNode, useRef } from 'react';
import { Loader2, X, Upload } from 'lucide-react';
import { bugReportApi, uploadUserImage } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { SPACING, TYPOGRAPHY } from '@/lib/design-system';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface BugReportPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
}

export default function BugReportPanel({ open, onOpenChange, trigger }: BugReportPanelProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setImages([]);
    setSubmitting(false);
    setSubmitted(false);
    setError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files ?? []);
    if (files.length === 0) return;

    if (images.length + files.length > 5) {
      setError(t('bug_report_error_max_images'));
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      for (const file of files) {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
        const { data } = await uploadUserImage({ base64Data, mimeType: file.type });
        setImages((prev) => [...prev, data.imageUrl]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('bug_report_error_upload'));
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      setError(t('bug_report_error_fill_all_fields'));
      return;
    }

    if (title.length > 100) {
      setError(t('bug_report_error_title_max'));
      return;
    }

    if (description.length > 2000) {
      setError(t('bug_report_error_description_max'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await bugReportApi.create({ 
        title: title.trim(), 
        description: description.trim(),
        images: images.length > 0 ? images : undefined,
      });
      setSubmitted(true);
      setTitle('');
      setDescription('');
      setImages([]);
    } catch (err: any) {
      setError(err.response?.data?.error || t('bug_report_error_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle>{t('bug_report_title')}</SheetTitle>
          <SheetDescription>
            {t('bug_report_description')}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex-1 overflow-y-auto pr-1">
          {submitted ? (
            <div className={SPACING.SECTION_SPACING}>
              <div className={SPACING.CARD_SPACING}>
                <h3 className={TYPOGRAPHY.BODY}>{t('bug_report_sent_title')}</h3>
                <p className={TYPOGRAPHY.SMALL}>
                  {t('bug_report_sent_description')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSubmitted(false)}>
                  {t('bug_report_send_another')}
                </Button>
                <Button onClick={() => handleOpenChange(false)}>
                  {t('common_close')}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={SPACING.SECTION_SPACING}>
              {error ? (
                <div className={cn('border border-border/30 px-4 py-3', TYPOGRAPHY.SMALL)}>
                  {error}
                </div>
              ) : null}

              <div className={SPACING.CARD_SPACING}>
                <label className={TYPOGRAPHY.SMALL}>{t('bug_report_label_title')}</label>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('bug_report_placeholder_title')}
                  maxLength={100}
                  disabled={submitting}
                />
                <p className={cn(TYPOGRAPHY.XS, 'text-right')}>
                  {title.length}/100
                </p>
              </div>

              <div className={SPACING.CARD_SPACING}>
                <label className={TYPOGRAPHY.SMALL}>{t('bug_report_label_description')}</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('bug_report_placeholder_description')}
                  className="min-h-[220px]"
                  maxLength={2000}
                  disabled={submitting}
                />
                <p className={cn(TYPOGRAPHY.XS, 'text-right')}>
                  {description.length}/2000
                </p>
              </div>

              <div className={SPACING.CARD_SPACING}>
                <label className={TYPOGRAPHY.SMALL}>{t('bug_report_label_images_optional')}</label>
                <div className="flex gap-2 items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={submitting || uploadingImage || images.length >= 5}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadingImage ? t('bug_report_uploading') : `${t('bug_report_add_image')} (${images.length}/5)`}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
                {images.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={img}
                          alt={`Upload ${idx}`}
                          className="w-full h-24 object-cover rounded border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title={t('bug_report_remove_image')}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={submitting}
                >
                  {t('common_cancel')}
                </Button>

                <Button
                  type="submit"
                  disabled={submitting || !title.trim() || !description.trim()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('common_sending')}
                    </>
                  ) : (
                    t('common_send')
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
