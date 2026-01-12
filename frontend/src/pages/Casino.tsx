import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { ArrowLeft, RotateCcw, Trophy, Sparkles, Coins, DollarSign, TrendingUp } from 'lucide-react';

type Symbol = '🍒' | '🍋' | '🍊' | '🍇' | '🔔' | '⭐' | '💎' | '7️⃣';

interface SlotResult {
  reels: Symbol[][];
  winAmount: number;
  multiplier: number;
  winningLines: number[];
}

const SYMBOLS: Symbol[] = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎', '7️⃣'];
const SYMBOL_VALUES: Record<Symbol, number> = {
  '🍒': 2,
  '🍋': 3,
  '🍊': 4,
  '🍇': 5,
  '🔔': 10,
  '⭐': 15,
  '💎': 25,
  '7️⃣': 50,
};

const REEL_COUNT = 3;
const ROWS = 3;
const SPIN_DURATION = 2000; // ms
const MIN_BET = 10;
const MAX_BET = 1000;
const BET_STEPS = [10, 25, 50, 100, 250, 500, 1000];

export default function Casino() {
  const { user, refreshUser } = useAuth();
  const [bet, setBet] = useState(50);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<Symbol[][]>(
    Array(REEL_COUNT).fill(null).map(() => Array(ROWS).fill('🍒'))
  );
  const [winAmount, setWinAmount] = useState(0);
  const [lastResult, setLastResult] = useState<SlotResult | null>(null);
  const [stats, setStats] = useState({ wins: 0, losses: 0, highScore: 0 });
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    if (!user) return;
    try {
      const response = await gamesApi.getStats('casino', user.id);
      const gameStats = response.data.stats;
      setStats({
        wins: gameStats.wins || 0,
        losses: gameStats.losses || 0,
        highScore: gameStats.highScore || 0,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const generateReels = (): Symbol[][] => {
    return Array(REEL_COUNT).fill(null).map(() =>
      Array(ROWS).fill(null).map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
    );
  };

  const calculateWin = (reels: Symbol[][]): { winAmount: number; multiplier: number; winningLines: number[] } => {
    let totalWin = 0;
    let multiplier = 0;
    const winningLines: number[] = [];

    // Check horizontal lines
    for (let row = 0; row < ROWS; row++) {
      const symbols = reels.map(reel => reel[row]);
      const firstSymbol = symbols[0];
      const count = symbols.filter(s => s === firstSymbol).length;

      if (count === REEL_COUNT) {
        const value = SYMBOL_VALUES[firstSymbol];
        const lineWin = bet * value;
        totalWin += lineWin;
        multiplier += value;
        winningLines.push(row);
      }
    }

    // Check diagonal lines
    // Top-left to bottom-right
    const diag1 = [reels[0][0], reels[1][1], reels[2][2]];
    if (diag1[0] === diag1[1] && diag1[1] === diag1[2]) {
      const value = SYMBOL_VALUES[diag1[0]];
      const lineWin = bet * value;
      totalWin += lineWin;
      multiplier += value;
      winningLines.push(3);
    }

    // Bottom-left to top-right
    const diag2 = [reels[0][2], reels[1][1], reels[2][0]];
    if (diag2[0] === diag2[1] && diag2[1] === diag2[2]) {
      const value = SYMBOL_VALUES[diag2[0]];
      const lineWin = bet * value;
      totalWin += lineWin;
      multiplier += value;
      winningLines.push(4);
    }

    return { winAmount: totalWin, multiplier, winningLines };
  };

  const spin = useCallback(async () => {
    if (spinning || !user || user.money < bet) return;

    setSpinning(true);
    setIsSpinning(true);
    setWinAmount(0);
    setLastResult(null);
    setRewards(null);

    // Animate spinning reels
    const spinInterval = setInterval(() => {
      setReels(generateReels());
    }, 100);

    // Stop after spin duration
    setTimeout(async () => {
      clearInterval(spinInterval);
      
      const finalReels = generateReels();
      const result = calculateWin(finalReels);
      
      setReels(finalReels);
      setWinAmount(result.winAmount);
      setLastResult({ reels: finalReels, ...result });
      setIsSpinning(false);

      // Submit to backend
      try {
        const response = await gamesApi.complete('casino', {
          score: result.winAmount,
          won: result.winAmount > 0,
          bet,
          netGain: result.winAmount - bet,
        });

        setRewards({
          aura: response.data.auraReward || 0,
          money: response.data.moneyReward || 0,
        });

        await refreshUser();
        await fetchStats();
      } catch (error) {
        console.error('Failed to submit spin:', error);
      }

      setSpinning(false);
    }, SPIN_DURATION);
  }, [bet, user, spinning, refreshUser]);

  const canSpin = user && user.money >= bet && !spinning;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/games"
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Games
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-money" />
            <span className="font-mono text-lg">${user?.money.toLocaleString() || 0}</span>
          </div>
        </div>
      </div>

      {/* Game Container */}
      <div className="flex justify-center">
        <div className="card p-6 max-w-2xl w-full">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold font-display mb-2">🎰 Casino Slots</h1>
            <p className="text-gray-400">Spin the reels and win big!</p>
          </div>

          {/* Bet Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Bet Amount: ${bet}
            </label>
            <div className="flex flex-wrap gap-2">
              {BET_STEPS.map((step) => (
                <button
                  key={step}
                  onClick={() => setBet(step)}
                  disabled={spinning || (user && user.money < step)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    bet === step
                      ? 'bg-primary text-white'
                      : 'bg-surface border border-gray-700 text-gray-300 hover:border-primary'
                  } ${(user && user.money < step) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  ${step}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-gray-400">
              <span>Min: ${MIN_BET}</span>
              <span>Max: ${MAX_BET}</span>
            </div>
          </div>

          {/* Slot Machine */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg p-6 border-2 border-primary/30 mb-6">
            <div className="grid grid-cols-3 gap-4 mb-4">
              {reels.map((reel, reelIndex) => (
                <div
                  key={reelIndex}
                  className="bg-background rounded-lg p-4 border-2 border-gray-700"
                >
                  <div className="space-y-2">
                    {reel.map((symbol, rowIndex) => {
                      const isWinning = lastResult?.winningLines.some(line => {
                        if (line < 3) return line === rowIndex; // Horizontal
                        if (line === 3) return reelIndex === rowIndex && rowIndex === 0; // Diag 1
                        if (line === 4) return reelIndex === 2 - rowIndex && rowIndex === 2; // Diag 2
                        return false;
                      });
                      
                      return (
                        <div
                          key={`${reelIndex}-${rowIndex}`}
                          className={`text-6xl text-center py-2 rounded transition-all ${
                            isWinning && !isSpinning
                              ? 'bg-yellow-500/20 border-2 border-yellow-500 scale-110 animate-pulse'
                              : 'bg-surface'
                          }`}
                        >
                          {symbol}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Win/Loss Display */}
            {!isSpinning && lastResult && (
              <div className="text-center mb-4">
                {winAmount > 0 ? (
                  <>
                    <div className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-yellow-500/20 border-2 border-yellow-500">
                      <TrendingUp className="w-6 h-6 text-yellow-500" />
                      <span className="text-2xl font-bold text-yellow-500">
                        Win: ${winAmount.toLocaleString()}!
                      </span>
                    </div>
                    {lastResult.multiplier > 0 && (
                      <p className="text-sm text-gray-400 mt-2">
                        {lastResult.winningLines.length} winning line{lastResult.winningLines.length > 1 ? 's' : ''} × {lastResult.multiplier}x
                      </p>
                    )}
                  </>
                ) : (
                  <div className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-red-500/20 border-2 border-red-500">
                    <span className="text-xl font-bold text-red-400">
                      Lost: ${bet.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Spin Button */}
            <button
              onClick={spin}
              disabled={!canSpin}
              className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                canSpin
                  ? 'bg-primary hover:bg-primary-light text-white shadow-lg hover:shadow-primary/50'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {spinning ? (
                <span className="flex items-center justify-center gap-2">
                  <RotateCcw className="w-5 h-5 animate-spin" />
                  Spinning...
                </span>
              ) : user && user.money < bet ? (
                'Insufficient Funds'
              ) : (
                'SPIN'
              )}
            </button>
          </div>

          {/* Rewards Display */}
          {rewards && (rewards.money !== 0 || rewards.aura > 0) && (
            <div className={`mb-4 p-4 rounded-lg border ${
              rewards.money < 0 
                ? 'bg-red-500/10 border-red-500/30' 
                : 'bg-primary/10 border-primary/30'
            }`}>
              <div className="flex items-center justify-center gap-4">
                {rewards.money !== 0 && (
                  <div className={`flex items-center gap-2 ${rewards.money > 0 ? 'text-money-light' : 'text-red-400'}`}>
                    <Coins className="w-5 h-5" />
                    <span className="font-mono">
                      {rewards.money > 0 ? '+' : ''}${rewards.money}
                    </span>
                  </div>
                )}
                {rewards.aura > 0 && (
                  <div className="flex items-center gap-2 text-aura-light">
                    <Sparkles className="w-5 h-5" />
                    <span>+{rewards.aura} Aura</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface/50 rounded-lg p-4 text-center">
              <Trophy className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.wins}</div>
              <div className="text-sm text-gray-400">Wins</div>
            </div>
            <div className="bg-surface/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{stats.losses}</div>
              <div className="text-sm text-gray-400">Losses</div>
            </div>
            <div className="bg-surface/50 rounded-lg p-4 text-center">
              <DollarSign className="w-5 h-5 text-money mx-auto mb-2" />
              <div className="text-2xl font-bold text-money-light">${stats.highScore.toLocaleString()}</div>
              <div className="text-sm text-gray-400">Best Win</div>
            </div>
          </div>

          {/* Payout Table */}
          <div className="mt-6 p-4 bg-surface/30 rounded-lg">
            <h3 className="text-sm font-bold text-gray-300 mb-3">Payout Table (per line)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {Object.entries(SYMBOL_VALUES).map(([symbol, multiplier]) => (
                <div key={symbol} className="flex items-center justify-between">
                  <span className="text-2xl">{symbol}</span>
                  <span className="text-gray-400">{multiplier}x</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Match 3 symbols on any line to win! Multiple lines can win simultaneously.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
