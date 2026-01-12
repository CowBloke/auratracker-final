import { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  MessageCircle,
  Send,
  ChevronDown,
  ChevronUp,
  Users,
  Circle,
} from 'lucide-react';

type TimeoutRef = ReturnType<typeof setTimeout> | null;

interface ChatProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function Chat({ isOpen, onToggle }: ChatProps) {
  const { user } = useAuth();
  const { messages, onlineUsers, typingUsers, sendMessage, setTyping } = useSocket();
  const [input, setInput] = useState('');
  const [showUsers, setShowUsers] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<TimeoutRef>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Réinitialiser le compteur quand le chat s'ouvre
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      if (messages.length > 0) {
        lastMessageIdRef.current = messages[messages.length - 1].id;
      }
    }
  }, [isOpen, messages]);

  // Suivre les messages non lus quand le chat est fermé
  useEffect(() => {
    if (!isOpen && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // Si c'est un nouveau message (pas déjà vu) et que ce n'est pas notre propre message
      if (lastMessage.id !== lastMessageIdRef.current && lastMessage.userId !== user?.id) {
        setUnreadCount((prev) => prev + 1);
        lastMessageIdRef.current = lastMessage.id;
      }
    }
  }, [messages, isOpen, user?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input.trim());
      setInput('');
      setTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setTyping(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 2000);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`fixed bottom-0 left-64 right-0 bg-surface border-t border-gray-700/50 transition-all duration-300 z-40 ${
        isOpen ? 'h-80' : 'h-14'
      }`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full h-14 px-6 flex items-center justify-between hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <MessageCircle className="w-5 h-5 text-primary" />
            {!isOpen && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span className="font-medium">Global Chat</span>
          <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary-light text-xs">
            {onlineUsers.length} online
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="flex h-[calc(100%-3.5rem)]">
          {/* Messages */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${
                    msg.userId === user?.id ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div
                    className={`max-w-[70%] ${
                      msg.userId === user?.id
                        ? 'bg-primary/20 border-primary/30'
                        : 'bg-background border-gray-700/50'
                    } border rounded-lg px-4 py-2`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-sm font-medium ${
                          msg.userId === user?.id
                            ? 'text-primary-light'
                            : 'text-accent-cyan'
                        }`}
                      >
                        {msg.username}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <p className="text-gray-200">{msg.message}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <div className="px-4 py-2 text-sm text-gray-400">
                {typingUsers.map((u) => u.username).join(', ')}{' '}
                {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700/50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Type a message..."
                  className="input flex-1"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="btn-primary px-4"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>

          {/* Online Users Sidebar */}
          <div className="w-48 border-l border-gray-700/50 bg-background/50">
            <button
              onClick={() => setShowUsers(!showUsers)}
              className="w-full p-3 flex items-center justify-between hover:bg-surface-hover transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium">Online</span>
              </div>
              <span className="text-xs text-gray-500">{onlineUsers.length}</span>
            </button>
            <div className="p-2 space-y-1 max-h-[calc(100%-3rem)] overflow-y-auto scrollbar-thin">
              {onlineUsers.map((u) => (
                <div
                  key={u.userId}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-hover"
                >
                  <Circle className="w-2 h-2 fill-accent-green text-accent-green" />
                  <span className="text-sm text-gray-300 truncate">
                    {u.username}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
