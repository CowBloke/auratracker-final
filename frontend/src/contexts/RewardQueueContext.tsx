import React, { createContext, useCallback, useContext, useState } from 'react';
import RewardCollector from '../components/rewards/RewardCollector';

export interface RewardItem {
  id: string;
  type: 'money' | 'aura' | 'item';
  amount: number;
  label: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}

interface RewardQueueCtx {
  enqueue: (items: RewardItem[]) => void;
}

const RewardQueueContext = createContext<RewardQueueCtx | null>(null);

export function useRewardQueue() {
  const ctx = useContext(RewardQueueContext);
  if (!ctx) throw new Error('useRewardQueue must be used inside RewardQueueProvider');
  return ctx;
}

interface QueueState {
  items: RewardItem[];
  currentIndex: number;
  phase: 'collecting' | 'summary';
}

export function RewardQueueProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<QueueState | null>(null);

  const enqueue = useCallback((items: RewardItem[]) => {
    if (!items.length) return;
    setState({ items, currentIndex: 0, phase: 'collecting' });
  }, []);

  const advance = useCallback(() => {
    setState((prev) => {
      if (!prev) return null;
      const next = prev.currentIndex + 1;
      if (next >= prev.items.length) return { ...prev, phase: 'summary' };
      return { ...prev, currentIndex: next };
    });
  }, []);

  const close = useCallback(() => setState(null), []);

  return (
    <RewardQueueContext.Provider value={{ enqueue }}>
      {children}
      {state && (
        <RewardCollector
          items={state.items}
          currentIndex={state.currentIndex}
          phase={state.phase}
          onAdvance={advance}
          onClose={close}
        />
      )}
    </RewardQueueContext.Provider>
  );
}
