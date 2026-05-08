import type { ReactNode } from 'react';

export type TutorialPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto';

export interface TutorialStep {
  id: string;
  targetId?: string;
  placement?: TutorialPlacement;
  title: string;
  content: ReactNode;
  actionText?: string;
  spotlightPadding?: number;
  route?: string;
  advanceOn?: 'manual' | 'target-click' | 'target-input' | 'target-change' | 'target-present';
  advanceDelayMs?: number;
  requireManualAdvance?: boolean;
}

export interface TutorialSection {
  id: string;
  title: string;
  startIndex: number;
  endIndex: number;
}

export interface TutorialFlow {
  id: string;
  title: string;
  description: string;
  steps: TutorialStep[];
  sections: TutorialSection[];
}
