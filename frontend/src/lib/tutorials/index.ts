import { youOnboarding } from './you-onboarding';
import { createLevel1Business } from './create-level1-business';
import { buildBusinessAToZ } from './build-business-a-to-z';
import { gamesIntro } from './games-intro';
import { clansIntro } from './clans-intro';
import type { TutorialFlow } from '@/components/tutorial/types';

export const TUTORIAL_FLOWS: Record<string, TutorialFlow> = {
  [youOnboarding.id]: youOnboarding,
  [buildBusinessAToZ.id]: buildBusinessAToZ,
  [createLevel1Business.id]: createLevel1Business,
  [gamesIntro.id]: gamesIntro,
  [clansIntro.id]: clansIntro,
};

export const DEFAULT_FLOW_ID = youOnboarding.id;

export const TUTORIAL_FLOW_ORDER = [
  youOnboarding.id,
  buildBusinessAToZ.id,
  createLevel1Business.id,
  gamesIntro.id,
  clansIntro.id,
];
