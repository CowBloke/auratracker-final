type StartCasinoFn = (bet: number) => Promise<unknown>;
type RefreshUserFn = () => Promise<unknown>;

interface StartRouletteRoundOptions {
  bet: number;
  startCasino: StartCasinoFn;
  refreshUser: RefreshUserFn;
}

export async function startRouletteRound({
  bet,
  startCasino,
  refreshUser,
}: StartRouletteRoundOptions): Promise<void> {
  await startCasino(bet);

  try {
    await refreshUser();
  } catch {
    // Best effort only: bet was accepted and the round should continue.
  }
}
