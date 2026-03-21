import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { initSocket, getSocket, partyEvents, connectSocket } from '../services/socket';

interface PartyMember {
  userId: string;
  username: string;
  usernameColor?: string | null;
  isLeader: boolean;
}

interface Party {
  id: string;
  name: string | null;
  isPublic: boolean;
  maxSize: number;
}

interface PartyInvite {
  partyId: string;
  partyName: string | null;
  inviterId: string;
  inviterUsername: string;
}

interface PartyJoinRequest {
  partyId: string;
  partyName: string | null;
  userId: string;
  username: string;
  usernameColor?: string | null;
  requestedAt: number;
}

interface PartyDirectoryItem {
  id: string;
  name: string | null;
  memberCount: number;
  maxSize: number;
  isPublic: boolean;
  members?: Array<{
    userId: string;
    username: string;
    usernameColor?: string | null;
    isLeader: boolean;
  }>;
  selectedGame?: {
    gameId: string;
    gameName: string;
    selectedById: string;
    selectedByName: string;
    selectedByColor?: string | null;
    selectedAt: number;
  } | null;
}

interface PartyGameSuggestion {
  id: string;
  gameId: string;
  gameName: string;
  suggestedById: string;
  suggestedByName: string;
  suggestedByColor?: string | null;
  suggestedAt: number;
}

interface PartySelectedGame {
  gameId: string;
  gameName: string;
  selectedById: string;
  selectedByName: string;
  selectedByColor?: string | null;
  selectedAt: number;
}

export interface PartyChatMessage {
  id: string;
  partyId: string;
  userId: string;
  username: string;
  usernameColor?: string | null;
  message: string;
  timestamp: string;
}

interface PartySocketContextValue {
  currentParty: Party | null;
  partyMembers: PartyMember[];
  partyInvites: PartyInvite[];
  partyJoinRequests: PartyJoinRequest[];
  pendingJoinRequests: string[];
  publicParties: PartyDirectoryItem[];
  partyGameSuggestions: PartyGameSuggestion[];
  partySelectedGame: PartySelectedGame | null;
  partyMessages: PartyChatMessage[];
  createParty: (name?: string, isPublic?: boolean, maxSize?: number) => void;
  joinParty: (partyId: string) => void;
  requestJoinParty: (partyId: string) => void;
  respondToJoinRequest: (targetUserId: string, accepted: boolean) => void;
  leaveParty: () => void;
  deleteParty: () => void;
  inviteToParty: (targetUserId: string) => void;
  rejectPartyInvite: (partyId: string) => void;
  kickFromParty: (targetUserId: string) => void;
  fetchPublicParties: () => void;
  syncParty: () => void;
  suggestPartyGame: (gameId: string, gameName: string) => void;
  selectPartyGame: (gameId: string, gameName: string) => void;
  sendPartyMessage: (message: string) => void;
}

const PartySocketContext = createContext<PartySocketContextValue | null>(null);

export function PartySocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  const [currentParty, setCurrentParty] = useState<Party | null>(null);
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const [partyInvites, setPartyInvites] = useState<PartyInvite[]>([]);
  const [partyJoinRequests, setPartyJoinRequests] = useState<PartyJoinRequest[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<string[]>([]);
  const [publicParties, setPublicParties] = useState<PartyDirectoryItem[]>([]);
  const [partyGameSuggestions, setPartyGameSuggestions] = useState<PartyGameSuggestion[]>([]);
  const [partySelectedGame, setPartySelectedGame] = useState<PartySelectedGame | null>(null);
  const [partyMessages, setPartyMessages] = useState<PartyChatMessage[]>([]);

  // Use a ref for pending redirect partyId to avoid stale closure in socket handlers
  const pendingJoinRedirectRef = useRef<string | null>(null);

  // Keep currentParty in a ref for use in callbacks without needing it as a dep
  const currentPartyRef = useRef(currentParty);
  useEffect(() => { currentPartyRef.current = currentParty; }, [currentParty]);

  useEffect(() => {
    if (!user) return;
    const s = initSocket();

    const handleConnect = () => {
      partyEvents.register(user.id);
      partyEvents.sync(user.id);
      partyEvents.list();
    };

    if (s.connected) handleConnect();
    s.on('connect', handleConnect);

    s.on('party:created', (data: { party: Party; members: PartyMember[] }) => {
      setCurrentParty(data.party);
      setPartyMembers(data.members);
      setPartyMessages([]);
      setPendingJoinRequests([]);
      setPartyGameSuggestions([]);
      setPartySelectedGame(null);
      partyEvents.list();
    });

    s.on('party:joined', (data: { party: Party; members: PartyMember[] }) => {
      setCurrentParty(data.party);
      setPartyMembers(data.members);
      setPartyMessages([]);
      setPartyInvites((prev) => prev.filter((invite) => invite.partyId !== data.party.id));
      setPendingJoinRequests([]);
      setPartyGameSuggestions([]);
      setPartySelectedGame(null);
      if (
        typeof window !== 'undefined' &&
        pendingJoinRedirectRef.current === data.party.id &&
        window.location.pathname !== '/party'
      ) {
        navigateRef.current('/party');
      }
      pendingJoinRedirectRef.current = null;
      partyEvents.list();
    });

    s.on('party:restored', (data: { party: Party; members: PartyMember[] }) => {
      setCurrentParty(data.party);
      setPartyMembers(data.members);
      setPartyMessages([]);
      setPartyInvites((prev) => prev.filter((invite) => invite.partyId !== data.party.id));
      setPendingJoinRequests([]);
      setPartyGameSuggestions([]);
      setPartySelectedGame(null);
    });

    s.on('party:member-joined', (member: { userId: string; username: string; usernameColor?: string | null }) => {
      setPartyMembers((prev) => [...prev, { ...member, isLeader: false }]);
      partyEvents.list();
    });

    s.on('party:member-left', (data: { userId: string }) => {
      setPartyMembers((prev) => prev.filter((m) => m.userId !== data.userId));
      partyEvents.list();
    });

    const handlePartyReset = () => {
      setCurrentParty(null);
      setPartyMembers([]);
      setPartyMessages([]);
      setPartyJoinRequests([]);
      setPendingJoinRequests([]);
      setPartyGameSuggestions([]);
      setPartySelectedGame(null);
      partyEvents.list();
    };

    s.on('party:disbanded', handlePartyReset);
    s.on('party:left', handlePartyReset);
    s.on('party:kicked', handlePartyReset);

    s.on('party:not-in-party', () => {
      setCurrentParty(null);
      setPartyMembers([]);
      setPartyMessages([]);
      setPartyJoinRequests([]);
      setPendingJoinRequests([]);
      setPartyGameSuggestions([]);
      setPartySelectedGame(null);
    });

    s.on('party:invite', (invite: PartyInvite) => {
      setPartyInvites((prev) => [...prev, invite]);
      if (typeof window !== 'undefined') {
        import('sonner').then(({ toast }) => {
          toast(`Invitation de party`, {
            description: `${invite.inviterUsername} vous invite à rejoindre ${invite.partyName || 'leur party'}`,
            action: {
              label: 'Voir',
              onClick: () => {
                if (window.location.pathname !== '/party') window.location.href = '/party';
              },
            },
          });
        });
      }
    });

    s.on('party:list', (data: { parties: PartyDirectoryItem[] }) => {
      setPublicParties(data.parties);
    });

    s.on('party:leader-changed', (data: { newLeaderId: string }) => {
      setPartyMembers((prev) =>
        prev.map((m) => ({ ...m, isLeader: m.userId === data.newLeaderId }))
      );
    });

    s.on('party:join-request', (request: PartyJoinRequest) => {
      setPartyJoinRequests((prev) => {
        if (prev.some((e) => e.userId === request.userId && e.partyId === request.partyId))
          return prev;
        return [...prev, request];
      });
    });

    s.on('party:join-request-list', (data: { requests: PartyJoinRequest[] }) => {
      setPartyJoinRequests(data.requests);
    });

    s.on('party:join-requested', (data: { partyId: string }) => {
      setPendingJoinRequests((prev) =>
        prev.includes(data.partyId) ? prev : [...prev, data.partyId]
      );
    });

    s.on('party:join-request-resolved', (data: { partyId: string }) => {
      setPendingJoinRequests((prev) => prev.filter((id) => id !== data.partyId));
    });

    s.on('party:game-state', (data: { selectedGame: PartySelectedGame | null; suggestions: PartyGameSuggestion[] }) => {
      setPartySelectedGame(data.selectedGame);
      setPartyGameSuggestions(data.suggestions);
    });

    s.on('party:chat-history', (data: { partyId: string; messages: PartyChatMessage[] }) => {
      setPartyMessages(data.messages);
    });

    s.on('party:chat-message', (message: PartyChatMessage) => {
      setPartyMessages((prev) => {
        if (prev.some((e) => e.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    s.on('party:chat-error', (data: { message: string }) => {
      import('sonner').then(({ toast }) => toast.error(data.message));
    });

    s.on('party:error', () => {
      pendingJoinRedirectRef.current = null;
    });

    return () => {
      s.off('connect', handleConnect);
      s.off('party:created');
      s.off('party:joined');
      s.off('party:restored');
      s.off('party:member-joined');
      s.off('party:member-left');
      s.off('party:disbanded', handlePartyReset);
      s.off('party:left', handlePartyReset);
      s.off('party:kicked', handlePartyReset);
      s.off('party:not-in-party');
      s.off('party:invite');
      s.off('party:list');
      s.off('party:leader-changed');
      s.off('party:join-request');
      s.off('party:join-request-list');
      s.off('party:join-requested');
      s.off('party:join-request-resolved');
      s.off('party:game-state');
      s.off('party:chat-history');
      s.off('party:chat-message');
      s.off('party:chat-error');
      s.off('party:error');
    };
  }, [user?.id]);

  const createParty = useCallback(
    (name?: string, isPublic = false, maxSize = 8) => {
      if (user) partyEvents.create(user.id, name, isPublic, maxSize);
    },
    [user?.id]
  );

  const joinParty = useCallback(
    (partyId: string) => {
      if (user) {
        pendingJoinRedirectRef.current = partyId;
        partyEvents.join(user.id, partyId);
      }
    },
    [user?.id]
  );

  const requestJoinParty = useCallback(
    (partyId: string) => {
      if (user) {
        partyEvents.requestJoin(user.id, partyId);
        setPendingJoinRequests((prev) => (prev.includes(partyId) ? prev : [...prev, partyId]));
      }
    },
    [user?.id]
  );

  const respondToJoinRequest = useCallback(
    (targetUserId: string, accepted: boolean) => {
      if (user) {
        partyEvents.respondToJoinRequest(user.id, targetUserId, accepted);
        setPartyJoinRequests((prev) => prev.filter((r) => r.userId !== targetUserId));
      }
    },
    [user?.id]
  );

  const leaveParty = useCallback(() => {
    if (user) partyEvents.leave(user.id);
  }, [user?.id]);

  const deleteParty = useCallback(() => {
    if (user) partyEvents.delete(user.id);
  }, [user?.id]);

  const inviteToParty = useCallback(
    (targetUserId: string) => {
      if (user) partyEvents.invite(user.id, targetUserId);
    },
    [user?.id]
  );

  const rejectPartyInvite = useCallback(
    (partyId: string) => {
      if (user) {
        getSocket()?.emit('party:reject-invite', { userId: user.id, partyId });
        setPartyInvites((prev) => prev.filter((invite) => invite.partyId !== partyId));
      }
    },
    [user?.id]
  );

  const kickFromParty = useCallback(
    (targetUserId: string) => {
      if (user) partyEvents.kick(user.id, targetUserId);
    },
    [user?.id]
  );

  const fetchPublicParties = useCallback(() => {
    const s = getSocket() ?? initSocket();
    if (s.connected) {
      partyEvents.list();
    } else {
      s.once('connect', () => partyEvents.list());
      connectSocket();
    }
  }, []);

  const syncParty = useCallback(() => {
    if (user) partyEvents.sync(user.id);
  }, [user?.id]);

  const suggestPartyGame = useCallback(
    (gameId: string, gameName: string) => {
      if (user && currentPartyRef.current) partyEvents.suggestGame(user.id, gameId, gameName);
    },
    [user?.id]
  );

  const selectPartyGame = useCallback(
    (gameId: string, gameName: string) => {
      if (user && currentPartyRef.current) partyEvents.selectGame(user.id, gameId, gameName);
    },
    [user?.id]
  );

  const sendPartyMessage = useCallback(
    (message: string) => {
      if (user && currentPartyRef.current) partyEvents.sendChatMessage(message);
    },
    [user?.id]
  );

  const value = useMemo(
    () => ({
      currentParty,
      partyMembers,
      partyInvites,
      partyJoinRequests,
      pendingJoinRequests,
      publicParties,
      partyGameSuggestions,
      partySelectedGame,
      partyMessages,
      createParty,
      joinParty,
      requestJoinParty,
      respondToJoinRequest,
      leaveParty,
      deleteParty,
      inviteToParty,
      rejectPartyInvite,
      kickFromParty,
      fetchPublicParties,
      syncParty,
      suggestPartyGame,
      selectPartyGame,
      sendPartyMessage,
    }),
    [
      currentParty,
      partyMembers,
      partyInvites,
      partyJoinRequests,
      pendingJoinRequests,
      publicParties,
      partyGameSuggestions,
      partySelectedGame,
      partyMessages,
      createParty,
      joinParty,
      requestJoinParty,
      respondToJoinRequest,
      leaveParty,
      deleteParty,
      inviteToParty,
      rejectPartyInvite,
      kickFromParty,
      fetchPublicParties,
      syncParty,
      suggestPartyGame,
      selectPartyGame,
      sendPartyMessage,
    ]
  );

  return <PartySocketContext.Provider value={value}>{children}</PartySocketContext.Provider>;
}

export function usePartySocket() {
  const ctx = useContext(PartySocketContext);
  if (!ctx) throw new Error('usePartySocket must be used within PartySocketProvider');
  return ctx;
}
