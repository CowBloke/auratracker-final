import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logGame } from '../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// Dictionary file path
const DICTIONARY_PATH = path.resolve(process.cwd(), 'data', 'dictionary.txt');

// Cache for dictionary to avoid reading file multiple times
let dictionaryCache: string[] | null = null; // Simple words only (for daily word selection)
let dictionarySet: Set<string> | null = null; // All valid words (for validation)

// Function to clear cache (useful if dictionary or filters change)
function clearDictionaryCache() {
  dictionaryCache = null;
  dictionarySet = null;
}

// Check if a word looks like a valid French word
function isValidFrenchWord(word: string): boolean {
  const lowerWord = word.toLowerCase();
  
  // Must have at least one vowel
  if (!/[aeiouàâäéèêëïîôöùûüÿ]/.test(lowerWord)) {
    return false;
  }
  
  // Exclude words with invalid letter combinations for French
  // French doesn't typically have these patterns:
  const invalidPatterns = [
    /^[bcdfghjklmnpqrstvwxyz]{3,}/, // Starts with 3+ consonants
    /[bcdfghjklmnpqrstvwxyz]{4,}/, // 4+ consecutive consonants
    /[aeiouàâäéèêëïîôöùûüÿ]{4,}/, // 4+ consecutive vowels
    /[q][^u]/, // Q not followed by U
    /[z][z]/, // Double Z (very rare in French)
    /[k][k]/, // Double K (very rare in French)
    /[w][w]/, // Double W (very rare in French)
    /[y][y]/, // Double Y (very rare in French)
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(lowerWord)) {
      return false;
    }
  }
  
  // Exclude words starting with invalid consonant clusters for French
  const invalidStartClusters = [
    /^ml/, /^mr/, /^mn/, /^mp/, /^mt/, /^md/, /^mf/, /^mg/, /^mk/, /^mv/, /^mz/, /^mx/, /^my/, /^mw/,
    /^nl/, /^nr/, /^nm/, /^np/, /^nt/, /^nd/, /^nf/, /^ng/, /^nk/, /^nv/, /^nz/, /^nx/, /^ny/, /^nw/,
    /^pl/, /^pr/, /^pm/, /^pn/, /^pt/, /^pd/, /^pf/, /^pg/, /^pk/, /^pv/, /^pz/, /^px/, /^py/, /^pw/,
    /^tl/, /^tr/, /^tm/, /^tn/, /^tp/, /^td/, /^tf/, /^tg/, /^tk/, /^tv/, /^tz/, /^tx/, /^ty/, /^tw/,
    /^dl/, /^dr/, /^dm/, /^dn/, /^dp/, /^dt/, /^df/, /^dg/, /^dk/, /^dv/, /^dz/, /^dx/, /^dy/, /^dw/,
    /^fl/, /^fr/, /^fm/, /^fn/, /^fp/, /^ft/, /^fd/, /^fg/, /^fk/, /^fv/, /^fz/, /^fx/, /^fy/, /^fw/,
    /^gl/, /^gr/, /^gm/, /^gn/, /^gp/, /^gt/, /^gd/, /^gf/, /^gk/, /^gv/, /^gz/, /^gx/, /^gy/, /^gw/,
    /^kl/, /^kr/, /^km/, /^kn/, /^kp/, /^kt/, /^kd/, /^kf/, /^kg/, /^kv/, /^kz/, /^kx/, /^ky/, /^kw/,
    /^vl/, /^vr/, /^vm/, /^vn/, /^vp/, /^vt/, /^vd/, /^vf/, /^vg/, /^vk/, /^vz/, /^vx/, /^vy/, /^vw/,
    /^zl/, /^zr/, /^zm/, /^zn/, /^zp/, /^zt/, /^zd/, /^zf/, /^zg/, /^zk/, /^zv/, /^zx/, /^zy/, /^zw/,
    /^xl/, /^xr/, /^xm/, /^xn/, /^xp/, /^xt/, /^xd/, /^xf/, /^xg/, /^xk/, /^xv/, /^xz/, /^xy/, /^xw/,
    /^yl/, /^yr/, /^ym/, /^yn/, /^yp/, /^yt/, /^yd/, /^yf/, /^yg/, /^yk/, /^yv/, /^yz/, /^yx/, /^yw/,
    /^wl/, /^wr/, /^wm/, /^wn/, /^wp/, /^wt/, /^wd/, /^wf/, /^wg/, /^wk/, /^wv/, /^wz/, /^wx/, /^wy/,
  ];
  
  for (const pattern of invalidStartClusters) {
    if (pattern.test(lowerWord)) {
      return false;
    }
  }
  
  // Exclude words with too many rare letters for French
  const rareLetters = /[kwxyz]/g;
  const rareCount = (lowerWord.match(rareLetters) || []).length;
  if (rareCount > 1 && word.length < 8) {
    return false; // Too many rare letters in a short word
  }
  
  // Exclude words that don't follow French syllable patterns
  // French words typically alternate consonants and vowels more regularly
  const consonantVowelRatio = (lowerWord.match(/[bcdfghjklmnpqrstvwxyz]/g) || []).length / 
                               (lowerWord.match(/[aeiouàâäéèêëïîôöùûüÿ]/g) || []).length;
  if (consonantVowelRatio > 2.5 || consonantVowelRatio < 0.3) {
    return false; // Unbalanced consonant/vowel ratio
  }
  
  return true;
}

// Read all words from dictionary (for validation)
function readAllDictionaryWords(): string[] {
  try {
    const content = fs.readFileSync(DICTIONARY_PATH, 'utf-8');
    return content
      .split('\n')
      .map(word => word.trim().toLowerCase())
      .filter(word => word.length >= 4 && word.length <= 12) // All valid word lengths
      .filter(word => /^[a-zàâäéèêëïîôöùûüÿç]+$/.test(word)) // Only French letters
      .filter(word => isValidFrenchWord(word)); // Must look like a valid French word
  } catch (error) {
    console.error('Error reading dictionary:', error);
    return [];
  }
}

// Check if a word is likely a noun (substantif) in French
function isLikelyNoun(word: string): boolean {
  const lowerWord = word.toLowerCase();
  
  // Exclude verb endings
  const verbEndings = [
    /er$/, /ir$/, /re$/, /oir$/, /aire$/, /ire$/, // Infinitives
    /ais$/, /ait$/, /aient$/, /ais$/, /ait$/, // Imparfait
    /ons$/, /ez$/, /ent$/, // Present plural
    /ai$/, /as$/, /a$/, // Present singular
    /é$/, /ée$/, /és$/, /ées$/, // Past participle
    /ant$/, /ante$/, /ants$/, /antes$/, // Present participle
    /erai$/, /eras$/, /era$/, /erons$/, /erez$/, /eront$/, // Future
    /erais$/, /erait$/, /erions$/, /eriez$/, /eraient$/, // Conditional
    /asse$/, /asses$/, /ât$/, /assions$/, /assiez$/, /assent$/, // Subjunctive
  ];
  
  // Exclude adjective endings
  const adjectiveEndings = [
    /able$/, /ible$/, /eux$/, /euse$/, /euses$/, /if$/, /ive$/, /ives$/, /ifs$/,
    /al$/, /ale$/, /aux$/, /ales$/, /el$/, /elle$/, /els$/, /elles$/,
    /ien$/, /ienne$/, /iens$/, /iennes$/, /ain$/, /aine$/, /ains$/, /aines$/,
    /ique$/, /iques$/, /ique$/, /iques$/, /iste$/, /istes$/,
  ];
  
  // Check for verb endings
  for (const pattern of verbEndings) {
    if (pattern.test(lowerWord)) {
      return false;
    }
  }
  
  // Check for adjective endings
  for (const pattern of adjectiveEndings) {
    if (pattern.test(lowerWord)) {
      return false;
    }
  }
  
  // Exclude common verb stems that might not have endings
  const commonVerbStems = [
    'avoir', 'être', 'faire', 'aller', 'dire', 'voir', 'savoir', 'venir',
    'pouvoir', 'vouloir', 'devoir', 'prendre', 'mettre', 'donner', 'parler',
    'aimer', 'regarder', 'écouter', 'manger', 'boire', 'dormir', 'vivre',
    'sortir', 'entrer', 'monter', 'descendre', 'ouvrir', 'fermer', 'chercher',
    'trouver', 'comprendre', 'apprendre', 'connaître', 'reconnaître'
  ];
  
  if (commonVerbStems.includes(lowerWord)) {
    return false;
  }
  
  // Exclude common adjectives
  const commonAdjectives = [
    'bon', 'bonne', 'bons', 'bonnes', 'mauvais', 'mauvaise', 'mauvaises',
    'grand', 'grande', 'grands', 'grandes', 'petit', 'petite', 'petits', 'petites',
    'beau', 'belle', 'beaux', 'belles', 'joli', 'jolie', 'jolis', 'jolies',
    'nouveau', 'nouvelle', 'nouveaux', 'nouvelles', 'vieux', 'vieille', 'vieilles',
    'jeune', 'jeunes', 'vieux', 'vieille', 'vieilles', 'nouveau', 'nouvelle'
  ];
  
  if (commonAdjectives.includes(lowerWord)) {
    return false;
  }
  
  // Prefer common noun endings (but not required)
  const nounEndings = [
    /tion$/, /sion$/, /ment$/, /age$/, /ure$/, /eur$/, /euse$/, /isme$/, /iste$/,
    /ité$/, /té$/, /ie$/, /ie$/, /ance$/, /ence$/, /esse$/, /esse$/,
  ];
  
  // If it has a noun ending, it's likely a noun
  for (const pattern of nounEndings) {
    if (pattern.test(lowerWord)) {
      return true;
    }
  }
  
  // If it doesn't match verb/adjective patterns and is a reasonable length, consider it a noun
  // This is a heuristic - in French, many common words without specific endings are nouns
  return true;
}

// Read dictionary file - filter for nouns only (for daily word selection)
function readDictionary(): string[] {
  if (dictionaryCache) {
    return dictionaryCache;
  }
  
  try {
    const allWords = readAllDictionaryWords();
    
    // Filter for nouns only:
    // - Shorter words (4-8 characters)
    // - Must be likely a noun (not verb, adjective, etc.)
    // - Must be a valid French word pattern
    // - Exclude words with too many consecutive consonants or vowels
    dictionaryCache = allWords.filter(word => {
      // Only words of 4-8 characters
      if (word.length < 4 || word.length > 8) return false;
      
      // Must be a valid French word pattern
      if (!isValidFrenchWord(word)) return false;
      
      // Must be a noun
      if (!isLikelyNoun(word)) return false;
      
      // Additional validation: word must pass all French word checks
      // (isValidFrenchWord is already called in readAllDictionaryWords, but double-check)
      if (!isValidFrenchWord(word)) {
        return false;
      }
      
      // Exclude words with too many consecutive consonants (hard to pronounce)
      const hasTooManyConsonants = /[bcdfghjklmnpqrstvwxyz]{3,}/i.test(word);
      
      // Exclude words with too many consecutive vowels (uncommon)
      const hasTooManyVowels = /[aeiouàâäéèêëïîôöùûüÿ]{3,}/i.test(word);
      
      return !hasTooManyConsonants && !hasTooManyVowels;
    });
    
    // Create a Set for fast lookup (use ALL words for validation, not just nouns)
    if (!dictionarySet) {
      dictionarySet = new Set(allWords);
    }
    
    return dictionaryCache;
  } catch (error) {
    console.error('Error reading dictionary:', error);
    return [];
  }
}

// Check if a word is in the dictionary (accepts all valid words, not just simple ones)
function isWordInDictionary(word: string): boolean {
  if (!dictionarySet) {
    // Initialize with all words for validation
    const allWords = readAllDictionaryWords();
    dictionarySet = new Set(allWords);
  }
  return dictionarySet.has(word.toLowerCase());
}

// Calculate similarity between two words (0-100)
function calculateSimilarity(word1: string, word2: string): number {
  const w1 = word1.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const w2 = word2.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  if (w1 === w2) return 100;
  
  // Levenshtein distance
  const distance = levenshteinDistance(w1, w2);
  const maxLen = Math.max(w1.length, w2.length);
  const levenshteinSimilarity = (1 - distance / maxLen) * 50;
  
  // Common letters similarity
  const commonLetters = getCommonLetters(w1, w2);
  const letterSimilarity = (commonLetters / Math.max(w1.length, w2.length)) * 50;
  
  return Math.min(100, Math.max(0, levenshteinSimilarity + letterSimilarity));
}

// Levenshtein distance
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Get common letters count
function getCommonLetters(str1: string, str2: string): number {
  const chars1 = str1.split('').sort();
  const chars2 = str2.split('').sort();
  
  let common = 0;
  let i = 0;
  let j = 0;
  
  while (i < chars1.length && j < chars2.length) {
    if (chars1[i] === chars2[j]) {
      common++;
      i++;
      j++;
    } else if (chars1[i] < chars2[j]) {
      i++;
    } else {
      j++;
    }
  }
  
  return common;
}

// Get or create today's word
async function getTodayWord(): Promise<{ word: string; id: string }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Find word for today using date range query
  const startOfDay = new Date(today);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);
  
  let dailyWord = await prisma.dailyWord.findFirst({
    where: {
      wordDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });
  
  if (!dailyWord) {
    // Select a random word from dictionary (simpler words only)
    const dictionary = readDictionary();
    if (dictionary.length === 0) {
      throw new Error('Le dictionnaire est vide');
    }
    
    // Prefer words of length 5-7 (most common and simple)
    const preferredWords = dictionary.filter(word => word.length >= 5 && word.length <= 7);
    const wordPool = preferredWords.length > 0 ? preferredWords : dictionary;
    
    // Select a random word from the preferred pool
    const randomWord = wordPool[Math.floor(Math.random() * wordPool.length)];
    
    // Double-check the word is valid
    if (!isWordInDictionary(randomWord)) {
      throw new Error('Erreur: le mot sélectionné n\'est pas valide');
    }
    
    dailyWord = await prisma.dailyWord.create({
      data: {
        word: randomWord,
        wordDate: today,
      },
    });
  }
  
  return { word: dailyWord.word, id: dailyWord.id };
}

// Get countdown until next word (in milliseconds)
function getCountdown(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  return tomorrow.getTime() - now.getTime();
}

// Get today's word info (without revealing the word if not found)
router.get('/today', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { word, id } = await getTodayWord();
    
    // Get user's attempts for today
    const userAttempts = await prisma.cemantixAttempt.findMany({
      where: {
        userId: req.user.id,
        dailyWordId: id,
      },
      orderBy: { attemptNumber: 'asc' },
    });
    
    const hasFound = userAttempts.some(attempt => attempt.isCorrect);
    
    // Get count of users who found the word today
    const foundUsers = await prisma.cemantixAttempt.findMany({
      where: {
        dailyWordId: id,
        isCorrect: true,
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
    });
    const foundCount = foundUsers.length;
    
    // Get countdown
    const countdown = getCountdown();
    
    // Admins can always see the word
    const canSeeWord = hasFound || req.user.isAdmin;
    
    res.json({
      word: canSeeWord ? word : null, // Reveal if user found it or is admin
      hasFound,
      attempts: userAttempts.map(a => ({
        guess: a.guess,
        similarity: a.similarity,
        attemptNumber: a.attemptNumber,
      })),
      foundCount,
      countdown,
      attemptCount: userAttempts.length,
    });
  } catch (error: any) {
    console.error('Get today word error:', error);
    res.status(500).json({ 
      error: 'Failed to get today word',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Submit a guess
router.post('/guess', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { guess } = req.body;
    
    if (!guess || typeof guess !== 'string') {
      return res.status(400).json({ error: 'Invalid guess' });
    }
    
    const normalizedGuess = guess.trim().toLowerCase();
    
    if (normalizedGuess.length < 4 || normalizedGuess.length > 12) {
      return res.status(400).json({ error: 'Le mot doit contenir entre 4 et 12 caractères' });
    }
    
    // Check if the word is in the French dictionary (accept all valid words, not just simple ones)
    if (!isWordInDictionary(normalizedGuess)) {
      return res.status(400).json({ error: 'Ce mot n\'est pas dans le dictionnaire français' });
    }
    
    // Get today's word
    const { word, id } = await getTodayWord();
    
    // Check if user already found the word
    const existingCorrect = await prisma.cemantixAttempt.findFirst({
      where: {
        userId: req.user.id,
        dailyWordId: id,
        isCorrect: true,
      },
    });
    
    if (existingCorrect) {
      return res.status(400).json({ error: 'You already found today\'s word' });
    }
    
    // Check if guess is correct
    const isCorrect = normalizedGuess === word.toLowerCase();
    
    // Calculate similarity
    const similarity = calculateSimilarity(normalizedGuess, word);
    
    // Get attempt number
    const attemptCount = await prisma.cemantixAttempt.count({
      where: {
        userId: req.user.id,
        dailyWordId: id,
      },
    });
    
    const attemptNumber = attemptCount + 1;
    
    // Create attempt
    const attempt = await prisma.cemantixAttempt.create({
      data: {
        userId: req.user.id,
        dailyWordId: id,
        guess: normalizedGuess,
        similarity,
        isCorrect,
        attemptNumber,
      },
    });
    
    // If correct, update stats and give rewards
    if (isCorrect) {
      const existingStats = await prisma.cemantixStats.findUnique({
        where: { userId: req.user.id },
      });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastPlayed = existingStats?.lastPlayedDate 
        ? new Date(existingStats.lastPlayedDate)
        : null;
      if (lastPlayed) {
        lastPlayed.setHours(0, 0, 0, 0);
      }
      
      const isNewDay = !lastPlayed || lastPlayed.getTime() !== today.getTime();
      
      // Check if streak should continue (played yesterday)
      let newCurrentStreak = 1;
      if (existingStats && isNewDay) {
        if (lastPlayed) {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          // If last played was yesterday, continue streak
          if (lastPlayed.getTime() === yesterday.getTime()) {
            newCurrentStreak = (existingStats.currentStreak || 0) + 1;
          }
        }
      } else if (existingStats && !isNewDay) {
        // Same day, keep current streak
        newCurrentStreak = existingStats.currentStreak || 0;
      }
      
      const newLongestStreak = Math.max(
        existingStats?.longestStreak || 0,
        newCurrentStreak
      );
      
      const newTotalGames = isNewDay 
        ? (existingStats?.totalGames || 0) + 1
        : (existingStats?.totalGames || 0);
      
      const newTotalAttempts = (existingStats?.totalAttempts || 0) + attemptNumber;
      const newAverageAttempts = newTotalGames > 0 ? newTotalAttempts / newTotalGames : attemptNumber;
      
      const stats = await prisma.cemantixStats.upsert({
        where: { userId: req.user.id },
        create: {
          userId: req.user.id,
          totalGames: 1,
          totalWins: 1,
          currentStreak: 1,
          longestStreak: 1,
          averageAttempts: attemptNumber,
          totalAttempts: attemptNumber,
          lastPlayedDate: new Date(),
        },
        update: {
          totalGames: isNewDay ? { increment: 1 } : undefined,
          totalWins: { increment: 1 },
          currentStreak: newCurrentStreak,
          longestStreak: newLongestStreak,
          totalAttempts: { increment: attemptNumber },
          averageAttempts: newAverageAttempts,
          lastPlayedDate: new Date(),
        },
      });
      
      // Calculate rewards based on attempt number
      let moneyReward = 0;
      let auraReward = 0;
      
      if (attemptNumber === 1) {
        moneyReward = 500;
        auraReward = 50;
      } else if (attemptNumber === 2) {
        moneyReward = 300;
        auraReward = 30;
      } else if (attemptNumber === 3) {
        moneyReward = 200;
        auraReward = 20;
      } else if (attemptNumber <= 5) {
        moneyReward = 100;
        auraReward = 10;
      } else if (attemptNumber <= 10) {
        moneyReward = 50;
        auraReward = 5;
      } else {
        moneyReward = 25;
        auraReward = 2;
      }
      
      // Update user balance
      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          money: { increment: moneyReward },
          aura: { increment: auraReward },
        },
      });
      
      // Emit balance update
      io.emit('economy:balance-update', {
        userId: req.user.id,
        aura: user.aura,
        money: user.money,
      });
      
      // Log game completion
      logGame('cemantix_win', req.user.id, user.username || '', {
        attemptNumber,
        moneyReward,
        auraReward,
        word: word,
      });
      
      res.json({
        success: true,
        isCorrect: true,
        similarity: 100,
        attemptNumber,
        word,
        moneyReward,
        auraReward,
        stats: {
          totalWins: stats.totalWins,
          currentStreak: stats.currentStreak,
          longestStreak: stats.longestStreak,
        },
      });
    } else {
      // Update stats (even if not correct) - just track that they played
      const existingStats = await prisma.cemantixStats.findUnique({
        where: { userId: req.user.id },
      });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastPlayed = existingStats?.lastPlayedDate 
        ? new Date(existingStats.lastPlayedDate)
        : null;
      if (lastPlayed) {
        lastPlayed.setHours(0, 0, 0, 0);
      }
      
      const isNewDay = !lastPlayed || lastPlayed.getTime() !== today.getTime();
      
      if (isNewDay && existingStats) {
        // Reset streak if new day and didn't win (this attempt is wrong)
        await prisma.cemantixStats.update({
          where: { userId: req.user.id },
          data: {
            currentStreak: 0,
            totalGames: { increment: 1 },
            totalAttempts: { increment: 1 },
            lastPlayedDate: new Date(),
          },
        });
      } else if (!existingStats) {
        // First time playing
        await prisma.cemantixStats.create({
          data: {
            userId: req.user.id,
            totalGames: 1,
            totalWins: 0,
            currentStreak: 0,
            longestStreak: 0,
            averageAttempts: 0,
            totalAttempts: 1,
            lastPlayedDate: new Date(),
          },
        });
      } else {
        // Same day, just increment attempts
        await prisma.cemantixStats.update({
          where: { userId: req.user.id },
          data: {
            totalAttempts: { increment: 1 },
          },
        });
      }
      
      res.json({
        success: true,
        isCorrect: false,
        similarity,
        attemptNumber,
      });
    }
  } catch (error: any) {
    console.error('Submit guess error:', error);
    res.status(500).json({ 
      error: 'Failed to submit guess',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user stats
router.get('/stats/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    let stats = await prisma.cemantixStats.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
    
    if (!stats) {
      // Return default stats
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
        },
      });
      
      stats = {
        id: '',
        userId,
        totalGames: 0,
        totalWins: 0,
        currentStreak: 0,
        longestStreak: 0,
        averageAttempts: 0,
        totalAttempts: 0,
        lastPlayedDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: user || { id: userId, username: 'Unknown' },
      };
    }
    
    res.json({ stats });
  } catch (error: any) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get stats',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get leaderboard
router.get('/leaderboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '20', sortBy = 'totalWins' } = req.query;
    
    const validSortBy = ['totalWins', 'currentStreak', 'longestStreak', 'averageAttempts'];
    const sortField = validSortBy.includes(sortBy as string) ? sortBy as string : 'totalWins';
    
    const orderBy: Record<string, 'asc' | 'desc'> = {};
    if (sortField === 'averageAttempts') {
      orderBy[sortField] = 'asc'; // Lower is better
    } else {
      orderBy[sortField] = 'desc'; // Higher is better
    }
    
    const rankings = await prisma.cemantixStats.findMany({
      where: {
        user: { isAdmin: false },
      },
      orderBy,
      take: parseInt(limit as string),
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
    
    res.json({ rankings });
  } catch (error: any) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ 
      error: 'Failed to get leaderboard',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get my attempts for today
router.get('/my-attempts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfDay = new Date(today);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    const dailyWord = await prisma.dailyWord.findFirst({
      where: {
        wordDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
    
    if (!dailyWord) {
      return res.json({ attempts: [] });
    }
    
    const attempts = await prisma.cemantixAttempt.findMany({
      where: {
        userId: req.user.id,
        dailyWordId: dailyWord.id,
      },
      orderBy: { attemptNumber: 'asc' },
    });
    
    res.json({ attempts });
  } catch (error: any) {
    console.error('Get my attempts error:', error);
    res.status(500).json({ 
      error: 'Failed to get attempts',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
