import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { notificationsApi, type Notification } from '@/services/api';

interface NotificationContextValue {
  notifications: Notification[];
  archivedNotifications: Notification[];
  unreadCount: number;
  loading: boolean;
  loadingArchived: boolean;
  hasMore: boolean;
  hasMoreArchived: boolean;
  fetchNotifications: (opts?: { reset?: boolean }) => Promise<void>;
  fetchArchived: (opts?: { reset?: boolean }) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  archiveNotification: (id: string) => Promise<void>;
  unarchiveNotification: (id: string) => Promise<void>;
  archiveAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [archivedNotifications, setArchivedNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [archivedPage, setArchivedPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [hasMoreArchived, setHasMoreArchived] = useState(true);
  const socketRef = useRef<ReturnType<typeof import('../services/socket').initSocket> | null>(null);

  const refreshCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await notificationsApi.getUnreadCount();
      setUnreadCount(res.data.count);
    } catch { /* silent */ }
  }, [user]);

  const fetchNotifications = useCallback(
    async (opts: { reset?: boolean } = {}) => {
      if (!user) return;
      const { reset = false } = opts;
      const nextPage = reset ? 1 : page;
      setLoading(true);
      try {
        const res = await notificationsApi.getAll({ page: nextPage, limit: 20, archived: false });
        const { notifications: fetched, totalPages } = res.data;
        setNotifications((prev) => (reset ? fetched : [...prev, ...fetched]));
        setPage(nextPage + 1);
        setHasMore(nextPage < totalPages);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    },
    [user, page]
  );

  const fetchArchived = useCallback(
    async (opts: { reset?: boolean } = {}) => {
      if (!user) return;
      const { reset = false } = opts;
      const nextPage = reset ? 1 : archivedPage;
      setLoadingArchived(true);
      try {
        const res = await notificationsApi.getAll({ page: nextPage, limit: 20, archived: true });
        const { notifications: fetched, totalPages } = res.data;
        setArchivedNotifications((prev) => (reset ? fetched : [...prev, ...fetched]));
        setArchivedPage(nextPage + 1);
        setHasMoreArchived(nextPage < totalPages);
      } catch { /* silent */ } finally {
        setLoadingArchived(false);
      }
    },
    [user, archivedPage]
  );

  useEffect(() => {
    if (!user) return;
    refreshCount();
    fetchNotifications({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    import('../services/socket').then(({ initSocket }) => {
      const token = localStorage.getItem('token');
      if (!token) return;
      const socket = initSocket();
      socketRef.current = socket;

      socket.on('notification:new', (n: Notification) => {
        setNotifications((prev) => [n, ...prev]);
        setUnreadCount((c) => c + 1);
        toast(n.title, { description: n.body, duration: 5000 });
      });

      socket.on('notification:broadcast', (data: { title: string; body: string }) => {
        toast(data.title, { description: data.body, duration: 6000 });
        refreshCount();
        setPage(1);
        setHasMore(true);
        fetchNotifications({ reset: true });
      });
    });

    return () => {
      socketRef.current?.off('notification:new');
      socketRef.current?.off('notification:broadcast');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const markRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch { /* silent */ }
  }, []);

  const archiveNotification = useCallback(async (id: string) => {
    const n = notifications.find((x) => x.id === id);
    try {
      await notificationsApi.archive(id);
      setNotifications((prev) => prev.filter((x) => x.id !== id));
      if (n && !n.isRead) setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  }, [notifications]);

  const unarchiveNotification = useCallback(async (id: string) => {
    try {
      await notificationsApi.archive(id); // toggles
      setArchivedNotifications((prev) => prev.filter((x) => x.id !== id));
    } catch { /* silent */ }
  }, []);

  const archiveAllRead = useCallback(async () => {
    try {
      await notificationsApi.archiveAllRead();
      setNotifications((prev) => prev.filter((n) => !n.isRead));
    } catch { /* silent */ }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        archivedNotifications,
        unreadCount,
        loading,
        loadingArchived,
        hasMore,
        hasMoreArchived,
        fetchNotifications,
        fetchArchived,
        markRead,
        markAllRead,
        archiveNotification,
        unarchiveNotification,
        archiveAllRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
