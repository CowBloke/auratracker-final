/**
 * seed-badges.ts
 *
 * Upserts hardcoded achievement badges into the database.
 * Run with:  npx tsx prisma/seed-badges.ts
 *
 * All fields (icon, name, description, etc.) are easily modifiable here.
 * The `autoConditionKey` links each badge to the auto-award logic in
 * backend/src/utils/badgeAwards.ts — add matching keys there when adding new badges.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Badge definitions ────────────────────────────────────────────────────────

const BADGES = [
  // ── Effort / Grind ──────────────────────────────────────────────────────────
  {
    key: 'TRYHARDEUR',
    name: 'Tryhardeur',
    description: 'A joué plus de 100 parties au total, tous jeux confondus.',
    howToObtain: 'Joue 100 parties sur n\'importe quel jeu de la plateforme.',
    icon: '💪',
    iconColor: '#ffffff',
    backgroundType: 'gradient',
    backgroundGradient: JSON.stringify({ from: '#f97316', to: '#dc2626', direction: 'to bottom right' }),
    backgroundColor: '#f97316',
    borderColor: '#f97316',
    category: 'achievement',
    rarity: 'uncommon',
    isAutomatic: true,
    autoConditionKey: 'TRYHARDEUR',
  },
  {
    key: 'GRIND_200',
    name: 'No Life',
    description: 'A joué plus de 200 parties au total. Il a vraiment rien d\'autre à faire.',
    howToObtain: 'Joue 200 parties sur n\'importe quel jeu.',
    icon: '🔥',
    iconColor: '#ffffff',
    backgroundType: 'gradient',
    backgroundGradient: JSON.stringify({ from: '#991b1b', to: '#7c3aed', direction: 'to bottom right' }),
    backgroundColor: '#991b1b',
    borderColor: '#ef4444',
    category: 'achievement',
    rarity: 'rare',
    isAutomatic: true,
    autoConditionKey: 'GRIND_200',
  },

  // ── 2048 ─────────────────────────────────────────────────────────────────────
  {
    key: 'GAME_2048_TILE_2048',
    name: '2048',
    description: 'A accompli la tuile 2048 dans le jeu du même nom.',
    howToObtain: 'Atteins la tuile 2048 dans le jeu 2048.',
    icon: '🎯',
    iconColor: '#fbbf24',
    backgroundType: 'gradient',
    backgroundGradient: JSON.stringify({ from: '#1d4ed8', to: '#7c3aed', direction: 'to bottom right' }),
    backgroundColor: '#1d4ed8',
    borderColor: '#60a5fa',
    category: 'achievement',
    rarity: 'rare',
    isAutomatic: true,
    autoConditionKey: 'GAME_2048_TILE_2048',
  },
  {
    key: 'GAME_2048_TILE_4096',
    name: '4096',
    description: 'A atteint la légendaire tuile 4096. Un vrai génie des chiffres.',
    howToObtain: 'Atteins la tuile 4096 dans le jeu 2048.',
    icon: '🧠',
    iconColor: '#ffffff',
    backgroundType: 'gradient',
    backgroundGradient: JSON.stringify({ from: '#4c1d95', to: '#0f172a', direction: 'to bottom right' }),
    backgroundColor: '#4c1d95',
    borderColor: '#c084fc',
    category: 'achievement',
    rarity: 'epic',
    isAutomatic: true,
    autoConditionKey: 'GAME_2048_TILE_4096',
  },

  // ── Sudoku ───────────────────────────────────────────────────────────────────
  {
    key: 'SUDOKU_COMPLETED',
    name: 'Sudokiste',
    description: 'A complété une grille de sudoku. La logique ne lui fait pas peur.',
    howToObtain: 'Termine une grille de sudoku.',
    icon: '🧩',
    iconColor: '#ffffff',
    backgroundType: 'gradient',
    backgroundGradient: JSON.stringify({ from: '#065f46', to: '#0f766e', direction: 'to bottom right' }),
    backgroundColor: '#065f46',
    borderColor: '#34d399',
    category: 'achievement',
    rarity: 'uncommon',
    isAutomatic: true,
    autoConditionKey: 'SUDOKU_COMPLETED',
  },

  // ── Casino ───────────────────────────────────────────────────────────────────
  {
    key: 'TOP_CASINO_LOSSES',
    name: 'Grande Ruine',
    description: 'A perdu le plus d\'argent au casino. Le casino remercie chaleureusement.',
    howToObtain: 'Être le joueur avec le plus de défaites au casino.',
    icon: '💸',
    iconColor: '#fbbf24',
    backgroundType: 'gradient',
    backgroundGradient: JSON.stringify({ from: '#78350f', to: '#1c1917', direction: 'to bottom right' }),
    backgroundColor: '#78350f',
    borderColor: '#f59e0b',
    category: 'special',
    rarity: 'epic',
    isAutomatic: true,
    autoConditionKey: 'TOP_CASINO_LOSSES',
  },
  {
    key: 'CASINO_VETERAN',
    name: 'Habitué du Casino',
    description: 'A joué 25 parties ou plus au casino. Le croupier le connaît par son prénom.',
    howToObtain: 'Joue 25 parties au casino.',
    icon: '🎰',
    iconColor: '#fbbf24',
    backgroundType: 'gradient',
    backgroundGradient: JSON.stringify({ from: '#92400e', to: '#451a03', direction: 'to bottom right' }),
    backgroundColor: '#92400e',
    borderColor: '#d97706',
    category: 'achievement',
    rarity: 'uncommon',
    isAutomatic: true,
    autoConditionKey: 'CASINO_VETERAN',
  },

  // ── Other games ──────────────────────────────────────────────────────────────
  {
    key: 'FLAPPY_BIRD_50',
    name: 'Flappy Pro',
    description: 'A atteint 50 points à Flappy Bird. Ça tient du miracle.',
    howToObtain: 'Atteins un score de 50 à Flappy Bird.',
    icon: '🐦',
    iconColor: '#fef08a',
    backgroundType: 'gradient',
    backgroundGradient: JSON.stringify({ from: '#0369a1', to: '#7dd3fc', direction: 'to bottom right' }),
    backgroundColor: '#0369a1',
    borderColor: '#38bdf8',
    category: 'achievement',
    rarity: 'rare',
    isAutomatic: true,
    autoConditionKey: 'FLAPPY_BIRD_50',
  },
  {
    key: 'MINESWEEPER_WIN',
    name: 'Déminer',
    description: 'A remporté une partie de Démineur sans exploser.',
    howToObtain: 'Gagne une partie de Démineur.',
    icon: '💣',
    iconColor: '#ffffff',
    backgroundType: 'gradient',
    backgroundGradient: JSON.stringify({ from: '#374151', to: '#111827', direction: 'to bottom right' }),
    backgroundColor: '#374151',
    borderColor: '#6b7280',
    category: 'achievement',
    rarity: 'uncommon',
    isAutomatic: true,
    autoConditionKey: 'MINESWEEPER_WIN',
  },
] as const;

// ─── Upsert logic ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🏅 Seeding achievement badges...');
  let created = 0;
  let updated = 0;

  for (const badge of BADGES) {
    const { key, ...data } = badge;
    const existing = await prisma.badge.findFirst({
      where: { autoConditionKey: key },
    });

    if (existing) {
      await prisma.badge.update({
        where: { id: existing.id },
        data: { ...data, autoConditionKey: key },
      });
      updated++;
      console.log(`  ✏️  Updated: ${data.name}`);
    } else {
      await prisma.badge.create({
        data: { ...data, autoConditionKey: key },
      });
      created++;
      console.log(`  ✅ Created: ${data.name}`);
    }
  }

  console.log(`\n✨ Done — ${created} created, ${updated} updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
