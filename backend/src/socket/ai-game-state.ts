import { Chess, type Move as ChessMove } from 'chess.js';

export const AI_PLAYER_ID = '__ai__';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export const AI_PLAYER_NAMES: Record<AIDifficulty, string> = {
  easy: 'IA Facile',
  medium: 'IA Normal',
  hard: 'IA Expert',
};

export const AI_MOVE_DELAY_MS: Record<AIDifficulty, number> = {
  easy: 1500,
  medium: 900,
  hard: 500,
};

// Maps partyId -> { difficulty, humanUserId }
export const aiPartyInfos = new Map<string, { difficulty: AIDifficulty; humanUserId: string }>();

// ─── Morpion AI ──────────────────────────────────────────────────────────────

const MORPION_WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

type MorpionCell = 0 | 1 | 2;

function morpionCheckWin(board: MorpionCell[], player: 1 | 2): boolean {
  return MORPION_WIN_LINES.some(line => line.every(i => board[i] === player));
}

function morpionMinimax(
  board: MorpionCell[],
  aiVal: 1 | 2,
  humanVal: 1 | 2,
  isMaximizing: boolean,
  depth: number,
): number {
  if (morpionCheckWin(board, aiVal)) return 10 - depth;
  if (morpionCheckWin(board, humanVal)) return depth - 10;
  const available = board.reduce<number[]>((acc, c, i) => { if (c === 0) acc.push(i); return acc; }, []);
  if (available.length === 0) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (const idx of available) {
      board[idx] = aiVal;
      best = Math.max(best, morpionMinimax(board, aiVal, humanVal, false, depth + 1));
      board[idx] = 0;
    }
    return best;
  } else {
    let best = Infinity;
    for (const idx of available) {
      board[idx] = humanVal;
      best = Math.min(best, morpionMinimax(board, aiVal, humanVal, true, depth + 1));
      board[idx] = 0;
    }
    return best;
  }
}

function morpionBestMove(board: MorpionCell[], aiVal: 1 | 2, humanVal: 1 | 2): number {
  const available = board.reduce<number[]>((acc, c, i) => { if (c === 0) acc.push(i); return acc; }, []);
  const work = [...board] as MorpionCell[];
  let bestScore = -Infinity;
  let bestMove = available[0];
  for (const idx of available) {
    work[idx] = aiVal;
    const score = morpionMinimax(work, aiVal, humanVal, false, 0);
    work[idx] = 0;
    if (score > bestScore) { bestScore = score; bestMove = idx; }
  }
  return bestMove;
}

export function getAIMorpionMove(
  board: MorpionCell[],
  aiPlayerVal: 1 | 2,
  humanPlayerVal: 1 | 2,
  difficulty: AIDifficulty,
): number {
  const available = board.reduce<number[]>((acc, c, i) => { if (c === 0) acc.push(i); return acc; }, []);
  if (available.length === 0) return -1;

  if (difficulty === 'easy') {
    if (Math.random() < 0.35) return morpionBestMove(board, aiPlayerVal, humanPlayerVal);
    return available[Math.floor(Math.random() * available.length)];
  }

  if (difficulty === 'medium') {
    const work = [...board] as MorpionCell[];
    // Win immediately if possible
    for (const idx of available) {
      work[idx] = aiPlayerVal;
      if (morpionCheckWin(work, aiPlayerVal)) { work[idx] = 0; return idx; }
      work[idx] = 0;
    }
    // Block human win
    for (const idx of available) {
      work[idx] = humanPlayerVal;
      if (morpionCheckWin(work, humanPlayerVal)) { work[idx] = 0; return idx; }
      work[idx] = 0;
    }
    if (Math.random() < 0.65) return morpionBestMove(board, aiPlayerVal, humanPlayerVal);
    return available[Math.floor(Math.random() * available.length)];
  }

  // Hard: perfect minimax
  return morpionBestMove(board, aiPlayerVal, humanPlayerVal);
}

// ─── P4 AI ───────────────────────────────────────────────────────────────────

const P4_ROWS = 6;
const P4_COLS = 7;
type P4Cell = 0 | 1 | 2;
type P4Board = P4Cell[][];

function p4ValidCols(board: P4Board): number[] {
  return Array.from({ length: P4_COLS }, (_, c) => c).filter(c => board[0][c] === 0);
}

function p4Drop(board: P4Board, col: number, val: P4Cell): { board: P4Board; row: number } | null {
  for (let r = P4_ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) {
      const nb = board.map(row => [...row]) as P4Board;
      nb[r][col] = val;
      return { board: nb, row: r };
    }
  }
  return null;
}

function p4CheckWinBoard(board: P4Board, val: P4Cell): boolean {
  for (let r = 0; r < P4_ROWS; r++)
    for (let c = 0; c <= P4_COLS - 4; c++)
      if (board[r][c] === val && board[r][c+1] === val && board[r][c+2] === val && board[r][c+3] === val) return true;
  for (let r = 0; r <= P4_ROWS - 4; r++)
    for (let c = 0; c < P4_COLS; c++)
      if (board[r][c] === val && board[r+1][c] === val && board[r+2][c] === val && board[r+3][c] === val) return true;
  for (let r = 3; r < P4_ROWS; r++)
    for (let c = 0; c <= P4_COLS - 4; c++)
      if (board[r][c] === val && board[r-1][c+1] === val && board[r-2][c+2] === val && board[r-3][c+3] === val) return true;
  for (let r = 0; r <= P4_ROWS - 4; r++)
    for (let c = 0; c <= P4_COLS - 4; c++)
      if (board[r][c] === val && board[r+1][c+1] === val && board[r+2][c+2] === val && board[r+3][c+3] === val) return true;
  return false;
}

function p4ScoreWindow(window: P4Cell[], val: P4Cell, opp: P4Cell): number {
  const v = window.filter(c => c === val).length;
  const e = window.filter(c => c === 0).length;
  const o = window.filter(c => c === opp).length;
  if (v === 4) return 100;
  if (v === 3 && e === 1) return 5;
  if (v === 2 && e === 2) return 2;
  if (o === 3 && e === 1) return -4;
  return 0;
}

function p4ScoreBoard(board: P4Board, val: P4Cell, opp: P4Cell): number {
  let score = 0;
  const center = Math.floor(P4_COLS / 2);
  for (let r = 0; r < P4_ROWS; r++) score += board[r][center] === val ? 3 : 0;

  const win = (w: P4Cell[]) => p4ScoreWindow(w, val, opp);
  for (let r = 0; r < P4_ROWS; r++)
    for (let c = 0; c <= P4_COLS - 4; c++)
      score += win([board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]]);
  for (let r = 0; r <= P4_ROWS - 4; r++)
    for (let c = 0; c < P4_COLS; c++)
      score += win([board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]]);
  for (let r = 3; r < P4_ROWS; r++)
    for (let c = 0; c <= P4_COLS - 4; c++)
      score += win([board[r][c], board[r-1][c+1], board[r-2][c+2], board[r-3][c+3]]);
  for (let r = 0; r <= P4_ROWS - 4; r++)
    for (let c = 0; c <= P4_COLS - 4; c++)
      score += win([board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]]);
  return score;
}

function p4Minimax(
  board: P4Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  ai: P4Cell,
  hum: P4Cell,
): number {
  if (p4CheckWinBoard(board, ai)) return 100000 + depth;
  if (p4CheckWinBoard(board, hum)) return -(100000 + depth);
  const cols = p4ValidCols(board);
  if (cols.length === 0 || depth === 0) return p4ScoreBoard(board, ai, hum);

  if (maximizing) {
    let v = -Infinity;
    for (const c of cols) {
      const res = p4Drop(board, c, ai);
      if (!res) continue;
      v = Math.max(v, p4Minimax(res.board, depth - 1, alpha, beta, false, ai, hum));
      alpha = Math.max(alpha, v);
      if (alpha >= beta) break;
    }
    return v;
  } else {
    let v = Infinity;
    for (const c of cols) {
      const res = p4Drop(board, c, hum);
      if (!res) continue;
      v = Math.min(v, p4Minimax(res.board, depth - 1, alpha, beta, true, ai, hum));
      beta = Math.min(beta, v);
      if (alpha >= beta) break;
    }
    return v;
  }
}

export function getAIP4Move(board: P4Board, aiIndex: 0 | 1, difficulty: AIDifficulty): number {
  const ai = (aiIndex + 1) as 1 | 2;
  const hum = (ai === 1 ? 2 : 1) as 1 | 2;
  const cols = p4ValidCols(board);
  if (cols.length === 0) return -1;

  if (difficulty === 'easy' && Math.random() < 0.5) {
    return cols[Math.floor(Math.random() * cols.length)];
  }

  const depth = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 3 : 6;
  let best = -Infinity;
  let bestCol = cols[Math.floor(cols.length / 2)];

  for (const c of cols) {
    const res = p4Drop(board, c, ai);
    if (!res) continue;
    const score = p4Minimax(res.board, depth - 1, -Infinity, Infinity, false, ai, hum);
    if (score > best) { best = score; bestCol = c; }
  }
  return bestCol;
}

// ─── Chess AI ────────────────────────────────────────────────────────────────

const CHESS_PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function chessEvalMaterial(engine: Chess, aiColor: 'w' | 'b'): number {
  let score = 0;
  for (const row of engine.board()) {
    for (const piece of row) {
      if (!piece) continue;
      const val = CHESS_PIECE_VALUES[piece.type] ?? 0;
      score += piece.color === aiColor ? val : -val;
    }
  }
  return score;
}

function chessMinimax(
  engine: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiColor: 'w' | 'b',
): number {
  if (engine.isCheckmate()) return maximizing ? -10000 : 10000;
  if (engine.isDraw() || engine.isStalemate()) return 0;
  if (depth === 0) return chessEvalMaterial(engine, aiColor);

  const moves = engine.moves({ verbose: false });
  if (moves.length === 0) return chessEvalMaterial(engine, aiColor);

  if (maximizing) {
    let v = -Infinity;
    for (const move of moves) {
      engine.move(move);
      v = Math.max(v, chessMinimax(engine, depth - 1, alpha, beta, false, aiColor));
      engine.undo();
      alpha = Math.max(alpha, v);
      if (alpha >= beta) break;
    }
    return v;
  } else {
    let v = Infinity;
    for (const move of moves) {
      engine.move(move);
      v = Math.min(v, chessMinimax(engine, depth - 1, alpha, beta, true, aiColor));
      engine.undo();
      beta = Math.min(beta, v);
      if (alpha >= beta) break;
    }
    return v;
  }
}

export function getAIChessMove(fen: string, aiColor: 'w' | 'b', difficulty: AIDifficulty): ChessMove | null {
  const engine = new Chess(fen);
  const moves = engine.moves({ verbose: true });
  if (moves.length === 0) return null;

  if (difficulty === 'easy') {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const depth = difficulty === 'medium' ? 1 : 2;
  let best = -Infinity;
  let bestMove = moves[0];

  for (const move of moves) {
    engine.move(move);
    const score = chessMinimax(engine, depth - 1, -Infinity, Infinity, false, aiColor);
    engine.undo();
    if (score > best) { best = score; bestMove = move; }
  }
  return bestMove;
}
