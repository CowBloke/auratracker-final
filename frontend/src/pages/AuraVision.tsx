import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Camera, Flag, Mic, MicOff, MonitorPlay, RefreshCw, Send, Video, VideoOff, Waves } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useSocketBase } from '@/contexts/SocketContext';
import { cn } from '@/lib/utils';
import { auraVisionApi } from '@/services/api';

type FilterPreset = 'none' | 'retro' | 'noir' | 'dream' | 'laser';
type EffectPreset = 'halo' | 'scanlines' | 'pulse' | 'prism';

type AuraVisionSignal =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit };

const FILTER_OPTIONS: Array<{ value: FilterPreset; label: string }> = [
  { value: 'none', label: 'Naturel' },
  { value: 'retro', label: 'Retro VHS' },
  { value: 'noir', label: 'Noir & blanc' },
  { value: 'dream', label: 'Dream' },
  { value: 'laser', label: 'Laser pop' },
];

const EFFECT_OPTIONS: Array<{ value: EffectPreset; label: string; description: string }> = [
  { value: 'halo', label: 'Halo', description: 'Lueur douce autour du cadre' },
  { value: 'scanlines', label: 'Scanlines', description: 'Ambiance webcam retro' },
  { value: 'pulse', label: 'Pulse', description: 'Cadre vivant et nerveux' },
  { value: 'prism', label: 'Prism', description: 'Reflets colores plus fun' },
];

const buildIceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const turnUrls = (import.meta.env.VITE_AURAVISION_TURN_URLS ?? '')
    .split(',')
    .map((value: string) => value.trim())
    .filter(Boolean);

  if (turnUrls.length > 0) {
    servers.push({
      urls: turnUrls,
      username: import.meta.env.VITE_AURAVISION_TURN_USERNAME ?? undefined,
      credential: import.meta.env.VITE_AURAVISION_TURN_CREDENTIAL ?? undefined,
    });
  }

  return servers;
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: buildIceServers(),
};

type AuraVisionMessage = {
  id: string;
  senderId: string;
  sender: string;
  body: string;
  createdAt: string;
};

const getFilterStyle = (preset: FilterPreset, intensity: number) => {
  const amount = intensity / 100;

  switch (preset) {
    case 'retro':
      return `sepia(${0.35 + amount * 0.55}) saturate(${1.05 + amount * 1.1}) contrast(${1.02 + amount * 0.3})`;
    case 'noir':
      return `grayscale(${0.6 + amount * 0.4}) contrast(${1.1 + amount * 0.35}) brightness(${0.95 + amount * 0.08})`;
    case 'dream':
      return `saturate(${1.08 + amount * 0.6}) brightness(${1.02 + amount * 0.16}) blur(${amount * 0.8}px)`;
    case 'laser':
      return `hue-rotate(${Math.round(120 * amount)}deg) saturate(${1.2 + amount * 1.5}) contrast(${1.04 + amount * 0.35})`;
    case 'none':
    default:
      return `saturate(${1 + amount * 0.1}) contrast(${1 + amount * 0.05})`;
  }
};

export default function AuraVision() {
  const { user } = useAuth();
  const { socket, connected } = useSocketBase();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const currentPeerIdRef = useRef<string | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const autoNextRef = useRef(true);
  const messagesRef = useRef<HTMLDivElement>(null);

  const [filterPreset, setFilterPreset] = useState<FilterPreset>('laser');
  const [effectPreset, setEffectPreset] = useState<EffectPreset>('halo');
  const [intensity, setIntensity] = useState(62);
  const [effectsOpen, setEffectsOpen] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [status, setStatus] = useState('Prends la main sur AuraVision et lance une rencontre aleatoire.');
  const [error, setError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState<string | null>(null);
  const [peerConnected, setPeerConnected] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(true);
  const [chatDraft, setChatDraft] = useState('');
  const [messages, setMessages] = useState<AuraVisionMessage[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const mirrorLocal = true;
  const rulesStorageKey = useMemo(() => `auravision-rules-accepted-${user?.id ?? 'anon'}`, [user?.id]);

  const filterStyle = useMemo(() => getFilterStyle(filterPreset, intensity), [filterPreset, intensity]);
  const effectMeta = useMemo(
    () => EFFECT_OPTIONS.find((option) => option.value === effectPreset) ?? EFFECT_OPTIONS[0],
    [effectPreset],
  );

  const stopPeerConnection = useCallback(() => {
    const connection = peerConnectionRef.current;
    if (connection) {
      connection.onicecandidate = null;
      connection.ontrack = null;
      connection.close();
    }

    peerConnectionRef.current = null;
    pendingCandidatesRef.current = [];
    currentSessionIdRef.current = null;
    currentPeerIdRef.current = null;

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    remoteStreamRef.current = null;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setPeerConnected(false);
    setSessionId(null);
    setPeerName(null);
    setMessages([]);
  }, []);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    localStreamRef.current = null;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, []);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
      audio: true,
    });

    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    setCameraEnabled(true);
    setMicrophoneEnabled(true);
    return stream;
  }, []);

  const createPeerConnection = useCallback(
    async (nextSessionId: string, nextPeerId: string) => {
      const stream = await ensureLocalStream();
      const connection = new RTCPeerConnection(ICE_SERVERS);

      peerConnectionRef.current = connection;
      currentSessionIdRef.current = nextSessionId;
      currentPeerIdRef.current = nextPeerId;

      remoteStreamRef.current = new MediaStream();
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }

      stream.getTracks().forEach((track) => connection.addTrack(track, stream));

      connection.ontrack = (event) => {
        const [incomingStream] = event.streams;
        if (incomingStream) {
          remoteStreamRef.current = incomingStream;
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = incomingStream;
          }
        }

        setPeerConnected(true);
        setStatus('Connexion video active.');
      };

      connection.onicecandidate = (event) => {
        if (!event.candidate || !socket || !currentSessionIdRef.current || !currentPeerIdRef.current) {
          return;
        }

        socket.emit('auravision:signal', {
          sessionId: currentSessionIdRef.current,
          targetUserId: currentPeerIdRef.current,
          signal: {
            type: 'ice-candidate',
            candidate: event.candidate.toJSON(),
          },
        });
      };

      return connection;
    },
    [ensureLocalStream, socket],
  );

  const applySignal = useCallback(
    async (nextSessionId: string, fromUserId: string, signal: AuraVisionSignal) => {
      let connection = peerConnectionRef.current;
      if (!connection) {
        connection = await createPeerConnection(nextSessionId, fromUserId);
      }

      if (signal.type === 'offer') {
        await connection.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        for (const candidate of pendingCandidatesRef.current) {
          await connection.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidatesRef.current = [];

        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        if (socket && currentSessionIdRef.current && currentPeerIdRef.current) {
          socket.emit('auravision:signal', {
            sessionId: currentSessionIdRef.current,
            targetUserId: currentPeerIdRef.current,
            signal: {
              type: 'answer',
              sdp: answer,
            },
          });
        }
        return;
      }

      if (signal.type === 'answer') {
        await connection.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        for (const candidate of pendingCandidatesRef.current) {
          await connection.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidatesRef.current = [];
        return;
      }

      if (connection.remoteDescription) {
        await connection.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } else {
        pendingCandidatesRef.current.push(signal.candidate);
      }
    },
    [createPeerConnection, socket],
  );

  const leaveEverything = useCallback(
    (keepLocalMedia: boolean) => {
      if (socket) {
        socket.emit('auravision:leave-queue');
        socket.emit('auravision:leave-session');
      }

      setIsQueueing(false);
      setStatus('AuraVision en pause.');
      setError(null);
      stopPeerConnection();

      if (!keepLocalMedia) {
        stopLocalStream();
      }
    },
    [socket, stopLocalStream, stopPeerConnection],
  );

  const handleJoinQueue = useCallback(async () => {
    if (!socket) {
      setError('La connexion temps reel n est pas encore prete.');
      return;
    }

    setIsPreparing(true);
    setError(null);

    try {
      await ensureLocalStream();
      stopPeerConnection();
      setStatus('Recherche d un joueur AuraTracker...');
      setIsQueueing(true);
      socket.emit('auravision:join-queue');
    } catch (mediaError) {
      console.error('AuraVision media error:', mediaError);
      setError('Impossible d acceder a la camera ou au micro.');
      setStatus('Permissions camera/micro requises.');
    } finally {
      setIsPreparing(false);
    }
  }, [ensureLocalStream, socket, stopPeerConnection]);

  const handleNext = useCallback(async () => {
    if (!socket) {
      return;
    }

    setIsPreparing(true);
    setError(null);

    try {
      await ensureLocalStream();
      stopPeerConnection();
      setStatus('Passage au joueur suivant...');
      setIsQueueing(true);
      socket.emit('auravision:next');
    } catch (mediaError) {
      console.error('AuraVision next error:', mediaError);
      setError('Impossible de relancer la camera pour le joueur suivant.');
    } finally {
      setIsPreparing(false);
    }
  }, [ensureLocalStream, socket, stopPeerConnection]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleQueued = (payload: { position: number }) => {
      setIsQueueing(true);
      setStatus(
        payload.position > 1
          ? `En file d attente. ${payload.position} joueurs devant toi.`
          : 'En file d attente. Premiere connexion disponible.',
      );
    };

    const handleMatched = async (payload: { sessionId: string; initiator: boolean; peer: { id: string; username: string } }) => {
      setIsQueueing(false);
      setError(null);
      setSessionId(payload.sessionId);
      setPeerName(payload.peer.username);
      setPeerConnected(false);
      setMessages([]);
      setStatus(`Connexion avec ${payload.peer.username}...`);

      try {
        const connection = await createPeerConnection(payload.sessionId, payload.peer.id);
        if (payload.initiator) {
          const offer = await connection.createOffer();
          await connection.setLocalDescription(offer);
          socket.emit('auravision:signal', {
            sessionId: payload.sessionId,
            targetUserId: payload.peer.id,
            signal: {
              type: 'offer',
              sdp: offer,
            },
          });
        }
      } catch (matchError) {
        console.error('AuraVision match error:', matchError);
        setError('La connexion video a echoue. Nouvelle tentative en cours.');
        socket.emit('auravision:next');
      }
    };

    const handleSignal = (payload: { sessionId: string; fromUserId: string; signal: AuraVisionSignal }) => {
      void applySignal(payload.sessionId, payload.fromUserId, payload.signal);
    };

    const handlePartnerLeft = (payload: { reason: 'left' | 'next' | 'disconnect' }) => {
      stopPeerConnection();
      setStatus(payload.reason === 'next' ? 'Ton contact est passe au suivant.' : 'Ton contact a quitte AuraVision.');

      if (autoNextRef.current) {
        void handleJoinQueue();
      }
    };

    const handleQueueSize = (payload: { count: number }) => {
      setQueueCount(payload.count);
    };

    const handleActiveCount = (payload: { count: number }) => {
      setActiveCount(payload.count);
    };

    const handleMessage = (payload: AuraVisionMessage) => {
      setMessages((current) => [...current.slice(-49), payload]);
    };

    const handleSocketError = (payload: { message: string }) => {
      setError(payload.message);
    };

    socket.on('auravision:queued', handleQueued);
    socket.on('auravision:matched', handleMatched);
    socket.on('auravision:signal', handleSignal);
    socket.on('auravision:partner-left', handlePartnerLeft);
    socket.on('auravision:queue-size', handleQueueSize);
    socket.on('auravision:active-count', handleActiveCount);
    socket.on('auravision:message', handleMessage);
    socket.on('auravision:error', handleSocketError);
    socket.emit('auravision:queue-size');
    socket.emit('auravision:active-count');

    return () => {
      socket.off('auravision:queued', handleQueued);
      socket.off('auravision:matched', handleMatched);
      socket.off('auravision:signal', handleSignal);
      socket.off('auravision:partner-left', handlePartnerLeft);
      socket.off('auravision:queue-size', handleQueueSize);
      socket.off('auravision:active-count', handleActiveCount);
      socket.off('auravision:message', handleMessage);
      socket.off('auravision:error', handleSocketError);
    };
  }, [applySignal, createPeerConnection, handleJoinQueue, socket, stopPeerConnection]);

  useEffect(() => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = cameraEnabled;
    }
  }, [cameraEnabled]);

  useEffect(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = microphoneEnabled;
    }
  }, [microphoneEnabled]);

  useEffect(() => {
    return () => {
      leaveEverything(false);
    };
  }, [leaveEverything]);

  useEffect(() => {
    try {
      const accepted = window.localStorage.getItem(rulesStorageKey) === '1';
      setRulesAccepted(accepted);
      setRulesModalOpen(!accepted);
    } catch {
      setRulesAccepted(false);
      setRulesModalOpen(true);
    }
  }, [rulesStorageKey]);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const handleSendMessage = useCallback(() => {
    if (!socket || !sessionId || !chatDraft.trim()) {
      return;
    }

    socket.emit('auravision:message', {
      sessionId,
      body: chatDraft.trim(),
    });
    setChatDraft('');
  }, [chatDraft, sessionId, socket]);

  const handleReport = useCallback(async () => {
    if (!currentPeerIdRef.current || !peerName) {
      return;
    }

    const trimmedReason = reportReason.trim();
    if (!trimmedReason) {
      toast({
        title: 'Motif requis',
        description: 'Ajoute une raison avant d envoyer le signalement.',
        variant: 'destructive',
      });
      return;
    }

    setReportSubmitting(true);

    try {
      await auraVisionApi.report({
        peerUserId: currentPeerIdRef.current,
        sessionId,
        reason: trimmedReason,
        transcript: messages.slice(-8).map((message) => ({
          sender: message.sender,
          body: message.body,
        })),
      });

      toast({
        title: 'Signalement envoye',
        description: `${peerName} a ete signale a l equipe de moderation.`,
      });

      setReportOpen(false);
      setReportReason('');
    } catch (reportError) {
      console.error('AuraVision report error:', reportError);
      toast({
        title: 'Erreur de signalement',
        description: 'Le signalement n a pas pu etre envoye.',
        variant: 'destructive',
      });
    } finally {
      setReportSubmitting(false);
    }
  }, [messages, peerName, reportReason, sessionId]);

  const handleAcceptRules = useCallback(() => {
    try {
      window.localStorage.setItem(rulesStorageKey, '1');
    } catch {
      // Ignore storage failures; we still allow current session usage.
    }
    setRulesAccepted(true);
    setRulesModalOpen(false);
  }, [rulesStorageKey]);

  const handlePrimaryNext = useCallback(() => {
    if (sessionId || isQueueing) {
      void handleNext();
      return;
    }
    void handleJoinQueue();
  }, [handleJoinQueue, handleNext, isQueueing, sessionId]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="AuraVision"
        description="Une roulette video entre joueurs AuraTracker: rencontres aleatoires, filtres live, ambiance webcam et passage instantane au suivant."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-600">
              {connected ? 'Socket connecte' : 'Connexion en cours'}
            </div>
            <div className="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              {queueCount} joueur{queueCount > 1 ? 's' : ''} en file
            </div>
          </div>
        }
      />

      <div className="space-y-3">
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(320px,0.95fr)]">
          <VideoPanel
            title={user?.username ? `${user.username} (toi)` : 'Toi'}
            subtitle={cameraEnabled ? 'Camera active' : 'Camera coupee'}
            icon={Camera}
            videoRef={localVideoRef}
            filterStyle={filterStyle}
            mirrored={mirrorLocal}
            effectPreset={effectPreset}
            placeholder="Retour local"
            muted
          />
          <VideoPanel
            title={peerName ?? 'Aucun joueur'}
            subtitle={peerConnected ? 'Connecte' : isQueueing ? 'Recherche...' : 'Hors session'}
            icon={MonitorPlay}
            videoRef={remoteVideoRef}
            filterStyle={filterStyle}
            mirrored={false}
            effectPreset={effectPreset}
            placeholder={isQueueing ? 'Connexion en cours...' : 'Clique sur Next pour lancer une session'}
          />

          <Card className="min-h-0 border-border/60 bg-background/70">
            <CardContent className="flex h-full min-h-0 flex-col p-0">
              <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">Chat de session</p>
                  <p className="truncate text-[11px] text-muted-foreground">{peerName ? `Avec ${peerName}` : 'En attente de connexion'}</p>
                </div>
                {sessionId ? <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] text-primary">Session {sessionId.slice(0, 6)}</span> : null}
              </div>

              <div ref={messagesRef} className="min-h-0 flex-1 overflow-y-auto bg-muted/15 px-3 py-3">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
                    Les messages apparaitront ici.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {messages.map((message) => {
                      const isOwn = message.senderId === user?.id;
                      return (
                        <div key={message.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                          <div
                            className={cn(
                              'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-5',
                              isOwn
                                ? 'rounded-br-sm bg-primary text-primary-foreground'
                                : 'rounded-bl-sm border border-border/60 bg-card text-foreground',
                            )}
                          >
                            {!isOwn ? <p className="mb-0.5 text-[11px] font-semibold text-muted-foreground">{message.sender}</p> : null}
                            <p className="whitespace-pre-wrap break-words">{message.body}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-border/60 bg-card px-3 py-2.5">
                <div className="flex items-end gap-2">
                  <div className="flex-1 rounded-2xl border border-border/50 bg-muted/20 px-3 py-2 focus-within:border-primary/40 focus-within:bg-background transition-colors">
                    <textarea
                      value={chatDraft}
                      rows={1}
                      onChange={(event) => setChatDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Envoyer un message..."
                      className="w-full resize-none bg-transparent text-sm leading-5 outline-none placeholder:text-muted-foreground/50"
                      maxLength={280}
                      style={{ minHeight: '20px' }}
                      disabled={!sessionId}
                    />
                  </div>
                  <Button onClick={handleSendMessage} size="icon" className="h-9 w-9 rounded-xl" disabled={!sessionId || !chatDraft.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          {effectsOpen ? (
            <div className="absolute bottom-[calc(100%+0.6rem)] right-0 z-20 w-[min(92vw,420px)] rounded-2xl border border-border/70 bg-background/95 p-3 shadow-xl backdrop-blur">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Effets video</p>
                <span className="text-[11px] text-muted-foreground">{effectMeta.label} · {intensity}%</span>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">Filtre</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFilterPreset(option.value)}
                      className={cn(
                        'rounded-xl border px-2 py-1.5 text-xs transition-colors',
                        filterPreset === option.value
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-muted-foreground">Effet</p>
                <div className="grid grid-cols-2 gap-2">
                  {EFFECT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setEffectPreset(option.value)}
                      className={cn(
                        'rounded-xl border px-2 py-2 text-left transition-colors',
                        effectPreset === option.value
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <p className="text-xs font-medium">{option.label}</p>
                      <p className="mt-1 text-[10px] leading-4">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Intensite</span>
                  <span>{intensity}%</span>
                </div>
                <Slider value={[intensity]} min={0} max={100} step={1} onValueChange={(value) => setIntensity(value[0] ?? 0)} />
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/85 p-2 backdrop-blur">
            <div className="flex items-center gap-2">
              <Button onClick={handlePrimaryNext} disabled={isPreparing || !connected || !rulesAccepted} className="gap-2 rounded-xl">
                <RefreshCw className={cn('h-4 w-4', isPreparing && 'animate-spin')} />
                <span>{sessionId || isQueueing ? 'Next' : 'Demarrer'}</span>
              </Button>
              <Button onClick={() => setMicrophoneEnabled((value) => !value)} variant="outline" className="gap-2 rounded-xl">
                {microphoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                <span className="hidden sm:inline">Micro</span>
              </Button>
              <Button onClick={() => setCameraEnabled((value) => !value)} variant="outline" className="gap-2 rounded-xl">
                {cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                <span className="hidden sm:inline">Camera</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={() => setEffectsOpen((open) => !open)} variant="outline" className="gap-2 rounded-xl">
                <Waves className="h-4 w-4" />
                <span className="hidden sm:inline">Effets</span>
              </Button>
              <Button onClick={() => setReportOpen(true)} variant="outline" className="gap-2 rounded-xl" disabled={!peerName}>
                <Flag className="h-4 w-4" />
                <span className="hidden sm:inline">Signaler</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signaler sur AuraVision</DialogTitle>
            <DialogDescription>
              Ce signalement sera transmis a l equipe de moderation avec le contexte recent de la session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
              Joueur concerne: <span className="font-medium text-foreground">{peerName ?? 'Aucun'}</span>
            </div>
            <Textarea
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              placeholder="Explique brievement le probleme rencontre..."
              maxLength={280}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void handleReport()} disabled={reportSubmitting || !peerName}>
              Envoyer le signalement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rulesModalOpen} onOpenChange={(open) => (rulesAccepted ? setRulesModalOpen(open) : undefined)}>
        <DialogContent className="[&>button]:hidden">
          <DialogHeader>
            <DialogTitle>Regles AuraVision</DialogTitle>
            <DialogDescription>
              Avant de commencer, tu dois accepter les regles de securite et de respect.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
            <p>Pas de contenu sexuel, violent, humiliant ou discriminant.</p>
            <p>Pas de harcelement, menace, spam vocal ou tentative de doxxing.</p>
            <p>Si un comportement pose probleme, passe au suivant puis utilise Signaler.</p>
          </div>
          <DialogFooter>
            <Button onClick={handleAcceptRules} className="w-full">
              J accepte les regles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function VideoPanel({
  title,
  subtitle,
  icon: Icon,
  videoRef,
  filterStyle,
  mirrored,
  effectPreset,
  placeholder,
  muted = false,
}: {
  title: string;
  subtitle: string;
  icon: typeof Camera;
  videoRef: RefObject<HTMLVideoElement>;
  filterStyle: string;
  mirrored: boolean;
  effectPreset: EffectPreset;
  placeholder: string;
  muted?: boolean;
}) {
  return (
    <Card className="min-h-0 overflow-hidden border-border/60 bg-card/75">
      <CardContent className="h-full p-0">
        <div
          className={cn(
            'relative h-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_42%),radial-gradient(circle_at_bottom,rgba(217,70,239,0.16),transparent_38%),linear-gradient(160deg,rgba(15,23,42,0.96),rgba(10,10,18,0.98))]',
            effectPreset === 'halo' && 'auravision-halo',
            effectPreset === 'scanlines' && 'auravision-scanlines',
            effectPreset === 'pulse' && 'auravision-pulse',
            effectPreset === 'prism' && 'auravision-prism',
          )}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            className={cn('h-full w-full object-cover', mirrored && 'scale-x-[-1]')}
            style={{ filter: filterStyle }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_48%,rgba(7,10,18,0.24)_100%)]" />
          <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-white backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-cyan-300" />
                <p className="text-sm font-medium">{title}</p>
              </div>
              <p className="mt-1 text-xs text-white/70">{subtitle}</p>
            </div>
          </div>
          <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-white/70 backdrop-blur-md">
            {placeholder}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
