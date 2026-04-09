import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { maintenanceApi } from '@/services/api';
import { normalizeDefaultLandingPage } from '@/lib/default-landing-page';

interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  pages: string[];
  endDate: string | null;
  disabledPages: string[];
  blockedMessage: string;
  referralEnabled: boolean;
  referralDashboardCardEnabled: boolean;
  duelMatchmakingEnabled: boolean;
  defaultLandingPage: string;
  youLogoAdminOnly: boolean;
  betaGameIds: string[];
  newGameIds: string[];
  chatBlocked: boolean;
  chatBlockReason: 'manual' | 'schedule' | null;
  chatBlockMessage: string;
  chatAutoBlockEnabled: boolean;
  chatAutoBlockStart: string | null;
  chatAutoBlockEnd: string | null;
  chatAutoBlockActive: boolean;
  chatBlockTimezone: string;
}

const DEFAULT_STATUS: MaintenanceStatus = {
  enabled: false,
  message: '',
  pages: [],
  endDate: null,
  disabledPages: [],
  blockedMessage: '',
  referralEnabled: true,
  referralDashboardCardEnabled: true,
  duelMatchmakingEnabled: true,
  defaultLandingPage: '/dashboard',
  youLogoAdminOnly: false,
  betaGameIds: [],
  newGameIds: [],
  chatBlocked: false,
  chatBlockReason: null,
  chatBlockMessage: '',
  chatAutoBlockEnabled: false,
  chatAutoBlockStart: null,
  chatAutoBlockEnd: null,
  chatAutoBlockActive: false,
  chatBlockTimezone: 'Europe/Paris',
};

interface FeaturesContextValue {
  maintenanceStatus: MaintenanceStatus;
  maintenanceLoading: boolean;
  refreshFeatures: () => void;
}

const FeaturesContext = createContext<FeaturesContextValue>({
  maintenanceStatus: DEFAULT_STATUS,
  maintenanceLoading: true,
  refreshFeatures: () => {},
});

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus>(DEFAULT_STATUS);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const maintenanceExpiryTimerRef = useRef<number | null>(null);

  const doFetch = useCallback(async () => {
    try {
      const res = await maintenanceApi.getStatus();
      setMaintenanceStatus({
        enabled: res.data.enabled,
        message: res.data.message || '',
        pages: res.data.pages || [],
        endDate: res.data.endDate || null,
        disabledPages: res.data.blockedPages || [],
        blockedMessage: res.data.blockedMessage || '',
        referralEnabled: res.data.referralEnabled !== false,
        referralDashboardCardEnabled: res.data.referralDashboardCardEnabled !== false,
        duelMatchmakingEnabled: res.data.duelMatchmakingEnabled !== false,
        defaultLandingPage: normalizeDefaultLandingPage(res.data.defaultLandingPage),
        youLogoAdminOnly: res.data.youLogoAdminOnly === true,
        betaGameIds: res.data.betaGameIds || [],
        newGameIds: res.data.newGameIds || [],
        chatBlocked: res.data.chatBlocked === true,
        chatBlockReason: res.data.chatBlockReason ?? null,
        chatBlockMessage: res.data.chatBlockMessage || '',
        chatAutoBlockEnabled: res.data.chatAutoBlockEnabled === true,
        chatAutoBlockStart: res.data.chatAutoBlockStart || null,
        chatAutoBlockEnd: res.data.chatAutoBlockEnd || null,
        chatAutoBlockActive: res.data.chatAutoBlockActive === true,
        chatBlockTimezone: res.data.chatBlockTimezone || 'Europe/Paris',
      });
    } catch {
      setMaintenanceStatus(DEFAULT_STATUS);
    } finally {
      setMaintenanceLoading(false);
    }
  }, []);

  useEffect(() => {
    doFetch();
    const interval = window.setInterval(doFetch, 60000);
    return () => window.clearInterval(interval);
  }, [doFetch]);

  useEffect(() => {
    if (maintenanceExpiryTimerRef.current !== null) {
      window.clearTimeout(maintenanceExpiryTimerRef.current);
      maintenanceExpiryTimerRef.current = null;
    }

    if (!maintenanceStatus.enabled || !maintenanceStatus.endDate) {
      return undefined;
    }

    const endAt = new Date(maintenanceStatus.endDate).getTime();
    if (Number.isNaN(endAt)) {
      return undefined;
    }

    const delay = Math.max(0, endAt - Date.now());
    maintenanceExpiryTimerRef.current = window.setTimeout(() => {
      void doFetch();
    }, delay);

    return () => {
      if (maintenanceExpiryTimerRef.current !== null) {
        window.clearTimeout(maintenanceExpiryTimerRef.current);
        maintenanceExpiryTimerRef.current = null;
      }
    };
  }, [maintenanceStatus.enabled, maintenanceStatus.endDate, doFetch]);

  const value = useMemo(
    () => ({ maintenanceStatus, maintenanceLoading, refreshFeatures: doFetch }),
    [maintenanceStatus, maintenanceLoading, doFetch]
  );

  return (
    <FeaturesContext.Provider value={value}>
      {children}
    </FeaturesContext.Provider>
  );
}

export const useFeatures = () => useContext(FeaturesContext);
