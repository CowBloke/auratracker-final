import { useState, type FormEvent, type ReactNode, useRef, useEffect } from 'react';
import { Loader2, X, Upload, ArrowLeft, Bug } from 'lucide-react';
import { bugReportApi, uploadUserImage, type BugReport, type BugReportMessage } from '@/services/api';
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

type View = 'form' | 'list' | 'conversation';

export default function BugReportPanel({ open, onOpenChange, trigger }: BugReportPanelProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Navigation state
  const [view, setView] = useState<View>('form');
  const [myReports, setMyReports] = useState<BugReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [messages, setMessages] = useState<BugReportMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setImages([]);
    setSubmitting(false);
    setError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetForm();
      setView('form');
      setSelectedReport(null);
      setMessages([]);
    }
  };

  const loadMyReports = async () => {
    setLoadingReports(true);
    try {
      const res = await bugReportApi.getMyReports();
      setMyReports(res.data.bugReports);
    } catch {
      // silent
    } finally {
      setLoadingReports(false);
    }
  };

  const openReport = async (report: BugReport) => {
    setSelectedReport(report);
    setView('conversation');
    setLoadingMessages(true);
    try {
      const res = await bugReportApi.getMessages(report.id);
      setMessages(res.data.messages);
    } catch {
      // silent
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (view === 'list') loadMyReports();
  }, [view]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      const res = await bugReportApi.create({
        title: title.trim(),
        description: description.trim(),
        images: images.length > 0 ? images : undefined,
      });
      const newReport = res.data.bugReport;
      resetForm();
      // Open conversation for the new report right away
      await openReport(newReport);
    } catch (err: any) {
      setError(err.response?.data?.error || t('bug_report_error_generic'));
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!reply.trim() || !selectedReport) return;
    setSendingReply(true);
    try {
      const res = await bugReportApi.sendMessage(selectedReport.id, { body: reply.trim() });
      setMessages(prev => [...prev, res.data.message]);
      setReply('');
    } catch {
      // silent
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        {view === 'form' && (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40">
              <div className="flex items-center justify-between">
                <SheetTitle>{t('bug_report_title')}</SheetTitle>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 px-2" onClick={() => setView('list')}>
                  Mes signalements
                </Button>
              </div>
              <SheetDescription>{t('bug_report_description')}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4">
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
                  <p className={cn(TYPOGRAPHY.XS, 'text-right')}>{title.length}/100</p>
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
                  <p className={cn(TYPOGRAPHY.XS, 'text-right')}>{description.length}/2000</p>
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
                          <img src={img} alt={`Upload ${idx}`} className="w-full h-24 object-cover rounded border border-border" />
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
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
                    {t('common_cancel')}
                  </Button>
                  <Button type="submit" disabled={submitting || !title.trim() || !description.trim()}>
                    {submitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('common_sending')}</>
                    ) : t('common_send')}
                  </Button>
                </div>
              </form>
            </div>
          </>
        )}

        {view === 'list' && (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setView('form')}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <SheetTitle>Mes signalements</SheetTitle>
              </div>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              {loadingReports ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
                </div>
              ) : myReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50 gap-2">
                  <Bug className="h-8 w-8" />
                  <p className="text-sm">Aucun signalement</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {myReports.map(report => (
                    <button
                      key={report.id}
                      className="w-full text-left px-6 py-4 hover:bg-muted/20 transition-colors"
                      onClick={() => openReport(report)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded', report.status === 'DONE' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400')}>
                          {report.status === 'DONE' ? 'Résolu' : 'En cours'}
                        </span>
                        <span className="text-xs text-muted-foreground/50">
                          {new Date(report.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-tight truncate">{report.title}</p>
                      {report.adminReply && (
                        <p className="text-xs text-indigo-400/70 mt-0.5 truncate">Support: {report.adminReply}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border/40 shrink-0">
              <Button variant="outline" size="sm" className="w-full" onClick={() => setView('form')}>
                <Bug className="h-4 w-4 mr-2" />
                Nouveau signalement
              </Button>
            </div>
          </>
        )}

        {view === 'conversation' && selectedReport && (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setView('list')}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <SheetTitle className="text-base truncate">{selectedReport.title}</SheetTitle>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded', selectedReport.status === 'DONE' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400')}>
                      {selectedReport.status === 'DONE' ? 'Résolu' : 'En cours'}
                    </span>
                  </div>
                </div>
              </div>
            </SheetHeader>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
              {loadingMessages ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
                </div>
              ) : messages.map(msg => {
                const isMe = !msg.isAdmin;
                return (
                  <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                      isMe ? 'bg-muted/40 border border-border/40' : 'bg-indigo-500/10 border border-indigo-500/20'
                    )}>
                      <p className="text-[10px] text-muted-foreground/60 mb-1">
                        {isMe ? 'Vous' : 'Support'}
                        {' · '}
                        {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                      {msg.images && (() => {
                        const imgs: string[] = JSON.parse(msg.images);
                        return imgs.length > 0 ? (
                          <div className="mt-2 grid grid-cols-2 gap-1">
                            {imgs.map((url, i) => (
                              <img key={i} src={url} alt="" className="w-full h-20 object-cover rounded border border-border/30" />
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply box */}
            {selectedReport.status !== 'DONE' && (
              <div className="px-4 py-4 border-t border-border/40 shrink-0 space-y-2">
                <Textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Ajouter un message…"
                  className="min-h-[80px] resize-none"
                  disabled={sendingReply}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && reply.trim()) handleSendReply();
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleSendReply}
                  disabled={!reply.trim() || sendingReply}
                  className="w-full"
                >
                  {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Envoyer'}
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
