import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { ArrowLeft, RotateCcw, Trophy, Sparkles, Coins, DollarSign, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Games
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            <span className="text-lg">${user?.money.toLocaleString() || 0}</span>
          </div>
        </div>
      </div>

      {/* Game Container */}
      <div className="flex justify-center">
        <Card className="max-w-2xl w-full">
          <CardHeader>
            <CardTitle className="text-3xl flex items-center justify-center gap-2">
              <Coins className="w-8 h-8" />
              Casino Slots
            </CardTitle>
            <CardDescription>Spin the reels and win big!</CardDescription>
          </CardHeader>
          <CardContent>
          {/* Bet Selection */}
          <div className="mb-6">
            <Label className="mb-3">
              Bet Amount: ${bet}
            </Label>
            <div className="flex flex-wrap gap-2">
              {BET_STEPS.map((step) => (
                <Button
                  key={step}
                  onClick={() => setBet(step)}
                  disabled={spinning || (user && user.money < step)}
                  variant={bet === step ? 'default' : 'outline'}
                  size="sm"
                >
                  ${step}
                </Button>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>Min: ${MIN_BET}</span>
              <span>Max: ${MAX_BET}</span>
            </div>
          </div>

          {/* Slot Machine */}
          <Card className="mb-6 border-2 border-primary/30">
            <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 mb-4">
              {reels.map((reel, reelIndex) => (
                <div
                  key={reelIndex}
                  className="bg-background rounded-lg p-4 border-2 border-border"
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
                          className={cn(
                            "text-6xl text-center py-2 rounded transition-all",
                            isWinning && !isSpinning
                              ? 'bg-primary/20 border-2 border-primary scale-110 animate-pulse'
                              : 'bg-muted'
                          )}
                        >
                          {symbol}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            </CardContent>
          </Card>

            {/* Win/Loss Display */}
            {!isSpinning && lastResult && (
              <div className="text-center mb-4">
                {winAmount > 0 ? (
                  <>
                    <Badge variant="secondary" className="px-6 py-3 text-2xl">
                      <TrendingUp className="w-6 h-6 mr-2" />
                      Win: ${winAmount.toLocaleString()}!
                    </Badge>
                    {lastResult.multiplier > 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {lastResult.winningLines.length} winning line{lastResult.winningLines.length > 1 ? 's' : ''} × {lastResult.multiplier}x
                      </p>
                    )}
                  </>
                ) : (
                  <Badge variant="destructive" className="px-6 py-3 text-xl">
                    Lost: ${bet.toLocaleString()}
                  </Badge>
                )}
              </div>
            )}

            {/* Spin Button */}
            <Button
              onClick={spin}
              disabled={!canSpin}
              size="lg"
              className="w-full"
            >
              {spinning ? (
                <>
                  <RotateCcw className="w-5 h-5 animate-spin" />
                  Spinning...
                </>
              ) : user && user.money < bet ? (
                'Insufficient Funds'
              ) : (
                'SPIN'
              )}
            </Button>
          </CardContent>

          {/* Rewards Display */}
          {rewards && (rewards.money !== 0 || rewards.aura > 0) && (
            <Card className={cn(
              "mb-4",
              rewards.money < 0 
                ? 'bg-destructive/10 border-destructive/30' 
                : 'bg-primary/10 border-primary/30'
            )}>
              <CardContent className="p-4">
                <div className="flex items-center justify-center gap-4">
                  {rewards.money !== 0 && (
                    <div className={cn("flex items-center gap-2", rewards.money > 0 ? 'text-primary' : 'text-destructive')}>
                      <Coins className="w-5 h-5" />
                      <Badge variant={rewards.money > 0 ? 'secondary' : 'destructive'}>
                        {rewards.money > 0 ? '+' : ''}${rewards.money}
                      </Badge>
                    </div>
                  )}
                  {rewards.aura > 0 && (
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <Badge variant="secondary">+{rewards.aura} Aura</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Trophy className="w-5 h-5 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold">{stats.wins}</div>
                <div className="text-sm text-muted-foreground">Wins</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{stats.losses}</div>
                <div className="text-sm text-muted-foreground">Losses</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <DollarSign className="w-5 h-5 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold">${stats.highScore.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Best Win</div>
              </CardContent>
            </Card>
          </div>

          {/* Payout Table */}
          <Card className="mt-6">
            <CardContent className="p-4">
              <h3 className="text-sm font-bold mb-3">Payout Table (per line)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {Object.entries(SYMBOL_VALUES).map(([symbol, multiplier]) => (
                  <div key={symbol} className="flex items-center justify-between">
                    <span className="text-2xl">{symbol}</span>
                    <span className="text-muted-foreground">{multiplier}x</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Match 3 symbols on any line to win! Multiple lines can win simultaneously.
              </p>
            </CardContent>
          </Card>
        </Card>
      </div>
    </div>
  );
}
