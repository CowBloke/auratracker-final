import React, { createContext, useContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { initSocket, connectSocket, disconnectSocket, chatEvents, partyEvents, gameEvents } from '../services/socket';
import { useAuth } from './AuthContext';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
  message: string;
  timestamp: string;
}

interface OnlineUser {
  userId: string;
  username: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
}

interface TypingUser {
  userId: string;
  username: string;
}

interface PartyMember {
  userId: string;
  username: string;
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

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  // Chat
  messages: ChatMessage[];
  onlineUsers: OnlineUser[];
  typingUsers: TypingUser[];
  sendMessage: (message: string) => void;
  setTyping: (isTyping: boolean) => void;
  // Party
  currentParty: Party | null;
  partyMembers: PartyMember[];
  partyInvites: PartyInvite[];
  publicParties: Array<{ id: string; name: string | null; memberCount: number; maxSize: number }>;
  createParty: (name?: string, isPublic?: boolean) => void;
  joinParty: (partyId: string) => void;
  leaveParty: () => void;
  inviteToParty: (targetUserId: string) => void;
  kickFromParty: (targetUserId: string) => void;
  fetchPublicParties: () => void;
  // Balance updates
  balanceUpdate: { userId: string; aura: number; money: number } | null;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, updateBalance } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  
  // Party state
  const [currentParty, setCurrentParty] = useState<Party | null>(null);
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const [partyInvites, setPartyInvites] = useState<PartyInvite[]>([]);
  const [publicParties, setPublicParties] = useState<Array<{ id: string; name: string | null; memberCount: number; maxSize: number }>>([]);
  
  // Balance update state
  const [balanceUpdate, setBalanceUpdate] = useState<{ userId: string; aura: number; money: number } | null>(null);

  useEffect(() => {
    if (user) {
      const s = initSocket();
      setSocket(s);
      connectSocket();

      s.on('connect', () => {
        setConnected(true);
        chatEvents.join(user.id, user.username);
        partyEvents.register(user.id);
        gameEvents.register(user.id);
      });

      s.on('disconnect', () => {
        setConnected(false);
      });

      // Chat events
      s.on('chat:history', (data: { messages: ChatMessage[] }) => {
        setMessages(data.messages);
      });

      s.on('chat:message', (message: ChatMessage) => {
        setMessages((prev) => [...prev, message]);
      });

      s.on('users:online-list', (data: { users: OnlineUser[] }) => {
        setOnlineUsers(data.users);
      });

      s.on('user:online', (user: OnlineUser) => {
        setOnlineUsers((prev) => {
          if (prev.find((u) => u.userId === user.userId)) return prev;
          return [...prev, user];
        });
      });

      s.on('user:offline', (user: { userId: string }) => {
        setOnlineUsers((prev) => prev.filter((u) => u.userId !== user.userId));
      });

      s.on('chat:typing', (data: TypingUser & { isTyping: boolean }) => {
        if (data.isTyping) {
          setTypingUsers((prev) => {
            if (prev.find((u) => u.userId === data.userId)) return prev;
            return [...prev, { userId: data.userId, username: data.username }];
          });
        } else {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
        }
      });

      // Party events
      s.on('party:created', (data: { party: Party; members: PartyMember[] }) => {
        setCurrentParty(data.party);
        setPartyMembers(data.members);
      });

      s.on('party:joined', (data: { party: Party; members: PartyMember[] }) => {
        setCurrentParty(data.party);
        setPartyMembers(data.members);
      });

      s.on('party:member-joined', (member: { userId: string; username: string }) => {
        setPartyMembers((prev) => [...prev, { ...member, isLeader: false }]);
      });

      s.on('party:member-left', (data: { userId: string }) => {
        setPartyMembers((prev) => prev.filter((m) => m.userId !== data.userId));
      });

      s.on('party:disbanded', () => {
        setCurrentParty(null);
        setPartyMembers([]);
      });

      s.on('party:left', () => {
        setCurrentParty(null);
        setPartyMembers([]);
      });

      s.on('party:kicked', () => {
        setCurrentParty(null);
        setPartyMembers([]);
      });

      s.on('party:invite', (invite: PartyInvite) => {
        setPartyInvites((prev) => [...prev, invite]);
      });

      s.on('party:list', (data: { parties: typeof publicParties }) => {
        setPublicParties(data.parties);
      });

      s.on('party:leader-changed', (data: { newLeaderId: string }) => {
        setPartyMembers((prev) =>
          prev.map((m) => ({
            ...m,
            isLeader: m.userId === data.newLeaderId,
          }))
        );
      });

      // Economy events
      s.on('economy:balance-update', (data: { userId: string; aura: number; money: number }) => {
        setBalanceUpdate(data);
        if (data.userId === user.id) {
          updateBalance(data.aura, data.money);
        }
      });

      return () => {
        disconnectSocket();
        s.removeAllListeners();
      };
    }
  }, [user, updateBalance]);

  const sendMessage = (message: string) => {
    if (user) {
      chatEvents.sendMessage(user.id, message);
    }
  };

  const setTyping = (isTyping: boolean) => {
    if (user) {
      chatEvents.setTyping(user.id, isTyping);
    }
  };

  const createParty = (name?: string, isPublic: boolean = false) => {
    if (user) {
      partyEvents.create(user.id, name, isPublic);
    }
  };

  const joinParty = (partyId: string) => {
    if (user) {
      partyEvents.join(user.id, partyId);
      setPartyInvites((prev) => prev.filter((i) => i.partyId !== partyId));
    }
  };

  const leaveParty = () => {
    if (user) {
      partyEvents.leave(user.id);
    }
  };

  const inviteToParty = (targetUserId: string) => {
    if (user) {
      partyEvents.invite(user.id, targetUserId);
    }
  };

  const kickFromParty = (targetUserId: string) => {
    if (user) {
      partyEvents.kick(user.id, targetUserId);
    }
  };

  const fetchPublicParties = () => {
    partyEvents.list();
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        messages,
        onlineUsers,
        typingUsers,
        sendMessage,
        setTyping,
        currentParty,
        partyMembers,
        partyInvites,
        publicParties,
        createParty,
        joinParty,
        leaveParty,
        inviteToParty,
        kickFromParty,
        fetchPublicParties,
        balanceUpdate,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
