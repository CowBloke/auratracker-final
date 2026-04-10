import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from './AuthContext';
import { notificationsApi, type Notification } from '@/services/api';
import { playNotification } from '@/lib/sound-engine';

interface NotificationContextValue {
  notifications: Notification[];
  archivedNotifications: Notification[];
  unreadCount: number;
  browserNotificationSupported: boolean;
  browserNotificationPermission: NotificationPermission | 'unsupported';
  isIosBrowser: boolean;
  loading: boolean;
  loadingArchived: boolean;
  hasMore: boolean;
  hasMoreArchived: boolean;
  requestBrowserNotificationPermission: () => Promise<NotificationPermission | 'unsupported'>;
  fetchNotifications: (opts?: { reset?: boolean }) => Promise<void>;
  fetchArchived: (opts?: { reset?: boolean }) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  archiveNotification: (id: string) => Promise<void>;
  unarchiveNotification: (id: string) => Promise<void>;
  archiveAllRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function sortNotifications(notifications: Notification[]) {
  return [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function upsertNotification(list: Notification[], notification: Notification) {
  const filtered = list.filter((item) => item.id !== notification.id);
  return sortNotifications([notification, ...filtered]);
}

function mergeNotifications(list: Notification[], incoming: Notification[]) {
  return incoming.reduce((current, notification) => upsertNotification(current, notification), list);
}

function isIosDevice() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isiPhoneOrIPad = /iphone|ipad|ipod/.test(userAgent);
  const isModernIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isiPhoneOrIPad || isModernIPad;
}

function isRunningStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

function canUseBrowserNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

async function handleToastNotificationClick(notification: Notification) {
  if (!notification.link) return;
  if (!notification.isRead) {
    try {
      await notificationsApi.markRead(notification.id);
    } catch {
      // Ignore read-state failures here; navigation is the primary action.
    }
  }
  window.location.assign(notification.link);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [archivedNotifications, setArchivedNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [browserNotificationSupported, setBrowserNotificationSupported] = useState(false);
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [isIosBrowser, setIsIosBrowser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [archivedPage, setArchivedPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [hasMoreArchived, setHasMoreArchived] = useState(true);
  const socketRef = useRef<ReturnType<typeof import('../services/socket').initSocket> | null>(null);
  const notificationsRef = useRef<Notification[]>([]);
  const archivedNotificationsRef = useRef<Notification[]>([]);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    notificationsRef.current = notifications;
    notifications.forEach((notification) => knownNotificationIdsRef.current.add(notification.id));
  }, [notifications]);

  useEffect(() => {
    archivedNotificationsRef.current = archivedNotifications;
    archivedNotifications.forEach((notification) => knownNotificationIdsRef.current.add(notification.id));
  }, [archivedNotifications]);

  const notifyIncomingNotification = useCallback((notification: Notification) => {
    if (notification.data?.silent) return;

    toast(notification.title, {
      description: notification.body,
      duration: 5000,
      ...(notification.link
        ? {
            className: 'cursor-pointer',
            onClick: () => {
              void handleToastNotificationClick(notification);
            },
          }
        : {}),
    });
    playNotification();

    if (document.hidden && canUseBrowserNotifications() && Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.title, {
        body: notification.body,
        tag: `aura-notification-${notification.id}`,
        icon: '/aura-icon.svg',
        data: {
          link: notification.link,
          id: notification.id,
        },
      });

      browserNotification.onclick = () => {
        window.focus();
        if (notification.link) {
          void handleToastNotificationClick(notification);
        }
        browserNotification.close();
      };
    }
  }, []);

  const applyNotificationUpdate = useCallback((notification: Notification) => {
    setNotifications((prev) => (
      notification.isArchived
        ? prev.filter((item) => item.id !== notification.id)
        : upsertNotification(prev, notification)
    ));

    setArchivedNotifications((prev) => (
      notification.isArchived
        ? upsertNotification(prev, notification)
        : prev.filter((item) => item.id !== notification.id)
    ));
  }, []);

  const removeNotificationById = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    setArchivedNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const refreshCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await notificationsApi.getUnreadCount();
      setUnreadCount(res.data.count);
    } catch { /* silent */ }
  }, [user]);

  const requestBrowserNotificationPermission = useCallback(async () => {
    if (!canUseBrowserNotifications()) {
      setBrowserNotificationSupported(false);
      setBrowserNotificationPermission('unsupported');
      return 'unsupported';
    }

    const ios = isIosDevice();
    if (ios && !isRunningStandalone()) {
      toast.error('Sur iOS, ajoute Aura Tracker a l\'ecran d\'accueil pour activer les notifications.');
      setBrowserNotificationSupported(true);
      setBrowserNotificationPermission(Notification.permission);
      return Notification.permission;
    }

    const permission = await Notification.requestPermission();
    setBrowserNotificationSupported(true);
    setBrowserNotificationPermission(permission);

    if (permission === 'granted') {
      toast.success('Notifications activees.');
    } else if (permission === 'denied') {
      toast.error('Notifications bloquees par le navigateur.');
    }

    return permission;
  }, []);

  const fetchNotifications = useCallback(
    async (opts: { reset?: boolean } = {}) => {
      if (!user) return;
      const { reset = false } = opts;
      const nextPage = reset ? 1 : page;
      setLoading(true);
      try {
        const res = await notificationsApi.getAll({ page: nextPage, limit: 20, archived: false });
        const { notifications: fetched, totalPages } = res.data;
        setNotifications((prev) => (reset ? fetched : mergeNotifications(prev, fetched)));
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
        setArchivedNotifications((prev) => (reset ? fetched : mergeNotifications(prev, fetched)));
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
    if (user) return;
    setNotifications([]);
    setArchivedNotifications([]);
    setUnreadCount(0);
    setBrowserNotificationSupported(false);
    setBrowserNotificationPermission('unsupported');
    setIsIosBrowser(false);
    setPage(1);
    setArchivedPage(1);
    setHasMore(true);
    setHasMoreArchived(true);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const ios = isIosDevice();
    setIsIosBrowser(ios);

    if (!canUseBrowserNotifications()) {
      setBrowserNotificationSupported(false);
      setBrowserNotificationPermission('unsupported');
      return;
    }

    setBrowserNotificationSupported(true);
    setBrowserNotificationPermission(Notification.permission);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    import('../services/socket').then(({ initSocket }) => {
      if (cancelled) return;
      const token = localStorage.getItem('token');
      if (!token) return;
      const socket = initSocket();
      socketRef.current = socket;

      socket.on('notification:new', (n: Notification) => {
        applyNotificationUpdate(n);
        knownNotificationIdsRef.current.add(n.id);
        setUnreadCount((current) => {
          const alreadyTracked = notificationsRef.current.some((item) => item.id === n.id)
            || archivedNotificationsRef.current.some((item) => item.id === n.id);
          if (alreadyTracked) return current;
          return n.isRead || n.isArchived ? current : current + 1;
        });
        notifyIncomingNotification(n);
      });

      socket.on('notification:updated', (n: Notification) => {
        setUnreadCount((current) => {
          const previous = notificationsRef.current.find((item) => item.id === n.id)
            ?? archivedNotificationsRef.current.find((item) => item.id === n.id);

          if (!previous) {
            return n.isRead || n.isArchived ? current : current + 1;
          }

          if (!previous.isRead && (n.isRead || n.isArchived)) {
            return Math.max(0, current - 1);
          }

          if ((previous.isRead || previous.isArchived) && !n.isRead && !n.isArchived) {
            return current + 1;
          }

          return current;
        });

        applyNotificationUpdate(n);
      });

      socket.on('notification:deleted', ({ id }: { id: string }) => {
        setUnreadCount((current) => {
          const previous = notificationsRef.current.find((item) => item.id === id)
            ?? archivedNotificationsRef.current.find((item) => item.id === id);
          if (!previous || previous.isRead || previous.isArchived) return current;
          return Math.max(0, current - 1);
        });
        removeNotificationById(id);
      });

      socket.on('notification:read-all', ({ ids, readAt }: { ids: string[]; readAt: string }) => {
        if (ids.length === 0) return;
        const idsSet = new Set(ids);
        const affectedUnread = notificationsRef.current.filter((item) => idsSet.has(item.id) && !item.isRead).length;
        setNotifications((prev) => prev.map((item) => (
          idsSet.has(item.id) ? { ...item, isRead: true, readAt } : item
        )));
        setUnreadCount((current) => Math.max(0, current - affectedUnread));
      });

      socket.on('notification:archive-all-read', ({ ids, archivedAt }: { ids: string[]; archivedAt: string }) => {
        if (ids.length === 0) return;

        const idsSet = new Set(ids);
        setNotifications((prev) => {
          const toArchive = prev
            .filter((item) => idsSet.has(item.id))
            .map((item) => ({ ...item, isArchived: true, archivedAt }));

          if (toArchive.length > 0) {
            setArchivedNotifications((current) => sortNotifications([...toArchive, ...current.filter((item) => !idsSet.has(item.id))]));
          }

          return prev.filter((item) => !idsSet.has(item.id));
        });
      });

      socket.on('connect', () => {
        refreshCount();
        setPage(1);
        setHasMore(true);
        fetchNotifications({ reset: true });
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
      cancelled = true;
      socketRef.current?.off('notification:new');
      socketRef.current?.off('notification:updated');
      socketRef.current?.off('notification:deleted');
      socketRef.current?.off('notification:read-all');
      socketRef.current?.off('notification:archive-all-read');
      socketRef.current?.off('connect');
      socketRef.current?.off('notification:broadcast');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyNotificationUpdate, notifyIncomingNotification, refreshCount, removeNotificationById, user?.id]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const pollLatestNotifications = async () => {
      try {
        const res = await notificationsApi.getAll({ page: 1, limit: 20, archived: false });
        if (cancelled) return;

        const fetched = res.data.notifications;
        if (fetched.length === 0) return;

        const newNotifications = fetched.filter((notification) => !knownNotificationIdsRef.current.has(notification.id));

        if (newNotifications.length > 0) {
          setNotifications((prev) => mergeNotifications(prev, fetched));

          for (const notification of newNotifications) {
            knownNotificationIdsRef.current.add(notification.id);

            // Avoid replaying very old notifications on reconnect/reload.
            const createdAtMs = new Date(notification.createdAt).getTime();
            const isRecent = Number.isFinite(createdAtMs) && createdAtMs > Date.now() - (5 * 60 * 1000);
            if (isRecent && !notification.isRead && !notification.isArchived) {
              notifyIncomingNotification(notification);
            }
          }

          void refreshCount();
        }
      } catch {
        // Silent fallback polling.
      }
    };

    const interval = window.setInterval(() => {
      void pollLatestNotifications();
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void pollLatestNotifications();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [notifyIncomingNotification, refreshCount, user?.id]);

  const markRead = useCallback(async (id: string) => {
    try {
      const res = await notificationsApi.markRead(id);
      const previous = notificationsRef.current.find((item) => item.id === id)
        ?? archivedNotificationsRef.current.find((item) => item.id === id);

      applyNotificationUpdate(res.data.notification);

      if (previous && !previous.isRead && (res.data.notification.isRead || res.data.notification.isArchived)) {
        setUnreadCount((current) => Math.max(0, current - 1));
      }

      void refreshCount();
    } catch {
      toast.error('Impossible de marquer la notification comme lue.');
    }
  }, [applyNotificationUpdate, refreshCount]);

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();

      const readAt = new Date().toISOString();
      setNotifications((prev) => prev.map((item) => (
        item.isRead ? item : { ...item, isRead: true, readAt }
      )));
      setUnreadCount(0);

      void refreshCount();
    } catch {
      toast.error('Impossible de marquer toutes les notifications comme lues.');
    }
  }, [refreshCount]);

  const archiveNotification = useCallback(async (id: string) => {
    try {
      const res = await notificationsApi.archive(id);
      if (!socketRef.current?.connected) {
        const previous = notificationsRef.current.find((item) => item.id === id)
          ?? archivedNotificationsRef.current.find((item) => item.id === id);
        applyNotificationUpdate(res.data.notification);
        if (previous && !previous.isRead && !previous.isArchived) {
          setUnreadCount((current) => Math.max(0, current - 1));
        }
      }
    } catch { /* silent */ }
  }, [applyNotificationUpdate]);

  const unarchiveNotification = useCallback(async (id: string) => {
    try {
      const res = await notificationsApi.archive(id);
      if (!socketRef.current?.connected) {
        applyNotificationUpdate(res.data.notification);
      }
    } catch { /* silent */ }
  }, [applyNotificationUpdate]);

  const archiveAllRead = useCallback(async () => {
    try {
      await notificationsApi.archiveAllRead();
      if (!socketRef.current?.connected) {
        const archivedAt = new Date().toISOString();
        const readNotifications = notificationsRef.current
          .filter((item) => item.isRead)
          .map((item) => ({ ...item, isArchived: true, archivedAt }));

        setNotifications((prev) => prev.filter((item) => !item.isRead));
        setArchivedNotifications((prev) => sortNotifications([...readNotifications, ...prev]));
      }
    } catch { /* silent */ }
  }, []);

  const dismissNotification = useCallback(async (id: string) => {
    try {
      const previous = notificationsRef.current.find((item) => item.id === id)
        ?? archivedNotificationsRef.current.find((item) => item.id === id);

      await notificationsApi.remove(id);

      if (previous && !previous.isRead && !previous.isArchived) {
        setUnreadCount((current) => Math.max(0, current - 1));
      }

      removeNotificationById(id);
      void refreshCount();
    } catch {
      toast.error('Impossible de supprimer la notification.');
    }
  }, [refreshCount, removeNotificationById]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        archivedNotifications,
        unreadCount,
        browserNotificationSupported,
        browserNotificationPermission,
        isIosBrowser,
        loading,
        loadingArchived,
        hasMore,
        hasMoreArchived,
        requestBrowserNotificationPermission,
        fetchNotifications,
        fetchArchived,
        markRead,
        markAllRead,
        archiveNotification,
        unarchiveNotification,
        archiveAllRead,
        dismissNotification,
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
