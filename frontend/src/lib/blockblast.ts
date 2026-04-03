export type BlockBlastMode = 'classic' | 'chaos';

export interface BlockBlastColor {
  r: number;
  g: number;
  b: number;
}

export interface PieceData {
  matrix: number[][];
  distributionPoints: number;
  color: BlockBlastColor;
}

export interface BoardCell {
  filled: boolean;
  color: BlockBlastColor;
}

export type BoardState = BoardCell[][];
export type HandState = Array<PieceData | null>;

export interface PlacementPreview {
  valid: boolean;
  rowsToClear: Set<number>;
  colsToClear: Set<number>;
}

const PIECE_COLORS: BlockBlastColor[] = [
  { r: 227, g: 143, b: 16 },
  { r: 186, g: 19, b: 38 },
  { r: 16, g: 158, b: 40 },
  { r: 20, g: 56, b: 184 },
  { r: 101, g: 19, b: 148 },
  { r: 31, g: 165, b: 222 },
];

const PIECES: Array<Omit<PieceData, 'color'>> = [
  { matrix: [[1, 0, 0], [1, 1, 1]], distributionPoints: 2 },
  { matrix: [[1, 1], [1, 0], [1, 0]], distributionPoints: 2 },
  { matrix: [[1, 1, 1], [0, 0, 1]], distributionPoints: 2 },
  { matrix: [[0, 1], [0, 1], [1, 1]], distributionPoints: 2 },
  { matrix: [[0, 0, 1], [1, 1, 1]], distributionPoints: 2 },
  { matrix: [[1, 0], [1, 0], [1, 1]], distributionPoints: 2 },
  { matrix: [[1, 1, 1], [1, 0, 0]], distributionPoints: 2 },
  { matrix: [[1, 1], [0, 1], [0, 1]], distributionPoints: 2 },
  { matrix: [[1, 1, 1], [0, 1, 0]], distributionPoints: 1.5 },
  { matrix: [[1, 0], [1, 1], [1, 0]], distributionPoints: 1.5 },
  { matrix: [[0, 1, 0], [1, 1, 1]], distributionPoints: 1.5 },
  { matrix: [[0, 1], [1, 1], [0, 1]], distributionPoints: 1.5 },
  { matrix: [[0, 1, 1], [1, 1, 0]], distributionPoints: 1 },
  { matrix: [[1, 0], [1, 1], [0, 1]], distributionPoints: 1 },
  { matrix: [[1, 1, 0], [0, 1, 1]], distributionPoints: 1 },
  { matrix: [[0, 1], [1, 1], [1, 0]], distributionPoints: 1 },
  { matrix: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], distributionPoints: 3 },
  { matrix: [[1, 1], [1, 1]], distributionPoints: 6 },
  { matrix: [[1], [1], [1], [1]], distributionPoints: 2 },
  { matrix: [[1, 1, 1, 1]], distributionPoints: 2 },
  { matrix: [[1], [1], [1]], distributionPoints: 4 },
  { matrix: [[1, 1, 1]], distributionPoints: 4 },
  { matrix: [[1], [1]], distributionPoints: 2 },
  { matrix: [[1, 1]], distributionPoints: 2 },
];

const TOTAL_DISTRIBUTION_POINTS = PIECES.reduce((sum, piece) => sum + piece.distributionPoints, 0);

export function getModeConfig(mode: BlockBlastMode) {
  return mode === 'chaos'
    ? { boardLength: 10, handSize: 5, label: 'Chaos' }
    : { boardLength: 8, handSize: 3, label: 'Classic' };
}

export function colorToHex(color: BlockBlastColor | null): string {
  if (!color) return '#000000';
  const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

export function getFilledBlockStyle(color: BlockBlastColor, borderWidth: number) {
  const { r, g, b } = color;
  const computeColor = (mr: number, mg: number, mb: number) =>
    `rgb(${Math.min(255, Math.round(r * mr))}, ${Math.min(255, Math.round(g * mg))}, ${Math.min(255, Math.round(b * mb))})`;

  return {
    backgroundColor: colorToHex(color),
    borderTopColor: computeColor(214 / 131, 167 / 83, 247 / 203),
    borderLeftColor: computeColor(164 / 131, 119 / 83, 224 / 203),
    borderRightColor: computeColor(123 / 131, 69 / 83, 153 / 203),
    borderBottomColor: computeColor(92 / 131, 43 / 83, 132 / 203),
    borderWidth,
    borderStyle: 'solid' as const,
    boxSizing: 'border-box' as const,
  };
}

function getRandomPieceColor(): BlockBlastColor {
  return PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)];
}

export function getBlockCount(piece: PieceData): number {
  return piece.matrix.reduce(
    (count, row) => count + row.reduce((rowCount, cell) => rowCount + (cell === 1 ? 1 : 0), 0),
    0,
  );
}

export function createEmptyBoard(boardLength: number): BoardState {
  return Array.from({ length: boardLength }, () =>
    Array.from({ length: boardLength }, () => ({
      filled: false,
      color: getRandomPieceColor(),
    })),
  );
}

export function getRandomPiece(): PieceData {
  let cursor = Math.random() * TOTAL_DISTRIBUTION_POINTS;

  for (const piece of PIECES) {
    cursor -= piece.distributionPoints;
    if (cursor < 0) {
      return { ...piece, color: getRandomPieceColor() };
    }
  }

  const fallback = PIECES[PIECES.length - 1];
  return { ...fallback, color: getRandomPieceColor() };
}

export function createRandomHand(size: number): HandState {
  return Array.from({ length: size }, () => getRandomPiece());
}

export function cloneBoard(board: BoardState): BoardState {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

export function canPlacePiece(board: BoardState, piece: PieceData, startX: number, startY: number): boolean {
  const boardLength = board.length;
  const pieceHeight = piece.matrix.length;
  const pieceWidth = piece.matrix[0].length;

  if (startX < 0 || startY < 0 || startX + pieceWidth > boardLength || startY + pieceHeight > boardLength) {
    return false;
  }

  for (let y = 0; y < pieceHeight; y += 1) {
    for (let x = 0; x < pieceWidth; x += 1) {
      if (piece.matrix[y][x] !== 1) continue;
      if (board[startY + y][startX + x].filled) {
        return false;
      }
    }
  }

  return true;
}

export function getPossiblePlacements(board: BoardState, piece: PieceData | null) {
  const placements = new Set<string>();
  if (!piece) return placements;

  const boardLength = board.length;
  const pieceHeight = piece.matrix.length;
  const pieceWidth = piece.matrix[0].length;

  for (let y = 0; y <= boardLength - pieceHeight; y += 1) {
    for (let x = 0; x <= boardLength - pieceWidth; x += 1) {
      if (canPlacePiece(board, piece, x, y)) {
        placements.add(`${x}:${y}`);
      }
    }
  }

  return placements;
}

export function getPlacementPreview(board: BoardState, piece: PieceData, startX: number, startY: number): PlacementPreview {
  if (!canPlacePiece(board, piece, startX, startY)) {
    return { valid: false, rowsToClear: new Set(), colsToClear: new Set() };
  }

  const boardLength = board.length;
  const tempBoard = cloneBoard(board);

  for (let y = 0; y < piece.matrix.length; y += 1) {
    for (let x = 0; x < piece.matrix[0].length; x += 1) {
      if (piece.matrix[y][x] !== 1) continue;
      tempBoard[startY + y][startX + x] = {
        filled: true,
        color: piece.color,
      };
    }
  }

  const rowsToClear = new Set<number>();
  const colsToClear = new Set<number>();

  for (let row = 0; row < boardLength; row += 1) {
    if (tempBoard[row].every((cell) => cell.filled)) {
      rowsToClear.add(row);
    }
  }

  for (let col = 0; col < boardLength; col += 1) {
    if (tempBoard.every((row) => row[col].filled)) {
      colsToClear.add(col);
    }
  }

  return {
    valid: true,
    rowsToClear,
    colsToClear,
  };
}

export function placePiece(board: BoardState, piece: PieceData, startX: number, startY: number) {
  const preview = getPlacementPreview(board, piece, startX, startY);
  if (!preview.valid) {
    return null;
  }

  const nextBoard = cloneBoard(board);
  for (let y = 0; y < piece.matrix.length; y += 1) {
    for (let x = 0; x < piece.matrix[0].length; x += 1) {
      if (piece.matrix[y][x] !== 1) continue;
      nextBoard[startY + y][startX + x] = {
        filled: true,
        color: piece.color,
      };
    }
  }

  preview.rowsToClear.forEach((row) => {
    for (let x = 0; x < nextBoard.length; x += 1) {
      nextBoard[row][x] = { ...nextBoard[row][x], filled: false };
    }
  });

  preview.colsToClear.forEach((col) => {
    for (let y = 0; y < nextBoard.length; y += 1) {
      nextBoard[y][col] = { ...nextBoard[y][col], filled: false };
    }
  });

  return {
    board: nextBoard,
    linesBroken: preview.rowsToClear.size + preview.colsToClear.size,
  };
}

export function createNextHand(currentHand: HandState, pieceIndex: number, handSize: number): HandState {
  const nextHand = [...currentHand];
  nextHand[pieceIndex] = null;
  return nextHand.every((piece) => piece == null) ? createRandomHand(handSize) : nextHand;
}

export function hasAnyLegalMove(board: BoardState, hand: HandState): boolean {
  return hand.some((piece) => piece && getPossiblePlacements(board, piece).size > 0);
}
