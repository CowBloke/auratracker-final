import { describe, expect, it } from 'vitest';

import { cn, humanizeUiLabel } from './utils';

describe('humanizeUiLabel', () => {
  it('normalizes snake case labels', () => {
    expect(humanizeUiLabel('HELLO_WORLD')).toBe('Hello world');
  });

  it('collapses extra whitespace', () => {
    expect(humanizeUiLabel('  mixed__VALUE   test  ')).toBe('Mixed value test');
  });

  it('returns an empty string for empty values', () => {
    expect(humanizeUiLabel(undefined)).toBe('');
    expect(humanizeUiLabel(null)).toBe('');
    expect(humanizeUiLabel('')).toBe('');
  });
});

describe('cn', () => {
  it('merges tailwind classes predictably', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });
});
