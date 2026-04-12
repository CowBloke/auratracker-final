import { describe, expect, it, vi } from 'vitest';
import { startRouletteRound } from './startRouletteRound';

describe('startRouletteRound', () => {
  it('starts round even when refresh fails', async () => {
    const startCasino = vi.fn().mockResolvedValue({ success: true });
    const refreshUser = vi.fn().mockRejectedValue(new Error('network'));

    await expect(
      startRouletteRound({ bet: 40000, startCasino, refreshUser })
    ).resolves.toBeUndefined();

    expect(startCasino).toHaveBeenCalledWith(40000);
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });

  it('throws when startCasino fails', async () => {
    const startCasino = vi.fn().mockRejectedValue(new Error('insufficient funds'));
    const refreshUser = vi.fn().mockResolvedValue(undefined);

    await expect(
      startRouletteRound({ bet: 40000, startCasino, refreshUser })
    ).rejects.toThrow('insufficient funds');

    expect(refreshUser).not.toHaveBeenCalled();
  });
});
