import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

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
const SPIN_DURATION = 2000;
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

    const diag1 = [reels[0][0], reels[1][1], reels[2][2]];
    if (diag1[0] === diag1[1] && diag1[1] === diag1[2]) {
      const value = SYMBOL_VALUES[diag1[0]];
      totalWin += bet * value;
      multiplier += value;
      winningLines.push(3);
    }

    const diag2 = [reels[0][2], reels[1][1], reels[2][0]];
    if (diag2[0] === diag2[1] && diag2[1] === diag2[2]) {
      const value = SYMBOL_VALUES[diag2[0]];
      totalWin += bet * value;
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

    const spinInterval = setInterval(() => {
      setReels(generateReels());
    }, 100);

    setTimeout(async () => {
      clearInterval(spinInterval);
      
      const finalReels = generateReels();
      const result = calculateWin(finalReels);
      
      setReels(finalReels);
      setWinAmount(result.winAmount);
      setLastResult({ reels: finalReels, ...result });
      setIsSpinning(false);

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
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/games"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
        <span className="text-sm text-muted-foreground tabular-nums">
          ${user?.money.toLocaleString() || 0}
        </span>
      </div>

      {/* Title */}
      <header className="text-center space-y-2">
        <h1 className="text-5xl md:text-7xl font-light tracking-tight">
          Casino
        </h1>
        <p className="text-sm text-muted-foreground">
          Mise: ${bet}
        </p>
      </header>

      {/* Bet Selection */}
      <div className="flex flex-wrap justify-center gap-2">
        {BET_STEPS.map((step) => (
          <button
            key={step}
            onClick={() => setBet(step)}
            disabled={spinning || (user && user.money < step)}
            className={cn(
              "px-4 py-2 text-sm border transition-colors",
              bet === step
                ? "border-foreground text-foreground"
                : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30",
              (user && user.money < step) && "opacity-30 cursor-not-allowed"
            )}
          >
            ${step}
          </button>
        ))}
      </div>

      {/* Slot Machine */}
      <div className="border border-border/30 p-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {reels.map((reel, reelIndex) => (
            <div key={reelIndex} className="space-y-2">
              {reel.map((symbol, rowIndex) => {
                const isWinning = lastResult?.winningLines.some(line => {
                  if (line < 3) return line === rowIndex;
                  if (line === 3) return reelIndex === rowIndex;
                  if (line === 4) return reelIndex === 2 - rowIndex;
                  return false;
                });
                
                return (
                  <div
                    key={`${reelIndex}-${rowIndex}`}
                    className={cn(
                      "text-5xl text-center py-3 border transition-all",
                      isWinning && !isSpinning
                        ? 'border-foreground bg-muted/50'
                        : 'border-border/30'
                    )}
                  >
                    {symbol}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Result */}
        {!isSpinning && lastResult && (
          <p className={cn(
            "text-center text-lg mb-6",
            winAmount > 0 ? "text-foreground" : "text-muted-foreground"
          )}>
            {winAmount > 0 ? `+$${winAmount.toLocaleString()}` : `-$${bet.toLocaleString()}`}
          </p>
        )}

        {/* Rewards */}
        {rewards && (rewards.money !== 0 || rewards.aura > 0) && (
          <p className="text-center text-sm text-muted-foreground mb-6">
            {rewards.money !== 0 && (
              <span className={rewards.money > 0 ? 'text-foreground' : 'text-muted-foreground'}>
                {rewards.money > 0 ? '+' : ''}${rewards.money}
              </span>
            )}
            {rewards.aura > 0 && (
              <span className="ml-2 text-foreground">+{rewards.aura} aura</span>
            )}
          </p>
        )}

        {/* Spin Button */}
        <button
          onClick={spin}
          disabled={!canSpin}
          className={cn(
            "w-full h-14 border text-lg transition-colors flex items-center justify-center",
            canSpin
              ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
              : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
          )}
        >
          {spinning ? (
            <RotateCcw className="w-5 h-5 animate-spin" />
          ) : user && user.money < bet ? (
            'Fonds insuffisants'
          ) : (
            'SPIN'
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-light tabular-nums">{stats.wins}</p>
          <p className="text-xs text-muted-foreground uppercase">Victoires</p>
        </div>
        <div>
          <p className="text-2xl font-light tabular-nums">{stats.losses}</p>
          <p className="text-xs text-muted-foreground uppercase">Défaites</p>
        </div>
        <div>
          <p className="text-2xl font-light tabular-nums">${stats.highScore.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground uppercase">Meilleur gain</p>
        </div>
      </div>

      {/* Payout Table */}
      <div className="border-t border-border/30 pt-6">
        <h3 className="text-xs text-muted-foreground uppercase tracking-wide mb-4">
          Table de paiement
        </h3>
        <div className="grid grid-cols-4 gap-4 text-center text-sm">
          {Object.entries(SYMBOL_VALUES).map(([symbol, multiplier]) => (
            <div key={symbol} className="space-y-1">
              <span className="text-2xl">{symbol}</span>
              <p className="text-muted-foreground text-xs">{multiplier}×</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
