import { useEffect, useRef, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Video, VideoOff, Users } from 'lucide-react';
import { resolveImageUrl } from '@/lib/images';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface WebcamUser {
  userId: string;
  username: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
  stream?: MediaStream;
}

export default function Webcam() {
  const { user } = useAuth();
  const { socket, connected, onlineUsers } = useSocket();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [webcamUsers, setWebcamUsers] = useState<Map<string, WebcamUser>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [activeWebcamCount, setActiveWebcamCount] = useState(0);

  // Initialize local video stream
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setIsCameraActive(true);
      
      // Notify server that we're broadcasting
      if (socket && user) {
        socket.emit('webcam:start', { userId: user.id });
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Impossible d\'accéder à la caméra. Vérifiez vos permissions.');
    }
  };

  const stopCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    setIsCameraActive(false);
    
    // Close all peer connections
    peerConnectionsRef.current.forEach((pc, _userId) => {
      pc.close();
    });
    peerConnectionsRef.current.clear();
    
    // Notify server that we stopped broadcasting
    if (socket && user) {
      socket.emit('webcam:stop', { userId: user.id });
    }
    
    // Clear remote videos
    remoteVideosRef.current.forEach((video) => {
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }
    });
    remoteVideosRef.current.clear();
    setWebcamUsers(new Map());
  };

  // WebRTC setup
  const createPeerConnection = (targetUserId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received track from', targetUserId, event);
      const [remoteStream] = event.streams;
      
      if (!remoteStream) {
        console.error('No remote stream in event');
        return;
      }
      
      // Store stream in state first
      setWebcamUsers(prev => {
        const updated = new Map(prev);
        const existing = updated.get(targetUserId);
        if (existing) {
          updated.set(targetUserId, { ...existing, stream: remoteStream });
        } else {
          // User might not be in the list yet, add them
          const targetUser = onlineUsers.find(u => u.userId === targetUserId);
          if (targetUser) {
            updated.set(targetUserId, {
              userId: targetUserId,
              username: targetUser.username,
              usernameColor: targetUser.usernameColor,
              profilePicture: targetUser.profilePicture,
              stream: remoteStream,
            });
          }
        }
        return updated;
      });
      
      // Update video element if it exists
      const updateVideo = () => {
        const video = remoteVideosRef.current.get(targetUserId);
        if (video) {
          if (video.srcObject !== remoteStream) {
            video.srcObject = remoteStream;
            video.play().catch(err => console.error('Error playing video:', err));
            console.log('Assigned stream to video element for', targetUserId);
          }
        }
      };
      
      // Try immediately
      updateVideo();
      
      // Also try after a short delay in case ref wasn't ready
      setTimeout(updateVideo, 100);
      setTimeout(updateVideo, 500);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webcam:ice-candidate', {
          fromUserId: user?.id,
          toUserId: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${targetUserId}:`, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        pc.close();
        peerConnectionsRef.current.delete(targetUserId);
      }
    };

    return pc;
  };

  // Socket event handlers
  useEffect(() => {
    if (!socket || !user || !connected) return;

    // When another user starts their webcam
    socket.on('webcam:user-started', async (data: { userId: string }) => {
      if (data.userId === user.id || !isCameraActive) return;

      const targetUser = onlineUsers.find(u => u.userId === data.userId);
      if (!targetUser) return;

      // Create peer connection
      const pc = createPeerConnection(data.userId);
      peerConnectionsRef.current.set(data.userId, pc);

      // Add user to webcam users
      setWebcamUsers(prev => {
        const updated = new Map(prev);
        updated.set(data.userId, {
          userId: data.userId,
          username: targetUser.username,
          usernameColor: targetUser.usernameColor,
          profilePicture: targetUser.profilePicture,
        });
        return updated;
      });

      // Create offer
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        socket.emit('webcam:offer', {
          fromUserId: user.id,
          toUserId: data.userId,
          offer: offer,
        });
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    });

    // When another user stops their webcam
    socket.on('webcam:user-stopped', (data: { userId: string }) => {
      const pc = peerConnectionsRef.current.get(data.userId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(data.userId);
      }

      const video = remoteVideosRef.current.get(data.userId);
      if (video && video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }

      setWebcamUsers(prev => {
        const updated = new Map(prev);
        updated.delete(data.userId);
        return updated;
      });
    });

    // Handle incoming offer
    socket.on('webcam:offer', async (data: { fromUserId: string; offer: RTCSessionDescriptionInit }) => {
      if (!isCameraActive || data.fromUserId === user.id) return;

      const pc = createPeerConnection(data.fromUserId);
      peerConnectionsRef.current.set(data.fromUserId, pc);

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webcam:answer', {
          fromUserId: user.id,
          toUserId: data.fromUserId,
          answer: answer,
        });

        // Add user to webcam users
        const targetUser = onlineUsers.find(u => u.userId === data.fromUserId);
        if (targetUser) {
          setWebcamUsers(prev => {
            const updated = new Map(prev);
            updated.set(data.fromUserId, {
              userId: data.fromUserId,
              username: targetUser.username,
              usernameColor: targetUser.usernameColor,
              profilePicture: targetUser.profilePicture,
            });
            return updated;
          });
        }
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    // Handle incoming answer
    socket.on('webcam:answer', async (data: { fromUserId: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnectionsRef.current.get(data.fromUserId);
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });

    // Handle ICE candidate
    socket.on('webcam:ice-candidate', async (data: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionsRef.current.get(data.fromUserId);
      if (!pc) return;

      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    });

    // Get list of active webcam users
    socket.on('webcam:active-users', (data: { userIds: string[] }) => {
      // Filter out current user from the list
      const otherUserIds = data.userIds.filter(id => id !== user.id);
      
      // Include current user if camera is active
      const count = isCameraActive && user ? otherUserIds.length + 1 : otherUserIds.length;
      setActiveWebcamCount(count);
      
      // If we have camera active, establish connections with new users
      if (isCameraActive) {
        otherUserIds.forEach(userId => {
          if (!peerConnectionsRef.current.has(userId)) {
            const targetUser = onlineUsers.find(u => u.userId === userId);
            if (targetUser) {
              const pc = createPeerConnection(userId);
              peerConnectionsRef.current.set(userId, pc);

              setWebcamUsers(prev => {
                const updated = new Map(prev);
                updated.set(userId, {
                  userId: userId,
                  username: targetUser.username,
                  usernameColor: targetUser.usernameColor,
                  profilePicture: targetUser.profilePicture,
                });
                return updated;
              });

              // Create offer
              pc.createOffer().then(offer => {
                pc.setLocalDescription(offer).then(() => {
                  socket.emit('webcam:offer', {
                    fromUserId: user.id,
                    toUserId: userId,
                    offer: offer,
                  });
                });
              }).catch(error => {
                console.error('Error creating offer for existing user:', error);
              });
            }
          }
        });
      }
    });

    return () => {
      socket.off('webcam:user-started');
      socket.off('webcam:user-stopped');
      socket.off('webcam:offer');
      socket.off('webcam:answer');
      socket.off('webcam:ice-candidate');
      socket.off('webcam:active-users');
    };
  }, [socket, user, connected, isCameraActive, onlineUsers]);

  // Request active users list when camera is activated or on mount
  useEffect(() => {
    if (socket && user && connected) {
      // Request active users list on mount and when camera is activated
      const timeout = setTimeout(() => {
        socket.emit('webcam:get-active-users');
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isCameraActive, socket, user, connected]);

  // Convert webcam users map to array (using useMemo for reactive updates)
  const webcamUsersArray = useMemo(() => Array.from(webcamUsers.values()), [webcamUsers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Update video elements when streams are available or when users are added
  useEffect(() => {
    webcamUsersArray.forEach((webcamUser) => {
      const video = remoteVideosRef.current.get(webcamUser.userId);
      if (video) {
        // If stream is available but not assigned, assign it
        if (webcamUser.stream && video.srcObject !== webcamUser.stream) {
          video.srcObject = webcamUser.stream;
          video.play().catch(err => console.error('Error playing video:', err));
        }
        // If no stream yet but video element exists, wait for it
        else if (!webcamUser.stream && !video.srcObject) {
          // Stream will be assigned in ontrack handler
        }
      }
    });
  }, [webcamUsersArray]);

  // Update active webcam count - use backend data as source of truth
  useEffect(() => {
    // Don't override if we just received active users list
    // The count will be updated by the webcam:active-users event
  }, [webcamUsers, isCameraActive, user]);

  // Request active users on initial mount
  useEffect(() => {
    if (socket && connected) {
      // Request immediately on mount
      socket.emit('webcam:get-active-users');
    }
  }, [socket, connected]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Webcam</h1>
          <p className="text-muted-foreground mt-2">
            Activez votre caméra pour voir les autres utilisateurs et être visible
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{activeWebcamCount} caméra{activeWebcamCount !== 1 ? 's' : ''} active{activeWebcamCount !== 1 ? 's' : ''}</span>
          </div>
          <Button
            onClick={isCameraActive ? stopCamera : startCamera}
            variant={isCameraActive ? 'destructive' : 'default'}
            size="lg"
          >
            {isCameraActive ? (
              <>
                <VideoOff className="h-4 w-4 mr-2" />
                Désactiver la caméra
              </>
            ) : (
              <>
                <Video className="h-4 w-4 mr-2" />
                Activer la caméra
              </>
            )}
          </Button>
        </div>
      </div>

      {!isCameraActive && (
        <Card className="p-12 text-center border-dashed">
          <VideoOff className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Caméra désactivée</h2>
          <p className="text-muted-foreground mb-6">
            Activez votre caméra pour voir les autres utilisateurs et être visible par eux.
          </p>
          <Button onClick={startCamera} size="lg">
            <Video className="h-4 w-4 mr-2" />
            Activer la caméra
          </Button>
        </Card>
      )}

      {isCameraActive && (
        <div className="space-y-6">
          {/* Local video */}
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-6 w-6">
                {user?.profilePicture ? (
                  <AvatarImage src={resolveImageUrl(user.profilePicture)} alt={user.username} />
                ) : null}
                <AvatarFallback className="text-xs">
                  {user?.username.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span
                className="font-medium"
                style={user?.usernameColor ? { color: user.usernameColor } : undefined}
              >
                {user?.username} (Vous)
              </span>
            </div>
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={(el) => {
                  if (el) {
                    localVideoRef.current = el;
                    // Ensure stream is set if it exists
                    if (localStreamRef.current && !el.srcObject) {
                      el.srcObject = localStreamRef.current;
                    }
                  }
                }}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          </Card>

          {/* Remote videos */}
          {webcamUsersArray.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Aucune autre caméra active</h2>
              <p className="text-muted-foreground">
                Attendez qu'un autre utilisateur active sa caméra pour le voir ici.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {webcamUsersArray.map((webcamUser) => (
                <Card key={webcamUser.userId} className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-6 w-6">
                      {webcamUser.profilePicture ? (
                        <AvatarImage src={resolveImageUrl(webcamUser.profilePicture)} alt={webcamUser.username} />
                      ) : null}
                      <AvatarFallback className="text-xs">
                        {webcamUser.username.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className="font-medium"
                      style={webcamUser.usernameColor ? { color: webcamUser.usernameColor } : undefined}
                    >
                      {webcamUser.username}
                    </span>
                  </div>
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                      ref={(el) => {
                        if (el) {
                          remoteVideosRef.current.set(webcamUser.userId, el);
                          // If stream is already available, assign it immediately
                          if (webcamUser.stream && !el.srcObject) {
                            el.srcObject = webcamUser.stream;
                            el.play().catch(err => console.error('Error playing video:', err));
                          }
                        } else {
                          remoteVideosRef.current.delete(webcamUser.userId);
                        }
                      }}
                      autoPlay
                      playsInline
                      muted={false}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
