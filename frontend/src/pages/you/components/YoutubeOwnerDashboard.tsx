import { useEffect, useRef, useState } from 'react';
import { Play, Upload, Loader2, Video as VideoIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { youApi, type YouBusiness } from '@/services/api';
import { withRouteError } from '../utils';
import { ModalWrap, FieldRow } from './ui';

export function YoutubeOwnerDashboard({
  open,
  onClose,
  business,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness;
  onSubmitted: (refreshBalance?: boolean) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const videos = business.youtubeVideos ?? [];

  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setVideoFile(null);
      setFormOpen(false);
    }
  }, [open]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async () => {
    if (!title.trim() || !videoFile) return;
    setSaving(true);
    try {
      const base64Data = await fileToBase64(videoFile);
      await withRouteError(
        () => youApi.uploadYoutubeVideo(business.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          videoBase64: base64Data,
          mimeType: videoFile.type,
        }),
        'Impossible de mettre en ligne la vidéo.'
      );
      toast.success('Vidéo en ligne !');
      setTitle('');
      setDescription('');
      setVideoFile(null);
      setFormOpen(false);
      await onSubmitted(true);
    } finally {
      setSaving(false);
    }
  };

  const cancelForm = () => {
    setFormOpen(false);
    setTitle('');
    setDescription('');
    setVideoFile(null);
  };

  if (!open) return null;

  return (
    <>
      <ModalWrap open={open} onClose={onClose} title="Chaîne YouTube" desc="Gère tes vidéos et uploade de nouveaux contenus." wide>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">{videos.length} vidéo(s)</p>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Vidéo
          </Button>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {videos.map((video) => (
            <div key={video.id} className="rounded-xl border border-border/40 bg-muted/10 p-4 flex items-start gap-4">
              <div className="h-20 w-32 shrink-0 bg-black rounded-lg flex items-center justify-center overflow-hidden border border-border/50 relative">
                 <VideoIcon className="text-white/20 w-8 h-8 absolute" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{video.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{video.description ?? 'Aucune description'}</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                     <Play className="w-3 h-3" /> {video.views.toLocaleString('fr-FR')} vues
                  </span>
                  <span className="text-[10px] text-muted-foreground">{new Date(video.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            </div>
          ))}

          {videos.length === 0 && (
            <div className="text-center py-12 border border-dashed border-border/40 rounded-xl">
              <VideoIcon className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Aucune vidéo sur ta chaîne.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setFormOpen(true)}>
                Uploader ma première vidéo
              </Button>
            </div>
          )}
        </div>
      </ModalWrap>

      {/* Upload Form Modal */}
      <ModalWrap open={formOpen} onClose={cancelForm} title="Upload Vidéo" desc="Publie une nouvelle vidéo sur ta chaîne.">
         <FieldRow label="Titre">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de la vidéo" maxLength={100} />
         </FieldRow>
         <FieldRow label="Description (optionnel)">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Description..." />
         </FieldRow>
         <FieldRow label="Fichier vidéo (MP4/WebM)">
             <div className="flex flex-col gap-2">
                 <Input 
                   ref={fileInputRef} 
                   type="file" 
                   accept="video/mp4,video/webm,video/quicktime" 
                   onChange={(e) => {
                     const file = e.target.files?.[0];
                     if (file) {
                         if (file.size > 50 * 1024 * 1024) {
                             toast.error('Le fichier ne doit pas dépasser 50 Mo.');
                             if (fileInputRef.current) fileInputRef.current.value = '';
                             return;
                         }
                         setVideoFile(file);
                     }
                   }} 
                 />
                 {videoFile && <p className="text-xs text-muted-foreground">Fichier sélectionné : {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} Mo)</p>}
             </div>
         </FieldRow>
         <div className="flex justify-end gap-2 mt-4">
             <Button variant="ghost" size="sm" onClick={cancelForm} disabled={saving}>Annuler</Button>
             <Button size="sm" onClick={handleUpload} disabled={saving || !title.trim() || !videoFile}>
                 {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                 Mettre en ligne
             </Button>
         </div>
      </ModalWrap>
    </>
  );
}
