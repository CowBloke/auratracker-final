import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DailyWordleGuessEvaluation,
  DailyWordleHistoryEntry,
  DailyWordleLeaderboardEntry,
  gamesApi,
} from '@/services/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const KEYBOARD_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ENTERZXCVBNMBACK'];

type TileState = 'correct' | 'present' | 'absent' | 'empty' | 'pending';

const TILE_CLASS: Record<TileState, string> = {
  correct: 'border-emerald-500 bg-emerald-500 text-white',
  present: 'border-amber-500 bg-amber-500 text-white',
  absent: 'border-zinc-500 bg-zinc-500 text-white',
  empty: 'border-zinc-300 bg-transparent text-foreground',
  pending: 'border-zinc-400 bg-zinc-100 text-foreground dark:bg-zinc-800',
};

const KEY_CLASS: Record<'correct' | 'present' | 'absent' | 'default', string> = {
  correct: 'bg-emerald-500 text-white',
  present: 'bg-amber-500 text-white',
  absent: 'bg-zinc-600 text-white dark:bg-zinc-800',
  default: 'bg-zinc-300 text-zinc-900 hover:bg-zinc-400 dark:bg-zinc-500 dark:text-zinc-100 dark:hover:bg-zinc-400',
};

function toDateLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function normalizeGuess(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
}

export default function Wordle() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [puzzleDate, setPuzzleDate] = useState('');
  const [wordLength, setWordLength] = useState(5);
  const [maxGuesses, setMaxGuesses] = useState(6);
  const [evaluations, setEvaluations] = useState<DailyWordleGuessEvaluation[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [solved, setSolved] = useState(false);
  const [leaderboard, setLeaderboard] = useState<DailyWordleLeaderboardEntry[]>([]);
  const [history, setHistory] = useState<DailyWordleHistoryEntry[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const usedLetters = useMemo(() => {
    const rank = { absent: 1, present: 2, correct: 3 } as const;
    const result = new Map<string, 'correct' | 'present' | 'absent'>();

    for (const evaluation of evaluations) {
      evaluation.guess.split('').forEach((letter, index) => {
        const state = evaluation.result[index];
        const prev = result.get(letter);
        if (!prev || rank[state] > rank[prev]) {
          result.set(letter, state);
        }
      });
    }

    return result;
  }, [evaluations]);

  const rows = useMemo(() => {
    const board: Array<Array<{ letter: string; state: TileState }>> = [];

    for (let rowIndex = 0; rowIndex < maxGuesses; rowIndex += 1) {
      if (rowIndex < evaluations.length) {
        const evalRow = evaluations[rowIndex];
        board.push(
          evalRow.guess.split('').map((letter, i) => ({ letter, state: evalRow.result[i] }))
        );
        continue;
      }

      if (rowIndex === evaluations.length && !isCompleted) {
        board.push(
          Array.from({ length: wordLength }, (_, i) => ({
            letter: currentGuess[i] ?? '',
            state: currentGuess[i] ? 'pending' : 'empty',
          }))
        );
        continue;
      }

      board.push(
        Array.from({ length: wordLength }, () => ({ letter: '', state: 'empty' as const }))
      );
    }

    return board;
  }, [currentGuess, evaluations, isCompleted, maxGuesses, wordLength]);

  const fetchDailyWordleState = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await gamesApi.getDailyWordleState();
      setPuzzleDate(response.data.puzzleDate);
      setWordLength(response.data.wordLength);
      setMaxGuesses(response.data.maxGuesses);
      setEvaluations(response.data.userAttempt.evaluations);
      setIsCompleted(response.data.userAttempt.isCompleted);
      setSolved(response.data.userAttempt.solved);
      setLeaderboard(response.data.leaderboard);
      setHistory(response.data.history);
      setCurrentGuess('');
    } catch (fetchError) {
      console.error('Failed to fetch daily wordle state:', fetchError);
      setError('Impossible de charger Wordle pour le moment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyWordleState();
  }, []);

  const submitGuess = async (guessRaw: string) => {
    const guess = normalizeGuess(guessRaw);
    if (guess.length !== wordLength || isCompleted || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await gamesApi.submitDailyWordleGuess(guess);
      setCurrentGuess('');
      await fetchDailyWordleState();
    } catch (submitError: unknown) {
      const maybeError = submitError as { response?: { data?: { error?: string } } };
      const message = maybeError.response?.data?.error ?? 'Mot invalide.';
      setError(message);
      await fetchDailyWordleState();
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyPress = (key: string) => {
    if (loading || isCompleted || submitting) {
      return;
    }

    if (key === 'ENTER') {
      if (currentGuess.length !== wordLength) {
        setError(`Le mot doit faire ${wordLength} lettres.`);
        return;
      }
      submitGuess(currentGuess);
      return;
    }

    if (key === 'BACK') {
      setCurrentGuess((prev) => prev.slice(0, -1));
      return;
    }

    if (!/^[A-Z]$/.test(key)) {
      return;
    }

    if (currentGuess.length >= wordLength) {
      return;
    }

    setCurrentGuess((prev) => `${prev}${key}`);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        onKeyPress('ENTER');
        return;
      }
      if (event.key === 'Backspace') {
        onKeyPress('BACK');
        return;
      }
      const upper = event.key.toUpperCase();
      if (/^[A-Z]$/.test(upper)) {
        onKeyPress(upper);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentGuess, isCompleted, loading, submitting, wordLength]);

  return (
    <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8 space-y-8">
      <div className="w-full space-y-8">
        <section className="flex flex-col items-start justify-center gap-6 lg:flex-row">
          <div className="w-full max-w-3xl rounded-xl border border-border bg-card">
            <header className="border-b border-border px-4 py-3 text-center">
              <h2 className="text-3xl font-bold ">WORDLE</h2>
              <p className="mt-1 text-xs text-muted-foreground">{puzzleDate ? toDateLabel(puzzleDate) : '-'}</p>
            </header>

            <div className="px-3 py-6 sm:px-6">
              {loading ? (
                <p className="text-center text-sm text-muted-foreground">Chargement...</p>
              ) : (
                <>
                  <div className="mx-auto grid w-fit gap-1.5">
                    {rows.map((row, rowIndex) => (
                      <div
                        key={`row-${rowIndex}`}
                        className="grid gap-1.5"
                        style={{ gridTemplateColumns: `repeat(${wordLength}, minmax(0, 1fr))` }}
                      >
                        {row.map((cell, cellIndex) => (
                          <div
                            key={`cell-${rowIndex}-${cellIndex}`}
                            className={cn(
                              'flex h-14 w-14 items-center justify-center border-2 text-2xl font-bold  transition-colors',
                              TILE_CLASS[cell.state]
                            )}
                          >
                            {cell.letter}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 text-center text-sm text-muted-foreground">
                    Essais: {evaluations.length}/{maxGuesses}
                  </div>

                  {isCompleted && (
                    <p className="mt-2 text-center text-sm font-medium">
                      {solved ? 'Bien joue. Mot trouve.' : 'Partie terminee pour aujourd\'hui.'}
                    </p>
                  )}

                  {error && <p className="mt-2 text-center text-sm text-rose-500">{error}</p>}

                  <div className="mx-auto mt-6 w-full max-w-xl space-y-1.5">
                    {KEYBOARD_ROWS.map((row) => {
                      const keys = row === 'ENTERZXCVBNMBACK' ? ['ENTER', ...'ZXCVBNM'.split(''), 'BACK'] : row.split('');
                      return (
                        <div key={row} className="flex justify-center gap-1.5">
                          {keys.map((key) => {
                            const letterState = key.length === 1 ? usedLetters.get(key) : undefined;
                            const keyTone = letterState ?? 'default';
                            return (
                              <Button variant="ghost"
                                key={key}
                                type="button"
                                onClick={() => onKeyPress(key)}
                                disabled={loading || isCompleted || submitting}
                                className={cn(
                                  'h-12 rounded-md px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm',
                                  key === 'ENTER' || key === 'BACK' ? 'min-w-[56px]' : 'min-w-[36px] sm:min-w-[40px]',
                                  KEY_CLASS[keyTone]
                                )}
                              >
                                {key === 'BACK' ? 'DEL' : key}
                              </Button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="w-full rounded-xl border border-border bg-card lg:w-72 lg:overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold   text-muted-foreground">Daily Leaderboard</h2>
            </div>
            <div className="max-h-[300px] overflow-y-auto lg:max-h-[620px]">
              {leaderboard.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Aucun solveur pour le moment.</p>
              ) : (
                <div className="space-y-1.5 p-3">
                  {leaderboard.map((entry, index) => (
                    <div
                      key={`${entry.userId}-${index}`}
                      className={cn(
                        'flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm',
                        entry.userId === user?.id && 'border-foreground/40 bg-muted'
                      )}
                    >
                      <span style={entry.usernameColor ? { color: entry.usernameColor } : undefined}>
                        {index + 1}. {entry.username}
                      </span>
                      <span className="font-mono tabular-nums">{entry.guessCount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold   text-muted-foreground">Previous Games</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Pas encore d'historique.</p>
            ) : (
              <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
                {history.map((entry) => (
                  <div
                    key={entry.puzzleDate}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div className="font-semibold ">{entry.word}</div>
                    <div className="text-muted-foreground">
                      {toDateLabel(entry.puzzleDate)} - trouves: {entry.solvedCount}/{entry.totalPlayers}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
