import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { initSocket, duelEvents } from '../services/socket';

interface IncomingDuelChallenge {
  challengerId: string;
  challengerUsername: string;
  challengerUsernameColor?: string | null;
  gameType: 'chess' | 'battleship' | 'p4' | 'ballarena' | 'uno';
  timeLimit: number;
  sentAt: number;
}

interface OutgoingDuelChallenge {
  targetId: string;
  targetUsername: string;
  gameType: 'chess' | 'battleship' | 'p4' | 'ballarena' | 'uno';
}

interface DuelMatchmakingStats {
  queuedCount: number;
  inGameCount: number;
}

interface DuelSocketContextValue {
  incomingDuelChallenge: IncomingDuelChallenge | null;
  outgoingDuelChallenge: OutgoingDuelChallenge | null;
  duelMatchmakingQueued: boolean;
  duelMatchmakingStats: DuelMatchmakingStats;
  challengeUserToDuel: (targetId: string, targetUsername: string, gameType: 'chess' | 'battleship' | 'p4' | 'ballarena' | 'uno') => void;
  acceptDuelChallenge: () => void;
  declineDuelChallenge: () => void;
  cancelDuelChallenge: () => void;
  joinDuelMatchmaking: () => void;
  leaveDuelMatchmaking: () => void;
}

const DuelSocketContext = createContext<DuelSocketContextValue | null>(null);

export function DuelSocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  const [incomingDuelChallenge, setIncomingDuelChallenge] = useState<IncomingDuelChallenge | null>(null);
  const [outgoingDuelChallenge, setOutgoingDuelChallenge] = useState<OutgoingDuelChallenge | null>(null);
  const [duelMatchmakingQueued, setDuelMatchmakingQueued] = useState(false);
  const [duelMatchmakingStats, setDuelMatchmakingStats] = useState<DuelMatchmakingStats>({ queuedCount: 0, inGameCount: 0 });

  // Keep these in refs so socket callbacks don't capture stale closures
  const incomingRef = useRef(incomingDuelChallenge);
  const outgoingRef = useRef(outgoingDuelChallenge);
  useEffect(() => { incomingRef.current = incomingDuelChallenge; }, [incomingDuelChallenge]);
  useEffect(() => { outgoingRef.current = outgoingDuelChallenge; }, [outgoingDuelChallenge]);

  useEffect(() => {
    if (!user) return;
    const s = initSocket();

    const handleConnect = () => {
      duelEvents.requestMatchmakingStats();
    };

    if (s.connected) handleConnect();
    s.on('connect', handleConnect);

    s.on('disconnect', () => setDuelMatchmakingQueued(false));

    s.on('duel:challenge-received', (data: IncomingDuelChallenge) => {
      setIncomingDuelChallenge(data);
    });

    s.on('duel:challenge-accepted', (data: { targetId: string; targetUsername: string }) => {
      setOutgoingDuelChallenge(null);
      import('sonner').then(({ toast }) => {
        toast(`Défi accepté !`, { description: `${data.targetUsername} a accepté. Redirection en cours...` });
      });
    });

    s.on('duel:challenge-declined', (data: { targetUsername: string }) => {
      setOutgoingDuelChallenge(null);
      import('sonner').then(({ toast }) => {
        toast(`Défi refusé`, { description: `${data.targetUsername} a refusé le défi.` });
      });
    });

    s.on('duel:challenge-expired', () => {
      setOutgoingDuelChallenge(null);
      import('sonner').then(({ toast }) => {
        toast('Défi expiré', { description: "Le joueur n'a pas répondu à temps." });
      });
    });

    s.on('duel:challenge-cancelled', () => setIncomingDuelChallenge(null));

    s.on('duel:challenge-error', (data: { message: string }) => {
      setIncomingDuelChallenge(null);
      setOutgoingDuelChallenge(null);
      import('sonner').then(({ toast }) => toast.error(data.message));
    });

    s.on('duel:redirect', (data: { path: string }) => {
      setIncomingDuelChallenge(null);
      setOutgoingDuelChallenge(null);
      navigateRef.current(data.path);
    });

    s.on('duel:matchmaking-state', (data: { isQueued: boolean }) => {
      setDuelMatchmakingQueued(Boolean(data.isQueued));
    });

    s.on('duel:matchmaking-stats', (data: { queuedCount: number; inGameCount: number }) => {
      setDuelMatchmakingStats({
        queuedCount: Math.max(0, Number(data.queuedCount) || 0),
        inGameCount: Math.max(0, Number(data.inGameCount) || 0),
      });
    });

    s.on('duel:matchmaking-match-found', (data: { gameType: 'chess' | 'battleship' | 'p4' | 'ballarena' | 'uno' }) => {
      import('sonner').then(({ toast }) => {
        const labels = { chess: 'Echecs', battleship: 'Bataille navale', p4: 'Puissance 4', ballarena: 'Ball Arena', uno: 'UNO' } as const;
        toast('Adversaire trouve !', { description: `Duel ${labels[data.gameType] ?? 'aleatoire'} en cours de lancement...` });
      });
    });

    return () => {
      s.off('connect', handleConnect);
      s.off('disconnect');
      s.off('duel:challenge-received');
      s.off('duel:challenge-accepted');
      s.off('duel:challenge-declined');
      s.off('duel:challenge-expired');
      s.off('duel:challenge-cancelled');
      s.off('duel:challenge-error');
      s.off('duel:redirect');
      s.off('duel:matchmaking-state');
      s.off('duel:matchmaking-stats');
      s.off('duel:matchmaking-match-found');
    };
  }, [user?.id]);

  const challengeUserToDuel = useCallback(
    (targetId: string, targetUsername: string, gameType: 'chess' | 'battleship' | 'p4' | 'ballarena' | 'uno') => {
      if (!user) return;
      setOutgoingDuelChallenge({ targetId, targetUsername, gameType });
      duelEvents.challenge(targetId, gameType);
    },
    [user?.id]
  );

  const acceptDuelChallenge = useCallback(() => {
    if (!incomingRef.current) return;
    duelEvents.accept(incomingRef.current.challengerId, incomingRef.current.gameType);
    setIncomingDuelChallenge(null);
  }, []);

  const declineDuelChallenge = useCallback(() => {
    if (!incomingRef.current) return;
    duelEvents.decline(incomingRef.current.challengerId, incomingRef.current.gameType);
    setIncomingDuelChallenge(null);
  }, []);

  const cancelDuelChallenge = useCallback(() => {
    if (!outgoingRef.current) return;
    duelEvents.cancel(outgoingRef.current.targetId, outgoingRef.current.gameType);
    setOutgoingDuelChallenge(null);
  }, []);

  const joinDuelMatchmaking = useCallback(() => duelEvents.joinMatchmaking(), []);
  const leaveDuelMatchmaking = useCallback(() => duelEvents.leaveMatchmaking(), []);

  const value = useMemo(
    () => ({
      incomingDuelChallenge,
      outgoingDuelChallenge,
      duelMatchmakingQueued,
      duelMatchmakingStats,
      challengeUserToDuel,
      acceptDuelChallenge,
      declineDuelChallenge,
      cancelDuelChallenge,
      joinDuelMatchmaking,
      leaveDuelMatchmaking,
    }),
    [
      incomingDuelChallenge,
      outgoingDuelChallenge,
      duelMatchmakingQueued,
      duelMatchmakingStats,
      challengeUserToDuel,
      acceptDuelChallenge,
      declineDuelChallenge,
      cancelDuelChallenge,
      joinDuelMatchmaking,
      leaveDuelMatchmaking,
    ]
  );

  return <DuelSocketContext.Provider value={value}>{children}</DuelSocketContext.Provider>;
}

export function useDuelSocket() {
  const ctx = useContext(DuelSocketContext);
  if (!ctx) throw new Error('useDuelSocket must be used within DuelSocketProvider');
  return ctx;
}
