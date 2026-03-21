import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { maintenanceApi } from '@/services/api';

interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  pages: string[];
  endDate: string | null;
  disabledPages: string[];
  blockedMessage: string;
  referralEnabled: boolean;
}

const DEFAULT_STATUS: MaintenanceStatus = {
  enabled: false,
  message: '',
  pages: [],
  endDate: null,
  disabledPages: [],
  blockedMessage: '',
  referralEnabled: true,
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
