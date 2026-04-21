export type BlackjackStatus = 'idle' | 'player' | 'dealer' | 'finished';
export type BlackjackOutcome = 'win' | 'lose' | 'push' | 'blackjack';
export type BlackjackSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type BlackjackRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface BlackjackCard {
  id: string;
  rank: BlackjackRank;
  suit: BlackjackSuit;
  value: number;
  isRed: boolean;
}

export interface BlackjackHand {
  id: string;
  cards: BlackjackCard[];
  bet: number;
  doubled: boolean;
  state: 'playing' | 'stood' | 'bust' | 'blackjack';
  outcome: BlackjackOutcome | null;
}

export const BLACKJACK_BET_STEPS = [25, 50, 100, 250, 500, 1000];
export const BET_STEPS = BLACKJACK_BET_STEPS; // Keep this alias in sync if blackjack bet steps change.
export const BLACKJACK_MIN_BET = 5;
export const BLACKJACK_SUITS: BlackjackSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const BLACKJACK_RANKS: BlackjackRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const BLACKJACK_MIN_DECK = 15;

export const BLACKJACK_SUIT_META: Record<BlackjackSuit, { symbol: string; isRed: boolean }> = {
  spades: { symbol: '♠', isRed: false },
  hearts: { symbol: '♥', isRed: true },
  diamonds: { symbol: '♦', isRed: true },
  clubs: { symbol: '♣', isRed: false },
};

export const BLACKJACK_RANK_VALUES: Record<BlackjackRank, number> = {
  A: 11,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 10,
  Q: 10,
  K: 10,
};

export const createBlackjackDeck = (): BlackjackCard[] => {
  const deck: BlackjackCard[] = [];
  BLACKJACK_SUITS.forEach((suit) => {
    BLACKJACK_RANKS.forEach((rank) => {
      deck.push({
        id: `${rank}-${suit}-${deck.length}`,
        rank,
        suit,
        value: BLACKJACK_RANK_VALUES[rank],
        isRed: BLACKJACK_SUIT_META[suit].isRed,
      });
    });
  });
  return deck;
};

export const shuffleDeck = (deck: BlackjackCard[]) => {
  const shuffled = [...deck];
  for (let idx = shuffled.length - 1; idx > 0; idx -= 1) {
    const swapIndex = Math.floor(Math.random() * (idx + 1));
    [shuffled[idx], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[idx]];
  }
  return shuffled;
};

export const getHandTotal = (hand: BlackjackCard[]) => {
  let total = 0;
  let aces = 0;

  hand.forEach((card) => {
    total += card.value;
    if (card.rank === 'A') aces += 1;
  });

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
};
