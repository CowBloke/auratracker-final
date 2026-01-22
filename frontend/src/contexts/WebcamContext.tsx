import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

interface WebcamContextType {
  isWebcamActive: boolean;
  localStream: MediaStream | null;
  toggleWebcam: () => Promise<void>;
  webcamActiveCount: number;
}

const WebcamContext = createContext<WebcamContextType | undefined>(undefined);

export function WebcamProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [isWebcamActive, setIsWebcamActive] = useState(() => {
    return localStorage.getItem('webcam:active') === 'true';
  });
  const [webcamActiveCount, setWebcamActiveCount] = useState(0);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Écouter le compteur de webcams actives
  useEffect(() => {
    if (!socket) {
      console.log('[WebcamContext] No socket available');
      return;
    }

    const handleActiveCount = (data: { count: number }) => {
      console.log('[WebcamContext] Active count received:', data.count);
      setWebcamActiveCount(data.count);
    };

    const requestCount = () => {
      if (socket && (socket.connected || connected)) {
        console.log('[WebcamContext] Requesting webcam count');
        socket.emit('webcam:get-count');
      } else {
        console.log('[WebcamContext] Socket not connected, cannot request count');
      }
    };

    // Écouter les événements AVANT de demander le compteur
    socket.on('webcam:active-count', handleActiveCount);
    socket.on('webcam:count', handleActiveCount);

    // Écouter la connexion
    const onConnect = () => {
      console.log('[WebcamContext] Socket connected, requesting count');
      // Petit délai pour s'assurer que les handlers sont bien en place
      setTimeout(() => {
        requestCount();
      }, 100);
    };
    socket.on('connect', onConnect);

    // Demander immédiatement si connecté
    if (socket.connected || connected) {
      console.log('[WebcamContext] Socket already connected, requesting count immediately');
      // Petit délai pour s'assurer que les handlers sont bien en place
      setTimeout(() => {
        requestCount();
      }, 100);
    } else {
      console.log('[WebcamContext] Socket not connected yet, will request when connected');
    }

    // Demander le compteur périodiquement pour s'assurer qu'il est à jour
    const interval = setInterval(() => {
      if (socket && (socket.connected || connected)) {
        requestCount();
      }
    }, 5000); // Toutes les 5 secondes

    return () => {
      console.log('[WebcamContext] Cleaning up webcam count listeners');
      clearInterval(interval);
      socket.off('connect', onConnect);
      socket.off('webcam:active-count', handleActiveCount);
      socket.off('webcam:count', handleActiveCount);
    };
  }, [socket, connected]);

  // Activer/désactiver la webcam
  const toggleWebcam = useCallback(async () => {
    if (isWebcamActive) {
      // Désactiver la caméra
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      
      // Notifier le serveur
      if (socket && user) {
        socket.emit('webcam:leave', { userId: user.id });
      }
      
      setIsWebcamActive(false);
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
        setIsWebcamActive(true);
        localStorage.setItem('webcam:active', 'true');
        
        // Rejoindre la room webcam
        if (socket && user) {
          console.log('[WebcamContext] Joining webcam room:', user.id);
          if (socket.connected || connected) {
            socket.emit('webcam:join', {
              userId: user.id,
              username: user.username,
              usernameColor: user.usernameColor,
              profilePicture: user.profilePicture,
              currentPage: window.location.pathname,
            });
          } else {
            socket.once('connect', () => {
              socket.emit('webcam:join', {
                userId: user.id,
                username: user.username,
                usernameColor: user.usernameColor,
                profilePicture: user.profilePicture,
                currentPage: window.location.pathname,
              });
            });
          }
        }
      } catch (err) {
        console.error('[WebcamContext] Error accessing camera:', err);
        alert('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
      }
    }
  }, [isWebcamActive, socket, user]);

  // Restaurer la caméra au chargement si elle était active
  useEffect(() => {
    if (isWebcamActive && !localStreamRef.current && socket && user) {
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
          
          // Rejoindre la room webcam
          if (socket.connected || connected) {
            socket.emit('webcam:join', {
              userId: user.id,
              username: user.username,
              usernameColor: user.usernameColor,
              profilePicture: user.profilePicture,
              currentPage: window.location.pathname,
            });
          } else {
            socket.once('connect', () => {
              socket.emit('webcam:join', {
                userId: user.id,
                username: user.username,
                usernameColor: user.usernameColor,
                profilePicture: user.profilePicture,
                currentPage: window.location.pathname,
              });
            });
          }
        } catch (err) {
          console.error('[WebcamContext] Error restoring camera:', err);
          setIsWebcamActive(false);
          localStorage.removeItem('webcam:active');
        }
      };
      
      restoreCamera();
    }
  }, [isWebcamActive, socket, user]);

  // Note: La mise à jour de la page sera gérée dans Layout.tsx via useLocation

  // Nettoyer à la déconnexion
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (socket && user && isWebcamActive) {
        socket.emit('webcam:leave', { userId: user.id });
      }
    };
  }, [socket, user, isWebcamActive]);

  return (
    <WebcamContext.Provider
      value={{
        isWebcamActive,
        localStream: localStreamRef.current,
        toggleWebcam,
        webcamActiveCount,
      }}
    >
      {children}
    </WebcamContext.Provider>
  );
}

export function useWebcam() {
  const context = useContext(WebcamContext);
  if (!context) {
    throw new Error('useWebcam must be used within a WebcamProvider');
  }
  return context;
}
