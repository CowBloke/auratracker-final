import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { TUTORIAL_FLOWS, DEFAULT_FLOW_ID } from '@/lib/tutorials';
import type { TutorialStep, TutorialFlow, TutorialSection } from './types';
import { useAuth } from '@/contexts/AuthContext';

interface TutorialContextType {
  active: boolean;
  flow: TutorialFlow | null;
  stepIndex: number;
  currentStep: TutorialStep | null;
  totalSteps: number;
  currentSection: TutorialSection | null;
  isFirstStepOfSection: boolean;
  hasSeenWelcome: boolean;
  start: (flowId?: string) => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  skipSection: () => void;
  acknowledgeWelcome: () => void;
}

const TutorialContext = createContext<TutorialContextType | null>(null);

function getWelcomeKey(userId: string) {
  return `tutorial_welcomed_${userId}`;
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(true);

  useEffect(() => {
    if (!user) return;
    const seen = localStorage.getItem(getWelcomeKey(user.id));
    setHasSeenWelcome(!!seen);
  }, [user]);

  const acknowledgeWelcome = useCallback(() => {
    if (!user) return;
    localStorage.setItem(getWelcomeKey(user.id), '1');
    setHasSeenWelcome(true);
  }, [user]);

  const flow = useMemo(() => (flowId ? (TUTORIAL_FLOWS[flowId] ?? null) : null), [flowId]);

  const currentStep = useMemo(
    () => (flow ? (flow.steps[stepIndex] ?? null) : null),
    [flow, stepIndex]
  );

  const totalSteps = flow?.steps.length ?? 0;

  const currentSection = useMemo(() => {
    if (!flow) return null;
    return flow.sections.find((s) => stepIndex >= s.startIndex && stepIndex <= s.endIndex) ?? null;
  }, [flow, stepIndex]);

  const isFirstStepOfSection = useMemo(
    () => !!currentSection && stepIndex === currentSection.startIndex,
    [currentSection, stepIndex]
  );

  const start = useCallback((id = DEFAULT_FLOW_ID) => {
    setFlowId(id);
    setStepIndex(0);
    setActive(true);
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    setFlowId(null);
    setStepIndex(0);
  }, []);

  const next = useCallback(() => {
    if (!flow) return;
    const nextIndex = stepIndex + 1;
    if (nextIndex >= flow.steps.length) {
      stop();
    } else {
      setStepIndex(nextIndex);
    }
  }, [flow, stepIndex, stop]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const skipSection = useCallback(() => {
    if (!flow || !currentSection) return;
    const nextIndex = currentSection.endIndex + 1;
    if (nextIndex >= flow.steps.length) {
      stop();
    } else {
      setStepIndex(nextIndex);
    }
  }, [flow, currentSection, stop]);

  const value = useMemo<TutorialContextType>(
    () => ({
      active,
      flow,
      stepIndex,
      currentStep,
      totalSteps,
      currentSection,
      isFirstStepOfSection,
      hasSeenWelcome,
      start,
      stop,
      next,
      prev,
      skipSection,
      acknowledgeWelcome,
    }),
    [
      active, flow, stepIndex, currentStep, totalSteps, currentSection,
      isFirstStepOfSection, hasSeenWelcome, start, stop, next, prev, skipSection, acknowledgeWelcome,
    ]
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used inside TutorialProvider');
  return ctx;
}
