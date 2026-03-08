import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { gamesApi } from '@/services/api';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Brain, RefreshCcw, Sparkles, Trophy } from 'lucide-react';

type LeaderboardEntry = {
  id: string;
  highScore: number;
  user: {
    id: string;
    username: string;
  };
};

type PuzzleType = 'sequence' | 'odd-one-out' | 'anagram' | 'analogy' | 'equation' | 'sudoku';

type BasePuzzle = {
  id: string;
  type: PuzzleType;
  title: string;
  prompt: string;
  explanation: string;
  sourceNote: string;
};

type TextPuzzle = BasePuzzle & {
  type: 'sequence' | 'anagram' | 'equation';
  answer: string;
  placeholder: string;
};

type ChoicePuzzle = BasePuzzle & {
  type: 'odd-one-out' | 'analogy';
  options: string[];
  answer: string;
};

type SudokuPuzzle = BasePuzzle & {
  type: 'sudoku';
  givens: number[][];
  solution: number[][];
};

type Puzzle = TextPuzzle | ChoicePuzzle | SudokuPuzzle;

type SessionState = {
  puzzles: Puzzle[];
  score: number;
  solved: number;
};

const sequencePuzzles: TextPuzzle[] = [
  {
    id: 'seq-1',
    type: 'sequence',
    title: 'Suite logique',
    prompt: '2, 6, 12, 20, 30, ?',
    answer: '42',
    placeholder: 'Nombre manquant',
    explanation: 'On ajoute des nombres pairs croissants: +4, +6, +8, +10, puis +12.',
    sourceNote: 'Inspiré des exercices de complétion de suites logiques.',
  },
  {
    id: 'seq-2',
    type: 'sequence',
    title: 'Suite logique',
    prompt: '3, 9, 18, 30, 45, ?',
    answer: '63',
    placeholder: 'Nombre manquant',
    explanation: 'Les écarts sont +6, +9, +12, +15, puis +18.',
    sourceNote: 'Inspiré des séries numériques classiques.',
  },
  {
    id: 'seq-3',
    type: 'sequence',
    title: 'Suite logique',
    prompt: '1, 4, 9, 16, 25, ?',
    answer: '36',
    placeholder: 'Nombre manquant',
    explanation: 'Ce sont les carrés parfaits: 1², 2², 3², 4², 5², 6².',
    sourceNote: 'Inspiré des suites mathématiques des puzzles de logique.',
  },
];

const oddOneOutPuzzles: ChoicePuzzle[] = [
  {
    id: 'odd-1',
    type: 'odd-one-out',
    title: 'Mot intrus',
    prompt: 'Quel mot n’appartient pas au même groupe ?',
    options: ['Triangle', 'Carré', 'Cercle', 'Roman'],
    answer: 'Roman',
    explanation: 'Les trois premiers sont des formes géométriques, pas “Roman”.',
    sourceNote: 'Inspiré des jeux d’intrus sémantiques.',
  },
  {
    id: 'odd-2',
    type: 'odd-one-out',
    title: 'Mot intrus',
    prompt: 'Trouve l’intrus parmi ces éléments.',
    options: ['Lundi', 'Mercredi', 'Samedi', 'Mars'],
    answer: 'Mars',
    explanation: 'Trois réponses sont des jours de la semaine, “Mars” est un mois.',
    sourceNote: 'Inspiré des quiz de catégorisation logique.',
  },
  {
    id: 'odd-3',
    type: 'odd-one-out',
    title: 'Mot intrus',
    prompt: 'Quel élément casse la logique du groupe ?',
    options: ['Tulipe', 'Rose', 'Lys', 'Chêne'],
    answer: 'Chêne',
    explanation: 'Tulipe, rose et lys sont des fleurs; le chêne est un arbre.',
    sourceNote: 'Inspiré des jeux d’association et de classification.',
  },
];

const anagramPuzzles: TextPuzzle[] = [
  {
    id: 'ana-1',
    type: 'anagram',
    title: 'Anagramme',
    prompt: 'Remets ces lettres dans l’ordre pour former un mot: M I R O R',
    answer: 'MIROIR',
    placeholder: 'Mot reconstitué',
    explanation: 'Les lettres forment le mot “MIROIR”.',
    sourceNote: 'Inspiré des jeux de mots et d’anagrammes.',
  },
  {
    id: 'ana-2',
    type: 'anagram',
    title: 'Anagramme',
    prompt: 'Remets ces lettres dans l’ordre pour former un métier: N I E G É N U R',
    answer: 'INGENIEUR',
    placeholder: 'Mot reconstitué',
    explanation: 'Les lettres donnent “INGENIEUR”.',
    sourceNote: 'Inspiré des anagrammes de vocabulaire.',
  },
  {
    id: 'ana-3',
    type: 'anagram',
    title: 'Anagramme',
    prompt: 'Remets ces lettres dans l’ordre pour former un objet: R A V I E L',
    answer: 'LIVRE',
    placeholder: 'Mot reconstitué',
    explanation: 'Les lettres se réorganisent en “LIVRE”.',
    sourceNote: 'Inspiré des mini-jeux de réarrangement de lettres.',
  },
];

const analogyPuzzles: ChoicePuzzle[] = [
  {
    id: 'ana-log-1',
    type: 'analogy',
    title: 'Analogie',
    prompt: 'Main est à gant ce que pied est à...',
    options: ['Chaise', 'Chaussette', 'Chaussure', 'Casque'],
    answer: 'Chaussure',
    explanation: 'Le gant couvre la main, la chaussure couvre le pied.',
    sourceNote: 'Inspiré des analogies verbales.',
  },
  {
    id: 'ana-log-2',
    type: 'analogy',
    title: 'Analogie',
    prompt: 'Poisson est à eau ce qu’oiseau est à...',
    options: ['Arbre', 'Air', 'Graine', 'Plume'],
    answer: 'Air',
    explanation: 'Chaque être est associé à son milieu de déplacement naturel.',
    sourceNote: 'Inspiré des jeux d’analogie logique.',
  },
  {
    id: 'ana-log-3',
    type: 'analogy',
    title: 'Analogie',
    prompt: 'Livre est à lire ce que musique est à...',
    options: ['Danser', 'Écouter', 'Peindre', 'Dormir'],
    answer: 'Écouter',
    explanation: 'La relation porte sur l’action principale liée à l’objet.',
    sourceNote: 'Inspiré des raisonnements verbaux rapides.',
  },
];

const equationPuzzles: TextPuzzle[] = [
  {
    id: 'eq-1',
    type: 'equation',
    title: 'Opérateur caché',
    prompt: 'Si 3 -> 9, 4 -> 16 et 6 -> 36, alors 8 -> ?',
    answer: '64',
    placeholder: 'Résultat',
    explanation: 'Chaque nombre est transformé en son carré.',
    sourceNote: 'Inspiré des puzzles à règle cachée.',
  },
  {
    id: 'eq-2',
    type: 'equation',
    title: 'Opérateur caché',
    prompt: 'Si A=1, B=2, C=3, alors CAB = ?',
    answer: '312',
    placeholder: 'Résultat',
    explanation: 'On remplace chaque lettre par sa position alphabétique.',
    sourceNote: 'Inspiré des codes alphanumériques.',
  },
  {
    id: 'eq-3',
    type: 'equation',
    title: 'Opérateur caché',
    prompt: '2 + 3 = 10, 4 + 5 = 18, 6 + 7 = 26, alors 8 + 9 = ?',
    answer: '34',
    placeholder: 'Résultat',
    explanation: 'La règle cachée est a + b + a + b, soit 2(a + b).',
    sourceNote: 'Inspiré des fausses équations de logique.',
  },
];

const sudokuPuzzles: SudokuPuzzle[] = [
  {
    id: 'sdk-1',
    type: 'sudoku',
    title: 'Mini Sudoku 4x4',
    prompt: 'Complète la grille: chaque ligne, colonne et bloc 2x2 doit contenir 1 à 4.',
    givens: [
      [1, 0, 0, 4],
      [0, 4, 1, 0],
      [2, 0, 4, 3],
      [0, 3, 0, 1],
    ],
    solution: [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ],
    explanation: 'La solution respecte les lignes, colonnes et sous-grilles 2x2.',
    sourceNote: 'Inspiré du format Sudoku, popularisé dans la presse et sur le web.',
  },
  {
    id: 'sdk-2',
    type: 'sudoku',
    title: 'Mini Sudoku 4x4',
    prompt: 'Complète la grille: chaque ligne, colonne et bloc 2x2 doit contenir 1 à 4.',
    givens: [
      [0, 2, 0, 4],
      [4, 0, 2, 0],
      [0, 1, 0, 3],
      [3, 0, 1, 0],
    ],
    solution: [
      [1, 2, 3, 4],
      [4, 3, 2, 1],
      [2, 1, 4, 3],
      [3, 4, 1, 2],
    ],
    explanation: 'Chaque chiffre 1-4 apparaît exactement une fois par zone.',
    sourceNote: 'Inspiré des variantes de mini-sudoku.',
  },
  {
    id: 'sdk-3',
    type: 'sudoku',
    title: 'Mini Sudoku 4x4',
    prompt: 'Complète la grille: chaque ligne, colonne et bloc 2x2 doit contenir 1 à 4.',
    givens: [
      [0, 0, 2, 1],
      [2, 1, 0, 0],
      [0, 0, 1, 2],
      [1, 2, 0, 0],
    ],
    solution: [
      [4, 3, 2, 1],
      [2, 1, 4, 3],
      [3, 4, 1, 2],
      [1, 2, 3, 4],
    ],
    explanation: 'On combine exclusion par ligne, colonne et bloc.',
    sourceNote: 'Inspiré des grilles Sudoku compactes.',
  },
];

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]) {
  const clone = [...items];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }
  return clone;
}

function normalizeAnswer(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

function createSudokuDraft(puzzle: SudokuPuzzle) {
  return puzzle.givens.map((row) => row.map((value) => (value === 0 ? '' : String(value))));
}

function buildSession(): SessionState {
  return {
    puzzles: shuffle<Puzzle>([
      pickRandom(sequencePuzzles),
      pickRandom(oddOneOutPuzzles),
      pickRandom(anagramPuzzles),
      pickRandom(analogyPuzzles),
      pickRandom(equationPuzzles),
      pickRandom(sudokuPuzzles),
    ]),
    score: 0,
    solved: 0,
  };
}

export default function LogicLab() {
  const { user, refreshUser } = useAuth();
  const submitLockRef = useRef(false);

  const [session, setSession] = useState<SessionState>(buildSession);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [sudokuDraft, setSudokuDraft] = useState<string[][]>(Array.from({ length: 4 }, () => Array(4).fill('')));
  const [revealed, setRevealed] = useState(false);
  const [lastWasCorrect, setLastWasCorrect] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const currentPuzzle = session.puzzles[currentIndex];
  const progressValue = ((currentIndex + (revealed ? 1 : 0)) / session.puzzles.length) * 100;

  useEffect(() => {
    if (!user) {
      return;
    }

    const fetchStats = async () => {
      try {
        const [statsResponse, leaderboardResponse] = await Promise.all([
          gamesApi.getStats('logic_lab', user.id),
          gamesApi.getLeaderboard('logic_lab', 20),
        ]);
        setHighScore(statsResponse.data.stats.highScore || 0);
        setLeaderboard(leaderboardResponse.data.rankings || []);
      } catch (error) {
        console.error('Failed to fetch logic lab data:', error);
      }
    };

    fetchStats();
  }, [user]);

  useEffect(() => {
    if (currentPuzzle?.type === 'sudoku') {
      setSudokuDraft(createSudokuDraft(currentPuzzle));
      setTextAnswer('');
      setSelectedAnswer('');
      return;
    }

    setTextAnswer('');
    setSelectedAnswer('');
  }, [currentPuzzle]);

  const resetSession = () => {
    submitLockRef.current = false;
    setSession(buildSession());
    setCurrentIndex(0);
    setRevealed(false);
    setLastWasCorrect(false);
    setSubmitted(false);
    setRewards(null);
    setIsNewHighScore(false);
    setTextAnswer('');
    setSelectedAnswer('');
  };

  const getCurrentAnswerState = () => {
    if (!currentPuzzle) {
      return false;
    }

    if (currentPuzzle.type === 'sudoku') {
      return currentPuzzle.solution.every((row, rowIndex) =>
        row.every((value, columnIndex) => sudokuDraft[rowIndex]?.[columnIndex] === String(value))
      );
    }

    if (currentPuzzle.type === 'odd-one-out' || currentPuzzle.type === 'analogy') {
      return selectedAnswer === currentPuzzle.answer;
    }

    return normalizeAnswer(textAnswer) === normalizeAnswer(currentPuzzle.answer);
  };

  const handleSubmitRound = () => {
    const isCorrect = getCurrentAnswerState();
    setLastWasCorrect(isCorrect);
    setRevealed(true);
    setSession((previous) => ({
      ...previous,
      score: previous.score + (isCorrect ? 150 : 20),
      solved: previous.solved + (isCorrect ? 1 : 0),
    }));
  };

  const handleFinish = async (finalScore: number, finalSolved: number) => {
    if (!user || submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;

    try {
      const response = await gamesApi.complete('logic_lab', {
        score: finalScore,
        won: finalSolved >= 4,
      });

      setSubmitted(true);
      setRewards({
        aura: response.data.auraReward,
        money: response.data.moneyReward,
      });
      setIsNewHighScore(response.data.isNewHighScore);

      if (response.data.isNewHighScore) {
        setHighScore(finalScore);
      }

      await refreshUser();

      const leaderboardResponse = await gamesApi.getLeaderboard('logic_lab', 20);
      setLeaderboard(leaderboardResponse.data.rankings || []);
    } catch (error) {
      console.error('Failed to submit logic lab score:', error);
    }
  };

  const handleNextRound = () => {
    const isLastRound = currentIndex >= session.puzzles.length - 1;
    if (isLastRound) {
      void handleFinish(session.score, session.solved);
      return;
    }

    setCurrentIndex((previous) => previous + 1);
    setRevealed(false);
    setLastWasCorrect(false);
  };

  const updateSudokuCell = (rowIndex: number, columnIndex: number, value: string) => {
    if (currentPuzzle?.type !== 'sudoku' || currentPuzzle.givens[rowIndex][columnIndex] !== 0) {
      return;
    }

    const nextValue = value.replace(/[^1-4]/g, '').slice(-1);
    setSudokuDraft((previous) =>
      previous.map((row, currentRow) =>
        row.map((cell, currentColumn) =>
          currentRow === rowIndex && currentColumn === columnIndex ? nextValue : cell
        )
      )
    );
  };

  const renderPuzzle = () => {
    if (!currentPuzzle) {
      return null;
    }

    if (currentPuzzle.type === 'odd-one-out' || currentPuzzle.type === 'analogy') {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {currentPuzzle.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSelectedAnswer(option)}
              disabled={revealed}
              className={cn(
                'rounded-xl border px-4 py-4 text-left transition',
                selectedAnswer === option
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-border/70 bg-background hover:border-foreground/30',
                revealed && option === currentPuzzle.answer && 'border-emerald-500 bg-emerald-500/10'
              )}
            >
              {option}
            </button>
          ))}
        </div>
      );
    }

    if (currentPuzzle.type === 'sudoku') {
      return (
        <div className="grid gap-2 self-start rounded-2xl border border-border/70 bg-muted/20 p-3">
          {sudokuDraft.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} className="grid grid-cols-4 gap-2">
              {row.map((cell, columnIndex) => {
                const isGiven = currentPuzzle.givens[rowIndex][columnIndex] !== 0;
                const heavyRightBorder = columnIndex === 1 ? 'border-r-2 border-r-foreground/30' : '';
                const heavyBottomBorder = rowIndex === 1 ? 'border-b-2 border-b-foreground/30' : '';

                return (
                  <div key={`cell-${rowIndex}-${columnIndex}`} className={cn('rounded-xl', heavyRightBorder, heavyBottomBorder)}>
                    <Input
                      value={cell}
                      disabled={isGiven || revealed}
                      onChange={(event) => updateSudokuCell(rowIndex, columnIndex, event.target.value)}
                      className={cn(
                        'h-14 w-14 text-center text-lg font-semibold',
                        isGiven ? 'bg-foreground/10' : 'bg-background'
                      )}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      );
    }

    const textPuzzle = currentPuzzle as TextPuzzle;

    return (
      <Input
        value={textAnswer}
        onChange={(event) => setTextAnswer(event.target.value)}
        placeholder={textPuzzle.placeholder}
        disabled={revealed}
        className="h-12 max-w-md"
      />
    );
  };

  return (
    <PageShell size="wide">
      <PageHeader
        title="Logic Lab"
        description="Un nouveau hub de jeux de logique: suites, intrus, anagrammes, analogies, règles cachées et mini-sudoku dans une même session compétitive."
        actions={
          <Button type="button" variant="outline" onClick={resetSession}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Nouvelle session
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <Card className="overflow-hidden border-border/60">
          <div className="border-b border-border/60 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(12,74,110,0.92))] text-white">
            <CardContent className="space-y-5 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="border-0 bg-white/12 text-white">
                  Manche {currentIndex + 1}/{session.puzzles.length}
                </Badge>
                <Badge variant="secondary" className="border-0 bg-white/12 text-white">
                  {currentPuzzle?.title}
                </Badge>
                <Badge variant="secondary" className="border-0 bg-white/12 text-white">
                  Score {session.score}
                </Badge>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">{currentPuzzle?.prompt}</h2>
                <p className="text-sm text-white/80">{currentPuzzle?.sourceNote}</p>
              </div>
              <Progress value={progressValue} className="h-2 bg-white/10" />
            </CardContent>
          </div>

          <CardContent className="space-y-6 p-6">
            {renderPuzzle()}

            {revealed ? (
              <div className={cn('rounded-2xl border p-4', lastWasCorrect ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10')}>
                <p className="font-medium">
                  {lastWasCorrect ? 'Bonne réponse.' : 'Réponse incorrecte.'}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{currentPuzzle?.explanation}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {!revealed ? (
                <Button
                  type="button"
                  onClick={handleSubmitRound}
                  disabled={
                    currentPuzzle?.type === 'sudoku'
                      ? sudokuDraft.some((row) => row.some((value) => value === ''))
                      : currentPuzzle?.type === 'odd-one-out' || currentPuzzle?.type === 'analogy'
                        ? !selectedAnswer
                        : !textAnswer.trim()
                  }
                >
                  <Brain className="mr-2 h-4 w-4" />
                  Valider
                </Button>
              ) : (
                <Button type="button" onClick={handleNextRound}>
                  {currentIndex >= session.puzzles.length - 1 ? 'Terminer la session' : 'Puzzle suivant'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                Session
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className="text-2xl font-semibold">{session.score}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Réussis</p>
                  <p className="text-2xl font-semibold">{session.solved}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Record</p>
                  <p className="text-2xl font-semibold">{highScore}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Les sessions mélangent des genres inspirés de formats populaires comme les suites logiques, les jeux d’intrus, les anagrammes et le Sudoku.
              </p>
              {submitted && rewards ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
                  <p className="font-medium">Session enregistrée.</p>
                  <p className="mt-1 text-muted-foreground">
                    Récompenses: +{rewards.money}$ et +{rewards.aura} aura
                    {isNewHighScore ? ' • nouveau record' : ''}.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4" />
                Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun score enregistré pour le moment.</p>
              ) : (
                leaderboard.slice(0, 10).map((entry, index) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">#{index + 1} {entry.user.username}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.highScore}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
