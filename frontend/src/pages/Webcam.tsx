import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { getSocket } from '../services/socket';
import { Video, VideoOff, Camera, CameraOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';

interface WebcamUser {
  userId: string;
  username: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
  socketId: string;
}

interface RemoteVideo {
  userId: string;
  username: string;
  stream: MediaStream | null;
}

// Composant pour une vidéo distante
function RemoteVideoPlayer({ userId, username, stream }: RemoteVideo) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!stream) {
      setHasVideo(false);
      setIsLoading(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    console.log(`[RemoteVideo] Setting up video for ${userId}`, {
      streamId: stream.id,
      tracks: stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState }))
    });

    // Vérifier si le stream a des tracks vidéo actifs
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      console.warn(`[RemoteVideo] No video tracks for ${userId}`);
      setHasVideo(false);
      setIsLoading(false);
      return;
    }

    // Attacher le stream
    video.srcObject = stream;
    
    // Écouter les événements de la vidéo
    const handleLoadedMetadata = () => {
      console.log(`[RemoteVideo] Video metadata loaded for ${userId}`, {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState
      });
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      console.log(`[RemoteVideo] Video can play for ${userId}`);
      setHasVideo(true);
      setIsLoading(false);
      // Forcer la lecture
      video.play().catch(err => {
        console.warn(`[RemoteVideo] Auto-play prevented for ${userId}, will retry:`, err);
      });
    };

    const handlePlay = () => {
      console.log(`[RemoteVideo] Video playing for ${userId}`);
      setHasVideo(true);
      setIsLoading(false);
    };

    const handlePlaying = () => {
      console.log(`[RemoteVideo] Video is playing for ${userId}`);
      setHasVideo(true);
      setIsLoading(false);
    };

    const handleError = (e: Event) => {
      console.error(`[RemoteVideo] Video error for ${userId}:`, e);
      setHasVideo(false);
      setIsLoading(false);
    };

    // Écouter les changements de tracks
    const handleTrackEnded = () => {
      console.log(`[RemoteVideo] Track ended for ${userId} (normal if user deactivates camera)`);
      setHasVideo(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('play', handlePlay);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleError);
    
    // Écouter la fin des tracks
    videoTracks.forEach(track => {
      track.addEventListener('ended', handleTrackEnded);
      // Écouter aussi les changements d'état des tracks
      track.addEventListener('mute', () => {
        console.log(`[RemoteVideo] Track muted for ${userId}`);
      });
      track.addEventListener('unmute', () => {
        console.log(`[RemoteVideo] Track unmuted for ${userId}`);
        setHasVideo(true);
      });
    });

    // Essayer de jouer la vidéo immédiatement
    const playVideo = async () => {
      try {
        await video.play();
        console.log(`[RemoteVideo] Video play() succeeded for ${userId}`);
        setHasVideo(true);
      } catch (err) {
        console.warn(`[RemoteVideo] Error playing video for ${userId}, will retry on canplay:`, err);
        // Ne pas définir hasVideo à false ici, laisser canplay le gérer
      }
    };
    
    playVideo();

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleError);
      videoTracks.forEach(track => {
        track.removeEventListener('ended', handleTrackEnded);
        track.removeEventListener('mute', () => {});
        track.removeEventListener('unmute', () => {});
      });
      if (video) {
        video.srcObject = null;
      }
    };
  }, [stream, userId]);

  return (
    <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
      {stream ? (
        <>
          {/* Toujours afficher la vidéo si un stream existe */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ 
              opacity: hasVideo ? 1 : 0.7,
              transition: 'opacity 0.3s',
              position: 'relative',
              zIndex: 1,
              backgroundColor: '#000'
            }}
          />
          {/* Afficher l'avatar en overlay seulement si la vidéo n'est pas encore visible */}
          {!hasVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-10 pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-semibold">
                {username[0]?.toUpperCase() || '?'}
              </div>
              {isLoading && (
                <div className="absolute bottom-4 text-xs text-muted-foreground">
                  Chargement...
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-semibold">
            {username[0]?.toUpperCase() || '?'}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black/50 text-white px-3 py-1 rounded text-sm font-medium z-20">
        {username}
      </div>
    </div>
  );
}

export default function Webcam() {
  const { user } = useAuth();
  const { socket: contextSocket, connected } = useSocket();
  // Utiliser le socket du contexte en priorité, sinon celui de getSocket()
  const socket = contextSocket || getSocket();
  
  // Log pour déboguer
  useEffect(() => {
    if (socket) {
      console.log('Webcam page: Socket available', { 
        socketId: socket.id, 
        connected: socket.connected || connected,
        isContextSocket: !!contextSocket 
      });
    }
  }, [socket, connected, contextSocket]);
  
  // Récupérer l'état sauvegardé de la caméra
  const [isCameraActive, setIsCameraActive] = useState(() => {
    const saved = localStorage.getItem('webcam:active');
    return saved === 'true';
  });
  const [activeUsers, setActiveUsers] = useState<WebcamUser[]>([]);
  const [remoteVideos, setRemoteVideos] = useState<Map<string, RemoteVideo>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [activeCount, setActiveCount] = useState<number>(0);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const isRestoringRef = useRef(false);

  // Configuration WebRTC
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Activer/désactiver la caméra
  const toggleCamera = async () => {
    if (isCameraActive) {
      // Désactiver la caméra
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      
      // Fermer toutes les connexions peer
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
      
      // Nettoyer les vidéos distantes
      remoteVideos.forEach(({ stream }) => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      });
      setRemoteVideos(new Map());
      
      // Notifier le serveur
      if (socket && user) {
        socket.emit('webcam:leave', { userId: user.id });
      }
      
      setIsCameraActive(false);
      setActiveUsers([]);
      // Sauvegarder l'état
      localStorage.removeItem('webcam:active');
    } else {
      // Activer la caméra
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(err => {
            console.error('Error playing local video:', err);
          });
        }
        
        setIsCameraActive(true);
        setError(null);
        
        // Sauvegarder l'état
        localStorage.setItem('webcam:active', 'true');
        
        // Rejoindre la room webcam
        if (socket && user) {
          console.log('Joining webcam room:', user.id, 'Socket connected:', socket.connected);
          if (socket.connected) {
            socket.emit('webcam:join', {
              userId: user.id,
              username: user.username,
              usernameColor: user.usernameColor,
              profilePicture: user.profilePicture,
              currentPage: '/webcam',
            });
          } else {
            console.warn('Socket not connected, waiting...');
            socket.once('connect', () => {
              console.log('Socket connected, joining webcam room');
              socket.emit('webcam:join', {
                userId: user.id,
                username: user.username,
                usernameColor: user.usernameColor,
                profilePicture: user.profilePicture,
                currentPage: '/webcam',
              });
            });
          }
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setError('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
      }
    }
  };

  // Créer une connexion peer pour un utilisateur
  const createPeerConnection = (targetUserId: string, targetSocketId: string, username?: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(rtcConfig);
    
    // Ajouter le stream local
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }
    
    // Gérer les candidats ICE
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webcam:ice-candidate', {
          targetUserId,
          targetSocketId,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          },
        });
      }
    };
    
    // Gérer les erreurs de connexion
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${targetUserId}:`, pc.iceConnectionState, {
        connectionState: pc.connectionState,
        signalingState: pc.signalingState
      });
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.warn(`Connection failed for ${targetUserId}`);
      }
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log(`✅ ICE connection established for ${targetUserId}`);
      }
    };
    
    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${targetUserId}:`, pc.connectionState);
    };
    
    // Gérer les streams distants
    pc.ontrack = (event) => {
      console.log('🎥 Received track from', targetUserId, {
        track: event.track,
        stream: event.streams[0],
        trackKind: event.track.kind,
        trackId: event.track.id,
        trackEnabled: event.track.enabled,
        trackReadyState: event.track.readyState,
        streamsCount: event.streams.length
      });
      
      const [remoteStream] = event.streams;
      if (!remoteStream) {
        console.error(`❌ No stream in ontrack event for ${targetUserId}`);
        return;
      }
      
      const tracks = remoteStream.getTracks();
      console.log('📹 Remote stream info:', {
        streamId: remoteStream.id,
        active: remoteStream.active,
        tracks: tracks.map(t => ({
          kind: t.kind,
          id: t.id,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted
        }))
      });

      // Vérifier qu'il y a des tracks vidéo
      const videoTracks = remoteStream.getVideoTracks();
      if (videoTracks.length === 0) {
        console.warn(`⚠️ No video tracks in stream from ${targetUserId}`);
      } else {
        console.log(`✅ Found ${videoTracks.length} video track(s) from ${targetUserId}`, {
          tracks: videoTracks.map(t => ({
            id: t.id,
            enabled: t.enabled,
            readyState: t.readyState,
            muted: t.muted,
            settings: t.getSettings()
          }))
        });
      }
      
      // Vérifier si le stream est actif
      if (!remoteStream.active) {
        console.warn(`⚠️ Stream is not active for ${targetUserId}, waiting...`);
        // Attendre que le stream devienne actif
        const checkActive = setInterval(() => {
          if (remoteStream.active) {
            console.log(`✅ Stream became active for ${targetUserId}`);
            clearInterval(checkActive);
          }
        }, 100);
        setTimeout(() => clearInterval(checkActive), 5000);
      }
      
      // Mettre à jour l'état avec le stream
      setRemoteVideos(prev => {
        const newMap = new Map(prev);
        newMap.set(targetUserId, {
          userId: targetUserId,
          username: username || 'Unknown',
          stream: remoteStream,
        });
        console.log('📋 Updated remote videos map:', Array.from(newMap.keys()));
        return newMap;
      });
    };
    
    return pc;
  };

  // Établir une connexion avec un utilisateur
  const establishConnection = async (targetUserId: string, targetSocketId: string, username?: string) => {
    if (!localStreamRef.current) {
      console.warn('Cannot establish connection: no local stream');
      return;
    }
    
    console.log(`Creating peer connection to ${targetUserId} (socket: ${targetSocketId})`);
    const pc = createPeerConnection(targetUserId, targetSocketId, username);
    peerConnectionsRef.current.set(targetUserId, pc);
    
    try {
      // Créer une offre
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log(`Sending offer to ${targetUserId}`);
      if (socket) {
        // Convertir l'offre en objet JSON (pas de méthode toJSON)
        socket.emit('webcam:offer', {
          targetUserId,
          targetSocketId,
          offer: {
            type: offer.type,
            sdp: offer.sdp,
          },
        });
      }
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  // Gérer les événements Socket.io
  useEffect(() => {
    if (!socket || !user) {
      console.log('Socket or user not available:', { socket: !!socket, user: !!user });
      return;
    }
    
    console.log('Setting up webcam event listeners for user:', user.id, 'Socket connected:', socket.connected);

    // Utilisateur rejoint
    const handleUserJoined = (data: { user: WebcamUser; activeUsers: WebcamUser[] }) => {
      console.log('User joined webcam:', data);
      // Ne pas ajouter si c'est nous-même
      if (data.user.userId === user.id) return;
      
      setActiveUsers(prev => {
        // Éviter les doublons
        if (prev.find(u => u.userId === data.user.userId)) {
          return prev;
        }
        const updated = [...prev, data.user];
        console.log('Updated active users:', updated);
        return updated;
      });
      
      // Si notre caméra est active, établir une connexion
      if (isCameraActive && localStreamRef.current && !peerConnectionsRef.current.has(data.user.userId)) {
        console.log('Establishing connection with:', data.user.userId);
        establishConnection(data.user.userId, data.user.socketId, data.user.username);
      }
    };

    // Utilisateurs actifs
    const handleActiveUsers = (data: { users: WebcamUser[] }) => {
      console.log('Active users received:', data.users);
      // Filtrer nous-même
      const otherUsers = data.users.filter(u => u.userId !== user.id);
      console.log('Other users (excluding self):', otherUsers);
      setActiveUsers(otherUsers);
      
      // Établir des connexions avec tous les utilisateurs actifs
      if (isCameraActive && localStreamRef.current) {
        otherUsers.forEach(u => {
          if (!peerConnectionsRef.current.has(u.userId)) {
            console.log('Establishing connection with active user:', u.userId);
            establishConnection(u.userId, u.socketId, u.username);
          }
        });
      }
    };

    // Utilisateur quitte
    const handleUserLeft = (data: { userId: string }) => {
      setActiveUsers(prev => prev.filter(u => u.userId !== data.userId));
      
      // Nettoyer la connexion peer
      const pc = peerConnectionsRef.current.get(data.userId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(data.userId);
      }
      
      // Nettoyer la vidéo
      setRemoteVideos(prev => {
        const remote = prev.get(data.userId);
        if (remote?.stream) {
          remote.stream.getTracks().forEach(track => track.stop());
        }
        const newMap = new Map(prev);
        newMap.delete(data.userId);
        return newMap;
      });
    };

    // Recevoir une offre
    const handleOffer = async (data: {
      fromUserId: string;
      fromSocketId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      console.log(`📨 Received offer from ${data.fromUserId}`, {
        fromSocketId: data.fromSocketId,
        offerType: data.offer.type
      });

      if (!localStreamRef.current) {
        console.warn(`⚠️ Cannot handle offer: no local stream`);
        return;
      }
      
      let pc = peerConnectionsRef.current.get(data.fromUserId);
      if (!pc) {
        console.log(`🔗 Creating new peer connection for incoming offer from ${data.fromUserId}`);
        // Trouver le nom d'utilisateur dans la liste active
        const webcamUser = activeUsers.find(u => u.userId === data.fromUserId);
        pc = createPeerConnection(data.fromUserId, data.fromSocketId, webcamUser?.username);
        peerConnectionsRef.current.set(data.fromUserId, pc);
      }
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log(`✅ Set remote description for ${data.fromUserId}`);
        
        // Ajouter les candidats ICE en attente maintenant que la description est définie
        const pendingCandidates = pendingIceCandidatesRef.current.get(data.fromUserId);
        if (pendingCandidates && pendingCandidates.length > 0) {
          console.log(`📦 Adding ${pendingCandidates.length} pending ICE candidates for ${data.fromUserId}`);
          for (const candidate of pendingCandidates) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error(`Error adding pending ICE candidate:`, err);
            }
          }
          pendingIceCandidatesRef.current.delete(data.fromUserId);
        }
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log(`✅ Created and set local answer for ${data.fromUserId}`);
        
        if (socket) {
          socket.emit('webcam:answer', {
            targetUserId: data.fromUserId,
            targetSocketId: data.fromSocketId,
            answer: {
              type: answer.type,
              sdp: answer.sdp,
            },
          });
          console.log(`📤 Sent answer to ${data.fromUserId}`);
        }
      } catch (error) {
        console.error(`❌ Error handling offer from ${data.fromUserId}:`, error);
      }
    };

    // Recevoir une réponse
    const handleAnswer = async (data: {
      fromUserId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      console.log(`📨 Received answer from ${data.fromUserId}`);
      const pc = peerConnectionsRef.current.get(data.fromUserId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log(`✅ Set remote answer for ${data.fromUserId}`);
          
          // Ajouter les candidats ICE en attente maintenant que la description est définie
          const pendingCandidates = pendingIceCandidatesRef.current.get(data.fromUserId);
          if (pendingCandidates && pendingCandidates.length > 0) {
            console.log(`📦 Adding ${pendingCandidates.length} pending ICE candidates for ${data.fromUserId}`);
            for (const candidate of pendingCandidates) {
              try {
                // Vérifier que la connexion n'est pas fermée
                if (pc.signalingState === 'closed' || pc.connectionState === 'closed') {
                  console.log(`ℹ️ Connection closed, skipping pending ICE candidate for ${data.fromUserId}`);
                  break;
                }
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (err) {
                console.error(`Error adding pending ICE candidate:`, err);
              }
            }
            pendingIceCandidatesRef.current.delete(data.fromUserId);
          }
        } catch (error) {
          console.error(`❌ Error setting remote answer for ${data.fromUserId}:`, error);
        }
      } else {
        console.warn(`⚠️ No peer connection found for answer from ${data.fromUserId}`);
      }
    };

    // Recevoir un candidat ICE
    const handleIceCandidate = async (data: {
      fromUserId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const pc = peerConnectionsRef.current.get(data.fromUserId);
      if (!pc) {
        console.warn(`⚠️ No peer connection found for ICE candidate from ${data.fromUserId}`);
        return;
      }

      // Vérifier que la connexion n'est pas fermée
      if (pc.signalingState === 'closed' || pc.connectionState === 'closed') {
        console.log(`ℹ️ Peer connection is closed for ${data.fromUserId}, ignoring ICE candidate (normal during cleanup)`);
        return;
      }

      if (!data.candidate.candidate) {
        console.log(`ℹ️ Empty ICE candidate from ${data.fromUserId} (end of candidates)`);
        return;
      }

      try {
        // Vérifier que la description distante est définie avant d'ajouter le candidat ICE
        if (!pc.remoteDescription) {
          console.log(`⏳ Storing ICE candidate for later (remote description not set yet) for ${data.fromUserId}`);
          // Stocker le candidat pour plus tard
          const pending = pendingIceCandidatesRef.current.get(data.fromUserId) || [];
          pending.push(data.candidate);
          pendingIceCandidatesRef.current.set(data.fromUserId, pending);
          return;
        }
        
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log(`✅ Added ICE candidate for ${data.fromUserId}`);
      } catch (error) {
        // Ignorer l'erreur si la connexion est fermée
        if (pc.signalingState === 'closed' || pc.connectionState === 'closed') {
          console.log(`ℹ️ Ignoring ICE candidate: connection closed for ${data.fromUserId}`);
        } else {
          console.error(`❌ Error adding ICE candidate for ${data.fromUserId}:`, error);
        }
      }
    };

    socket.on('webcam:user-joined', handleUserJoined);
    socket.on('webcam:active-users', handleActiveUsers);
    socket.on('webcam:user-left', handleUserLeft);
    socket.on('webcam:offer', handleOffer);
    socket.on('webcam:answer', handleAnswer);
    socket.on('webcam:ice-candidate', handleIceCandidate);

    return () => {
      socket.off('webcam:user-joined', handleUserJoined);
      socket.off('webcam:active-users', handleActiveUsers);
      socket.off('webcam:user-left', handleUserLeft);
      socket.off('webcam:offer', handleOffer);
      socket.off('webcam:answer', handleAnswer);
      socket.off('webcam:ice-candidate', handleIceCandidate);
    };
  }, [socket, user, isCameraActive, activeUsers]);

  // Gérer le compteur de webcams actives (indépendamment de l'activation de la caméra)
  useEffect(() => {
    if (!socket || !user) {
      console.log('Webcam count: No socket or user', { socket: !!socket, user: !!user, socketId: socket?.id });
      return;
    }

    console.log('Setting up webcam count listeners', { 
      socketId: socket.id, 
      socketConnected: socket.connected, 
      contextConnected: connected 
    });

    const handleActiveCount = (data: { count: number }) => {
      console.log('✅ Active webcam count received:', data.count);
      setActiveCount(data.count);
    };

    const requestCount = () => {
      if (socket && (socket.connected || connected)) {
        console.log('📤 Requesting webcam count');
        socket.emit('webcam:get-count');
      } else {
        console.log('❌ Cannot request count: socket not connected', { 
          socketConnected: socket?.connected, 
          contextConnected: connected 
        });
      }
    };

    // Écouter les événements AVANT de demander
    socket.on('webcam:active-count', handleActiveCount);
    socket.on('webcam:count', handleActiveCount);

    // Écouter la connexion
    const onConnect = () => {
      console.log('🔌 Socket connected, requesting webcam count');
      requestCount();
    };
    socket.on('connect', onConnect);

    // Demander immédiatement si connecté
    if (connected || socket.connected) {
      console.log('📡 Socket already connected, requesting count immediately');
      requestCount();
    } else {
      console.log('⏳ Socket not connected yet, will request when connected');
    }

    return () => {
      console.log('🧹 Cleaning up webcam count listeners');
      socket.off('connect', onConnect);
      socket.off('webcam:active-count', handleActiveCount);
      socket.off('webcam:count', handleActiveCount);
    };
  }, [socket, user, connected]);

  // Restaurer la caméra au chargement si elle était active
  useEffect(() => {
    if (isCameraActive && !localStreamRef.current && !isRestoringRef.current && socket && user) {
      isRestoringRef.current = true;
      console.log('🔄 Restoring camera after page reload');
      
      const restoreCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
          
          localStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(err => {
              console.error('Error playing local video:', err);
            });
          }
          
          setError(null);
          
          // Rejoindre la room webcam
          if (socket.connected) {
            socket.emit('webcam:join', {
              userId: user.id,
              username: user.username,
              usernameColor: user.usernameColor,
              profilePicture: user.profilePicture,
              currentPage: '/webcam',
            });
          } else {
            socket.once('connect', () => {
              socket.emit('webcam:join', {
                userId: user.id,
                username: user.username,
                usernameColor: user.usernameColor,
                profilePicture: user.profilePicture,
                currentPage: '/webcam',
              });
            });
          }
        } catch (err) {
          console.error('Error restoring camera:', err);
          setError('Impossible de restaurer la caméra. Vérifiez les permissions.');
          setIsCameraActive(false);
          localStorage.removeItem('webcam:active');
        } finally {
          isRestoringRef.current = false;
        }
      };
      
      restoreCamera();
    }
  }, [isCameraActive, socket, user]);

  // S'assurer que la vidéo locale se charge
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(err => {
        console.error('Error playing local video:', err);
      });
    }
  }, [isCameraActive]);

  // Nettoyer à la déconnexion
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      peerConnectionsRef.current.forEach(pc => pc.close());
      remoteVideos.forEach(({ stream }) => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      });
      if (socket && user) {
        socket.emit('webcam:leave', { userId: user.id });
      }
    };
  }, [socket, user, remoteVideos]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Webcam</h1>
          <p className="text-muted-foreground mt-1">
            Activez votre caméra pour voir et être vu par les autres utilisateurs
          </p>
        </div>
        <Button
          onClick={toggleCamera}
          variant={isCameraActive ? 'destructive' : 'default'}
          size="lg"
          className="gap-2"
        >
          {isCameraActive ? (
            <>
              <CameraOff className="h-5 w-5" />
              Désactiver la caméra
            </>
          ) : (
            <>
              <Camera className="h-5 w-5" />
              Activer la caméra
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20">
          {error}
        </div>
      )}

      {!isCameraActive && (
        <div className="bg-muted/50 border border-border rounded-lg p-12 text-center">
          <VideoOff className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">Caméra désactivée</p>
          <p className="text-muted-foreground mb-4">
            Activez votre caméra pour voir les autres utilisateurs et leur permettre de vous voir.
          </p>
          <div className="mt-6 p-4 bg-background/50 rounded-lg border border-border/50">
            <p className="text-sm text-muted-foreground mb-2">Webcams actives actuellement</p>
            <p className="text-3xl font-bold text-primary">{activeCount}</p>
          </div>
        </div>
      )}

      {isCameraActive && (
        <div className="space-y-6">
          {/* Ma caméra */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Ma caméra</h2>
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden max-w-2xl">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black/50 text-white px-3 py-1 rounded text-sm font-medium">
                {user?.username}
              </div>
            </div>
          </div>

          {/* Caméras des autres utilisateurs */}
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Autres utilisateurs ({activeUsers.length})
            </h2>
            {activeUsers.length === 0 ? (
              <div className="bg-muted/50 border border-border rounded-lg p-12 text-center">
                <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Aucun autre utilisateur avec la caméra activée pour le moment.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeUsers.map((webcamUser) => {
                  const remoteVideo = remoteVideos.get(webcamUser.userId);
                  return (
                    <RemoteVideoPlayer
                      key={webcamUser.userId}
                      userId={webcamUser.userId}
                      username={webcamUser.username}
                      stream={remoteVideo?.stream || null}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
