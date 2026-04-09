import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { auraScrollApi, type AuraScrollPost, type AuraScrollComment } from '@/services/api';
import { resolveImageUrl } from '@/lib/images';
import { prepareImageUploadPayload } from '@/lib/image-upload';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Heart,
  MessageCircle,
  Share2,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Loader2,
  Send,
  Trash2,
  Image,
  Video,
  Upload,
  Music2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const timeAgo = (dateStr: string) => {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'maintenant';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
};

// ─── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: (post: AuraScrollPost) => void }) {
  const [step, setStep] = useState<'type' | 'media' | 'details'>('type');
  const [mediaType, setMediaType] = useState<'VIDEO' | 'PHOTO' | 'PHOTOS'>('PHOTO');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        if (mediaType === 'VIDEO') {
          if (!file.type.startsWith('video/')) throw new Error('Fichier vidéo requis.');
          const base64Data = await readFileAsBase64(file);
          const { data } = await auraScrollApi.uploadVideo(base64Data, file.type);
          urls.push(data.url);
        } else {
          const payload = await prepareImageUploadPayload(file);
          const { data } = await auraScrollApi.uploadImage(payload.base64Data, payload.mimeType);
          urls.push(data.url);
        }
      }
      setMediaUrls((prev) => [...prev, ...urls].slice(0, 10));
      setStep('details');
    } catch (err: unknown) {
      toast({ title: 'Erreur', description: err instanceof Error ? err.message : 'Upload échoué', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (mediaUrls.length === 0) return;
    setSubmitting(true);
    try {
      const { data } = await auraScrollApi.createPost({
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        mediaUrls,
        mediaType,
        thumbnailUrl: mediaUrls[0],
      });
      toast({ title: 'Post envoyé !', description: 'Il sera visible après validation par un admin.' });
      onUploaded(data.post);
      onClose();
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de publier le post.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80" onClick={onClose}>
      <div
        className="relative w-full max-w-md bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-white font-bold text-lg">Nouveau post</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'type' && (
            <>
              <p className="text-zinc-400 text-sm text-center mb-2">Quel type de contenu ?</p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { type: 'VIDEO', icon: Video, label: 'Vidéo' },
                  { type: 'PHOTO', icon: Image, label: 'Photo' },
                  { type: 'PHOTOS', icon: Image, label: 'Série' },
                ] as const).map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    onClick={() => { setMediaType(type); setStep('media'); }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 transition-all text-white"
                  >
                    <Icon className="h-6 w-6 text-pink-400" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'media' && (
            <>
              <div
                className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-zinc-600 rounded-xl p-10 cursor-pointer hover:border-pink-500 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-pink-400" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-zinc-400" />
                    <p className="text-zinc-400 text-sm text-center">
                      {mediaType === 'VIDEO' ? 'Clique pour upload une vidéo (MP4, WebM, MOV)' : 'Clique pour upload des photos'}
                    </p>
                    <p className="text-zinc-600 text-xs">
                      {mediaType === 'VIDEO' ? 'Max 100 MB' : 'Max 10 MB par image · jusqu\'à 10'}
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept={mediaType === 'VIDEO' ? 'video/mp4,video/webm,video/quicktime' : 'image/*'}
                multiple={mediaType === 'PHOTOS'}
                onChange={(e) => handleFiles(e.target.files)}
              />
              <button onClick={() => setStep('type')} className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors w-full text-center">
                ← Changer le type
              </button>
            </>
          )}

          {step === 'details' && (
            <>
              {/* Preview thumbnails */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {mediaUrls.map((url, i) => (
                  <div key={i} className="relative shrink-0">
                    {mediaType === 'VIDEO' ? (
                      <video src={resolveImageUrl(url)} className="h-20 w-14 rounded-lg object-cover" muted />
                    ) : (
                      <img src={resolveImageUrl(url)} className="h-20 w-14 rounded-lg object-cover" alt="" />
                    )}
                    <button
                      onClick={() => setMediaUrls((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
                {mediaType === 'PHOTOS' && mediaUrls.length < 10 && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="shrink-0 h-20 w-14 rounded-lg border-2 border-dashed border-zinc-600 flex items-center justify-center hover:border-pink-500 transition-colors"
                  >
                    <Plus className="h-4 w-4 text-zinc-400" />
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>

              <Input
                placeholder="Titre (optionnel)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
              <Textarea
                placeholder="Description... #aura #viral"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 resize-none"
              />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-zinc-700 text-zinc-300 hover:text-white"
                  onClick={() => setStep('media')}
                >
                  Retour
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold"
                  onClick={handleSubmit}
                  disabled={submitting || mediaUrls.length === 0}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publier'}
                </Button>
              </div>
              <p className="text-zinc-600 text-xs text-center">Ton post sera visible après validation par un admin.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Comment Panel ─────────────────────────────────────────────────────────────

function CommentPanel({
  post,
  onClose,
  onCommentAdded,
  onCommentDeleted,
  onCommentLiked,
}: {
  post: AuraScrollPost;
  onClose: () => void;
  onCommentAdded: (comment: AuraScrollComment) => void;
  onCommentDeleted: (commentId: string) => void;
  onCommentLiked: (commentId: string, liked: boolean, likeCount: number) => void;
}) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      const { data } = await auraScrollApi.addComment(post.id, content.trim());
      onCommentAdded(data.comment);
      setContent('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      toast({ title: 'Erreur', description: 'Impossible d\'envoyer le commentaire.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleLikeComment = async (comment: AuraScrollComment) => {
    try {
      const { data } = await auraScrollApi.likeComment(post.id, comment.id);
      onCommentLiked(comment.id, data.liked, data.likeCount);
    } catch { /* silent */ }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await auraScrollApi.deleteComment(post.id, commentId);
      onCommentDeleted(commentId);
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de supprimer.', variant: 'destructive' });
    }
  };

  return (
    <div
      className="absolute inset-y-0 right-0 w-80 bg-black/90 backdrop-blur-md flex flex-col border-l border-white/10 z-30"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="text-white font-semibold text-sm">{post.commentCount} commentaires</h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {post.comments.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center mt-8">Sois le premier à commenter !</p>
        ) : (
          post.comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 group">
              <div className="h-8 w-8 rounded-full bg-zinc-700 overflow-hidden shrink-0">
                {comment.user.profilePicture ? (
                  <img src={resolveImageUrl(comment.user.profilePicture)} className="h-full w-full object-cover" alt="" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-zinc-300">
                    {comment.user.username[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: comment.user.usernameColor || '#fff' }}
                  >
                    {comment.user.username}
                  </span>
                  <span className="text-zinc-600 text-[10px]">{timeAgo(comment.createdAt)}</span>
                </div>
                <p className="text-white text-sm mt-0.5 break-words">{comment.content}</p>
                <div className="flex items-center gap-3 mt-1">
                  <button
                    onClick={() => handleLikeComment(comment)}
                    className={cn('flex items-center gap-1 text-[11px] transition-colors', comment.liked ? 'text-pink-400' : 'text-zinc-500 hover:text-pink-400')}
                  >
                    <Heart className={cn('h-3 w-3', comment.liked && 'fill-current')} />
                    {comment.likeCount > 0 && comment.likeCount}
                  </button>
                  {(user?.id === comment.user.id || user?.isAdmin) && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-3 flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Commenter…"
          maxLength={500}
          className="flex-1 bg-zinc-800 text-white placeholder:text-zinc-500 text-sm rounded-full px-4 py-2 border border-zinc-700 focus:outline-none focus:border-pink-500 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() || sending}
          className="text-pink-400 disabled:text-zinc-600 hover:text-pink-300 transition-colors"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

// ─── Single Post Card ──────────────────────────────────────────────────────────

function PostCard({
  post: initialPost,
  isActive,
  onLike,
  onPostUpdate,
}: {
  post: AuraScrollPost;
  isActive: boolean;
  onLike: (liked: boolean, likeCount: number) => void;
  onPostUpdate: (updated: AuraScrollPost) => void;
}) {
  const { user } = useAuth();
  const [post, setPost] = useState(initialPost);
  const [showComments, setShowComments] = useState(false);
  const [muted, setMuted] = useState(true);
  const [imgIndex, setImgIndex] = useState(0);
  const [likePop, setLikePop] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewSent = useRef(false);

  // Sync post data from parent
  useEffect(() => { setPost(initialPost); }, [initialPost]);

  // Play/pause video when active
  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.play().catch(() => {});
      if (!viewSent.current) {
        viewSent.current = true;
        auraScrollApi.viewPost(post.id).catch(() => {});
      }
    } else {
      videoRef.current.pause();
    }
  }, [isActive, post.id]);

  const handleLike = async () => {
    const newLiked = !post.liked;
    const newCount = post.likeCount + (newLiked ? 1 : -1);
    setPost((p) => ({ ...p, liked: newLiked, likeCount: newCount }));
    onLike(newLiked, newCount);
    if (newLiked) { setLikePop(true); setTimeout(() => setLikePop(false), 600); }
    try { await auraScrollApi.likePost(post.id); } catch { /* silent */ }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.origin + '/aura-scroll').catch(() => {});
    toast({ title: 'Lien copié !', description: 'Le lien Aura Scroll a été copié.' });
  };

  const handleCommentAdded = (comment: AuraScrollComment) => {
    const updated = { ...post, comments: [comment, ...post.comments], commentCount: post.commentCount + 1 };
    setPost(updated);
    onPostUpdate(updated);
  };

  const handleCommentDeleted = (commentId: string) => {
    const updated = { ...post, comments: post.comments.filter((c) => c.id !== commentId), commentCount: Math.max(0, post.commentCount - 1) };
    setPost(updated);
    onPostUpdate(updated);
  };

  const handleCommentLiked = (commentId: string, liked: boolean, likeCount: number) => {
    const updated = { ...post, comments: post.comments.map((c) => c.id === commentId ? { ...c, liked, likeCount } : c) };
    setPost(updated);
    onPostUpdate(updated);
  };

  const isPhotos = post.mediaType === 'PHOTOS' || post.mediaType === 'PHOTO';
  const mediaSrc = resolveImageUrl(post.mediaType === 'VIDEO' ? post.mediaUrls[0] : post.mediaUrls[imgIndex]);

  return (
    <div className="relative h-full w-full select-none" onDoubleClick={handleLike}>
      {/* Media */}
      <div className="absolute inset-0 bg-black">
        {post.mediaType === 'VIDEO' ? (
          <video
            ref={videoRef}
            src={mediaSrc}
            className="h-full w-full object-contain"
            loop
            muted={muted}
            playsInline
          />
        ) : (
          <img
            src={mediaSrc}
            className="h-full w-full object-contain"
            alt={post.title || ''}
          />
        )}
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

      {/* Double-tap like pop */}
      {likePop && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Heart className="h-24 w-24 fill-white text-white opacity-90 animate-ping" />
        </div>
      )}

      {/* Photo carousel navigation */}
      {isPhotos && post.mediaUrls.length > 1 && (
        <>
          <button
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 rounded-full p-1.5 z-10"
            onClick={(e) => { e.stopPropagation(); setImgIndex((i) => Math.max(0, i - 1)); }}
            disabled={imgIndex === 0}
          >
            <ChevronUp className="h-4 w-4 text-white rotate-[-90deg]" />
          </button>
          <button
            className="absolute right-20 top-1/2 -translate-y-1/2 bg-black/40 rounded-full p-1.5 z-10"
            onClick={(e) => { e.stopPropagation(); setImgIndex((i) => Math.min(post.mediaUrls.length - 1, i + 1)); }}
            disabled={imgIndex === post.mediaUrls.length - 1}
          >
            <ChevronDown className="h-4 w-4 text-white rotate-[-90deg]" />
          </button>
          {/* Dots */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {post.mediaUrls.map((_, i) => (
              <div key={i} className={cn('h-1 rounded-full transition-all', i === imgIndex ? 'bg-white w-4' : 'bg-white/40 w-1')} />
            ))}
          </div>
        </>
      )}

      {/* Mute button (video) */}
      {post.mediaType === 'VIDEO' && (
        <button
          className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm rounded-full p-2 z-10"
          onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
        >
          {muted ? <VolumeX className="h-4 w-4 text-white" /> : <Volume2 className="h-4 w-4 text-white" />}
        </button>
      )}

      {/* Right action bar */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-20">
        {/* Author avatar */}
        <NavLink to={`/profile/${post.userId}`} onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-white overflow-hidden bg-zinc-700">
              {post.user.profilePicture ? (
                <img src={resolveImageUrl(post.user.profilePicture)} className="h-full w-full object-cover" alt="" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-white font-bold">
                  {post.user.username[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-pink-500 rounded-full h-5 w-5 flex items-center justify-center">
              <Plus className="h-3 w-3 text-white" />
            </div>
          </div>
        </NavLink>

        {/* Like */}
        <button
          className="flex flex-col items-center gap-1"
          onClick={(e) => { e.stopPropagation(); handleLike(); }}
        >
          <div className={cn('bg-transparent transition-transform', post.liked && 'scale-110')}>
            <Heart
              className={cn('h-8 w-8 drop-shadow-lg transition-all', post.liked ? 'fill-pink-500 text-pink-500 scale-110' : 'text-white')}
            />
          </div>
          <span className="text-white text-xs font-semibold drop-shadow">{post.likeCount}</span>
        </button>

        {/* Comment */}
        <button
          className="flex flex-col items-center gap-1"
          onClick={(e) => { e.stopPropagation(); setShowComments((s) => !s); }}
        >
          <MessageCircle className={cn('h-8 w-8 drop-shadow-lg', showComments ? 'text-pink-400' : 'text-white')} />
          <span className="text-white text-xs font-semibold drop-shadow">{post.commentCount}</span>
        </button>

        {/* Share */}
        <button
          className="flex flex-col items-center gap-1"
          onClick={(e) => { e.stopPropagation(); handleShare(); }}
        >
          <Share2 className="h-8 w-8 text-white drop-shadow-lg" />
          <span className="text-white text-xs font-semibold drop-shadow">Partager</span>
        </button>

        {/* Music disc (decorative) */}
        <div className="relative h-9 w-9 rounded-full border-2 border-zinc-600 bg-zinc-800 flex items-center justify-center overflow-hidden animate-spin" style={{ animationDuration: '8s' }}>
          <Music2 className="h-4 w-4 text-white" />
        </div>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-16 pb-6 px-4 z-20 space-y-2">
        <div className="flex items-center gap-2">
          <NavLink to={`/profile/${post.userId}`} onClick={(e) => e.stopPropagation()}>
            <span
              className="font-bold text-sm drop-shadow hover:underline"
              style={{ color: post.user.usernameColor || '#fff' }}
            >
              @{post.user.username}
            </span>
          </NavLink>
          {post.viewCount !== undefined && post.viewCount > 0 && (
            <span className="text-zinc-400 text-xs">{post.viewCount} vues</span>
          )}
        </div>
        {post.title && (
          <p className="text-white font-semibold text-sm drop-shadow">{post.title}</p>
        )}
        {post.description && (
          <p className="text-zinc-200 text-sm leading-snug drop-shadow line-clamp-3">{post.description}</p>
        )}
        {/* Music bar */}
        <div className="flex items-center gap-2 mt-1">
          <Music2 className="h-3 w-3 text-zinc-400 shrink-0" />
          <div className="overflow-hidden">
            <p className="text-zinc-300 text-xs whitespace-nowrap animate-marquee">
              🎵 Aura Scroll Original Sound • {post.user.username}
            </p>
          </div>
        </div>
      </div>

      {/* Delete button (own posts / admin) */}
      {(user?.id === post.userId || user?.isAdmin) && (
        <button
          className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm rounded-full p-2 z-10 opacity-50 hover:opacity-100 transition-opacity"
          onClick={async (e) => {
            e.stopPropagation();
            if (!confirm('Supprimer ce post ?')) return;
            try {
              await auraScrollApi.deletePost(post.id);
              toast({ title: 'Post supprimé' });
            } catch {
              toast({ title: 'Erreur', variant: 'destructive' });
            }
          }}
        >
          <Trash2 className="h-4 w-4 text-white" />
        </button>
      )}

      {/* Comment panel */}
      {showComments && (
        <CommentPanel
          post={post}
          onClose={() => setShowComments(false)}
          onCommentAdded={handleCommentAdded}
          onCommentDeleted={handleCommentDeleted}
          onCommentLiked={handleCommentLiked}
        />
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AuraScroll() {
  const [posts, setPosts] = useState<AuraScrollPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const fetchFeed = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    try {
      const { data } = await auraScrollApi.getFeed(cursor);
      setPosts((prev) => cursor ? [...prev, ...data.posts] : data.posts);
      setNextCursor(data.nextCursor);
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de charger le feed.', variant: 'destructive' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  // Intersection observer for active index tracking
  useEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = cardRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx !== -1) setActiveIndex(idx);
          }
        }
      },
      { threshold: 0.6 }
    );

    cardRefs.current.forEach((el) => { if (el) observerRef.current?.observe(el); });
    return () => observerRef.current?.disconnect();
  }, [posts.length]);

  // Load more when last post is active
  useEffect(() => {
    if (activeIndex === posts.length - 2 && nextCursor && !loadingMore) {
      fetchFeed(nextCursor);
    }
  }, [activeIndex, posts.length, nextCursor, loadingMore, fetchFeed]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(activeIndex + 1, posts.length - 1);
        cardRefs.current[next]?.scrollIntoView({ behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(activeIndex - 1, 0);
        cardRefs.current[prev]?.scrollIntoView({ behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeIndex, posts.length]);

  const handlePostUpdate = (index: number, updated: AuraScrollPost) => {
    setPosts((prev) => prev.map((p, i) => i === index ? updated : p));
  };

  const handleLike = (index: number, liked: boolean, likeCount: number) => {
    setPosts((prev) => prev.map((p, i) => i === index ? { ...p, liked, likeCount } : p));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="text-4xl">✨</div>
          <Loader2 className="h-8 w-8 animate-spin text-pink-400" />
          <p className="text-zinc-400 text-sm">Chargement de l'Aura Scroll…</p>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 z-50">
        <div className="text-6xl">🎬</div>
        <div className="text-center space-y-2">
          <h2 className="text-white text-2xl font-bold">Aura Scroll</h2>
          <p className="text-zinc-400">Aucun post pour l'instant. Sois le premier !</p>
        </div>
        <Button
          className="bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold px-8 py-3 rounded-full"
          onClick={() => setShowUpload(true)}
        >
          <Plus className="h-5 w-5 mr-2" />
          Créer un post
        </Button>
        {showUpload && (
          <UploadModal
            onClose={() => setShowUpload(false)}
            onUploaded={() => setShowUpload(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 overflow-hidden">
      {/* Scrollable feed */}
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {posts.map((post, index) => (
          <div
            key={post.id}
            ref={(el) => { cardRefs.current[index] = el; }}
            className="snap-start snap-always relative w-full"
            style={{ height: '100dvh' }}
          >
            <PostCard
              post={post}
              isActive={activeIndex === index}
              onLike={(liked, likeCount) => handleLike(index, liked, likeCount)}
              onPostUpdate={(updated) => handlePostUpdate(index, updated)}
            />
          </div>
        ))}

        {/* Loading more spinner */}
        {loadingMore && (
          <div className="snap-start flex items-center justify-center" style={{ height: '100dvh' }}>
            <Loader2 className="h-8 w-8 animate-spin text-pink-400" />
          </div>
        )}

        {/* End of feed */}
        {!nextCursor && !loadingMore && posts.length > 0 && (
          <div className="snap-start flex flex-col items-center justify-center gap-4" style={{ height: '100dvh' }}>
            <div className="text-4xl">✨</div>
            <p className="text-zinc-400 text-sm">Tu as tout vu !</p>
            <button
              onClick={() => { setActiveIndex(0); cardRefs.current[0]?.scrollIntoView({ behavior: 'smooth' }); }}
              className="text-pink-400 text-sm hover:text-pink-300 transition-colors"
            >
              Retour au début
            </button>
          </div>
        )}
      </div>

      {/* Top header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 z-40 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="bg-black/40 backdrop-blur-md rounded-full px-4 py-1.5 border border-white/10">
            <span className="text-white font-black text-sm tracking-tight">Aura Scroll</span>
            <span className="text-pink-400 text-sm font-black"> ✨</span>
          </div>
        </div>

        {/* Navigation arrows */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          <button
            onClick={() => {
              const prev = Math.max(activeIndex - 1, 0);
              cardRefs.current[prev]?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="bg-black/40 backdrop-blur-md rounded-full p-2 border border-white/10 disabled:opacity-30 hover:bg-black/60 transition-colors"
            disabled={activeIndex === 0}
          >
            <ChevronUp className="h-4 w-4 text-white" />
          </button>
          <button
            onClick={() => {
              const next = Math.min(activeIndex + 1, posts.length - 1);
              cardRefs.current[next]?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="bg-black/40 backdrop-blur-md rounded-full p-2 border border-white/10 disabled:opacity-30 hover:bg-black/60 transition-colors"
            disabled={activeIndex === posts.length - 1}
          >
            <ChevronDown className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      {/* Upload FAB */}
      <button
        onClick={() => setShowUpload(true)}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-bold rounded-full px-6 py-3 shadow-lg shadow-pink-900/40 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
      >
        <Plus className="h-5 w-5" />
        Poster
      </button>

      {/* Progress dots */}
      {posts.length > 1 && posts.length <= 20 && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1">
          {posts.map((_, i) => (
            <button
              key={i}
              onClick={() => cardRefs.current[i]?.scrollIntoView({ behavior: 'smooth' })}
              className={cn(
                'rounded-full transition-all',
                i === activeIndex ? 'bg-white h-4 w-1.5' : 'bg-white/30 h-1.5 w-1.5'
              )}
            />
          ))}
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            toast({ title: 'Post soumis !', description: 'En attente de validation.' });
            setShowUpload(false);
          }}
        />
      )}
    </div>
  );
}
