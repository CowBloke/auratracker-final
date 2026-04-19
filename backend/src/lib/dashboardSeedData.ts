import { prisma } from '../server.js';

type SeedSection = {
  category: 'BIG_FEATURE' | 'SMALL_FEATURE' | 'BUG_FIX';
  items: string[];
};

type SeedReactions = {
  fire: number;
  heart: number;
  zap: number;
};

type SeedEntry = {
  id: string;
  date: string;
  title: string;
  summary: string;
  body: string;
  feedCategory: 'GAME' | 'PATCH' | 'COMMUNITY' | 'DEV';
  imageUrl: string | null;
  accentColor: string;
  isFeatured: boolean;
  reactionSeed: SeedReactions;
  ctaLabel: string | null;
  ctaHref: string | null;
  authorName: string;
  authorRole: string | null;
  authorAvatarUrl: string | null;
  publishedAt: string;
  sections: SeedSection[];
};

const DASHBOARD_SEED_ENTRIES: SeedEntry[] = [
  {
    id: 'mock-dashboard-team-note',
    date: '2026-04-19',
    title: 'Maintenance prevue ce lundi 21 avril, 03h00 -> 04h00',
    summary: "On coupe les parties classees une heure pour migrer les classements. Chat, shop, jeux solo et profils restent ouverts pendant l'operation.",
    body: [
      "On lance une migration de la base des classements lundi 21 avril entre 03h00 et 04h00.",
      "",
      "Pendant cette fenetre :",
      "- les parties classees sont mises en pause,",
      "- les gains ne sont pas perdus,",
      "- le chat, le shop, les jeux solo et les profils restent accessibles.",
      "",
      "Si on finit plus tot, la reprise sera immediate. Si on depasse, on le signalera dans le dashboard et le changelog.",
    ].join('\n'),
    feedCategory: 'DEV',
    imageUrl: null,
    accentColor: '#f59e0b',
    isFeatured: false,
    reactionSeed: { fire: 6, heart: 18, zap: 3 },
    ctaLabel: 'Details complets',
    ctaHref: '/changelog',
    authorName: 'Lena',
    authorRole: 'Lead dev',
    authorAvatarUrl: '/dashboard-mock/assets/avatar-lena.svg',
    publishedAt: '2026-04-19T12:00:00+02:00',
    sections: [
      {
        category: 'SMALL_FEATURE',
        items: [
          'Fenetre prevue: lundi 21 avril de 03h00 a 04h00.',
          'Scope: migration des classements, recalcul des index et purge des doublons saisonniers.',
        ],
      },
      {
        category: 'BUG_FIX',
        items: [
          'Fix: la reprise des parties classees ne dupliquera plus les anciennes lignes de resultat.',
        ],
      },
    ],
  },
  {
    id: 'mock-dashboard-u-1',
    date: '2026-04-19',
    title: 'Bombe de mots 2.0 debarque',
    summary: 'Mode solo refait, boss de manche, saisons de deux semaines et trois packs de mots inedits.',
    body: [
      "Bombe de mots passe en version 2.0 avec un vrai rythme de progression.",
      "",
      "Le mode solo monte maintenant par paliers, chaque fin de manche a son mini boss, et le chrono ne laisse plus de temps mort. On a aussi branche un classement saisonnier qui repart de zero toutes les deux semaines pour eviter les tops figes pendant des mois.",
      "",
      "Les trois packs de lancement sont deja actifs : argot marseillais, tech FR et culture geek.",
    ].join('\n'),
    feedCategory: 'GAME',
    imageUrl: '/dashboard-mock/assets/games/bomb.png',
    accentColor: '#ef4444',
    isFeatured: true,
    reactionSeed: { fire: 84, heart: 23, zap: 41 },
    ctaLabel: 'Jouer maintenant',
    ctaHref: '/bombparty',
    authorName: 'Equipe AuraTracker',
    authorRole: 'Game team',
    authorAvatarUrl: '/dashboard-mock/assets/aura-icon.svg',
    publishedAt: '2026-04-19T14:48:00+02:00',
    sections: [
      {
        category: 'BIG_FEATURE',
        items: [
          'Mode solo entierement refait avec courbe de difficulte revue et boss en fin de manche.',
          'Nouveau mode chrono pour enchaIner des manches de 90 secondes sans downtime.',
        ],
      },
      {
        category: 'SMALL_FEATURE',
        items: [
          'Saisons de classement de deux semaines avec recompenses de fin de cycle.',
          'Trois packs de mots de lancement: argot marseillais, tech FR, culture geek.',
          'Ecran de recap enrichi avec precision, combos et mot le plus rentable.',
        ],
      },
      {
        category: 'BUG_FIX',
        items: [
          'Fix: la bombe ne pouvait plus rester bloquee a 00:00 quand un joueur validait pile au changement de lettre.',
        ],
      },
    ],
  },
  {
    id: 'mock-dashboard-u-2',
    date: '2026-04-19',
    title: 'Patch 4.12 - equilibrage poker et fix 2048',
    summary: 'Le rake descend a 3 %, le split-pot est corrige et 2048 ne plante plus sur les tres gros scores.',
    body: [
      "On a boucle un patch centre sur les retours Discord de la semaine.",
      "",
      "Cote poker, le rake des parties classe passe de 5 % a 3 % et le partage du pot a trois joueurs a ete recalcule sur tous les cas limites remontes par la communaute. Cote 2048, le crash au-dessus de 131072 est corrige, tout comme le souci d'animation qui figait parfois le plateau apres un gros combo.",
      "",
      "Le changelog complet reprend chaque correction en detail.",
    ].join('\n'),
    feedCategory: 'PATCH',
    imageUrl: '/dashboard-mock/assets/games/poker.png',
    accentColor: '#10b981',
    isFeatured: false,
    reactionSeed: { fire: 12, heart: 48, zap: 9 },
    ctaLabel: 'Lire le changelog',
    ctaHref: '/changelog',
    authorName: 'corto',
    authorRole: 'Gameplay dev',
    authorAvatarUrl: '/dashboard-mock/assets/avatar-milo.svg',
    publishedAt: '2026-04-19T13:00:00+02:00',
    sections: [
      {
        category: 'SMALL_FEATURE',
        items: [
          'Nerf: rake poker classe 5 % -> 3 %.',
          'Buff: XP des quetes hebdo +15 % sur les tables classees.',
          'Les recap parties affichent maintenant le detail des side pots.',
        ],
      },
      {
        category: 'BUG_FIX',
        items: [
          'Fix: 2048 ne crash plus au-dela de 131072.',
          'Fix: split-pot a trois joueurs recalcule correctement.',
          'Fix: certaines notifs de gain arrivaient en double apres un rematch rapide.',
        ],
      },
    ],
  },
  {
    id: 'mock-dashboard-u-3',
    date: '2026-04-18',
    title: '@corto pulverise le record 2048 avec 524288',
    summary: "Le palier 2^19 tombe pour la premiere fois. L'ancien record tenait depuis sept mois.",
    body: [
      "@corto a claque un 524288 hier soir a 23h47 devant 34 spectateurs en vocal.",
      "",
      "C'est la premiere fois que le serveur voit tomber le palier 2^19. Le record precedent etait un 262144 signe @mila et il tenait depuis sept mois sans avoir bouge.",
      "",
      "On a garde le replay et le recap complet des merges clefs dans le changelog communautaire.",
    ].join('\n'),
    feedCategory: 'COMMUNITY',
    imageUrl: '/dashboard-mock/assets/games/2048.png',
    accentColor: '#f59e0b',
    isFeatured: false,
    reactionSeed: { fire: 156, heart: 62, zap: 88 },
    ctaLabel: 'Voir la partie',
    ctaHref: '/changelog',
    authorName: 'corto',
    authorRole: 'Joueur',
    authorAvatarUrl: '/dashboard-mock/assets/avatar-milo.svg',
    publishedAt: '2026-04-18T23:47:00+02:00',
    sections: [
      {
        category: 'SMALL_FEATURE',
        items: [
          'Premier 524288 valide sur le serveur.',
          'Replay archive avec les dix merges decisifs du run.',
        ],
      },
    ],
  },
  {
    id: 'mock-dashboard-u-4',
    date: '2026-04-18',
    title: 'Ce sur quoi on bosse pour avril et mai',
    summary: 'Mode spectateur, refonte du marche, alertes de prix et premiere vague Braquage Legal.',
    body: [
      "Le prochain sprint est tres produit.",
      "",
      "On avance sur un mode spectateur complet pour les tables de poker, une refonte du marche avec filtres rapides, historique des prix et alertes perso, et la premiere vague de features Braquage Legal avec session live, billets limits et recap de braquage.",
      "",
      "Le but est simple: que le dashboard devienne le point d'entree clair de tout ce qui bouge sur la plateforme.",
    ].join('\n'),
    feedCategory: 'DEV',
    imageUrl: '/dashboard-mock/assets/braquage-legal-logo.png',
    accentColor: '#8b5cf6',
    isFeatured: false,
    reactionSeed: { fire: 42, heart: 71, zap: 18 },
    ctaLabel: "Lire l'article",
    ctaHref: '/changelog',
    authorName: 'Lena',
    authorRole: 'Lead dev',
    authorAvatarUrl: '/dashboard-mock/assets/avatar-lena.svg',
    publishedAt: '2026-04-18T11:00:00+02:00',
    sections: [
      {
        category: 'BIG_FEATURE',
        items: [
          'Mode spectateur complet pour les tables de poker avec vue stack, historique et showdown.',
          'Premiere vague Braquage Legal: salle de session, tirage, recap et caisse de recompense.',
        ],
      },
      {
        category: 'SMALL_FEATURE',
        items: [
          'Refonte du marche avec filtres, historique de prix et alertes.',
          'Cartes dashboard plus lisibles pour les jeux, patchs et annonces equipe.',
        ],
      },
    ],
  },
  {
    id: 'mock-dashboard-u-5',
    date: '2026-04-17',
    title: 'Knife Hit rejoint le catalogue',
    summary: 'Un mini-jeu nerveux de 90 secondes, avec mise libre et duels 1v1 des le lancement.',
    body: [
      "Knife Hit rejoint le catalogue AuraTracker.",
      "",
      "C'est un jeu d'arcade ultra court, parfait entre deux parties longues. Tu peux lancer une run solo sans mise, engager de 50 a 2000 aura, ou partir direct sur un duel 1v1 avec un ami.",
      "",
      "Le tracking de meilleur score perso et la file duel sont deja branches au classement.",
    ].join('\n'),
    feedCategory: 'GAME',
    imageUrl: '/dashboard-mock/assets/games/knife.png',
    accentColor: '#0ea5e9',
    isFeatured: false,
    reactionSeed: { fire: 28, heart: 14, zap: 31 },
    ctaLabel: 'Essayer',
    ctaHref: '/games',
    authorName: 'Equipe AuraTracker',
    authorRole: 'Arcade team',
    authorAvatarUrl: '/dashboard-mock/assets/aura-icon.svg',
    publishedAt: '2026-04-17T18:00:00+02:00',
    sections: [
      {
        category: 'SMALL_FEATURE',
        items: [
          'Mise libre de 50 a 2000 aura.',
          'Duels 1v1 disponibles des le lancement.',
          'Tracker de meilleur score et recap de precision integres.',
        ],
      },
    ],
  },
  {
    id: 'mock-dashboard-u-6',
    date: '2026-04-16',
    title: 'Le serveur passe la barre des 10000 parties ce mois-ci',
    summary: 'Record mensuel battu. Nebula signe a lui seul 2800 parties sur la periode.',
    body: [
      "Petit cap symbolique mais tres parlant: on vient de depasser 10000 parties jouees sur le mois.",
      "",
      "Le clan Nebula a porte une grosse partie de la cadence avec 2800 parties, mais le record est surtout le signe qu'il y a du monde sur toutes les plages horaires maintenant.",
      "",
      "On garde cette entree dans le flux pour suivre les gros jalons communautaires sans les perdre dans les patch notes.",
    ].join('\n'),
    feedCategory: 'COMMUNITY',
    imageUrl: '/dashboard-mock/assets/clan-nebula.svg',
    accentColor: '#a855f7',
    isFeatured: false,
    reactionSeed: { fire: 91, heart: 34, zap: 12 },
    ctaLabel: 'Voir le classement',
    ctaHref: '/leaderboards',
    authorName: 'Equipe AuraTracker',
    authorRole: 'Community',
    authorAvatarUrl: '/dashboard-mock/assets/aura-icon.svg',
    publishedAt: '2026-04-16T14:00:00+02:00',
    sections: [
      {
        category: 'SMALL_FEATURE',
        items: [
          '10000 parties jouees sur le mois.',
          'Nebula mene avec 2800 parties enregistrees.',
          'Le pic de connexions simultanees a grimpe a 117 joueurs.',
        ],
      },
    ],
  },
  {
    id: 'mock-dashboard-u-7',
    date: '2026-04-14',
    title: 'Patch 4.11 - chat et notifs',
    summary: 'Reactions emoji, notifications groupees et mute de clan sans quitter la conversation.',
    body: [
      "Le patch 4.11 pose une vraie base pour le social.",
      "",
      "Les messages acceptent maintenant des reactions emoji, les notifications se groupent par conversation pour eviter le spam, et tu peux muter un clan sans avoir a quitter son espace.",
      "",
      "Cette entree sert aussi de mock pour tester les reactions du dashboard et le changelog extensible.",
    ].join('\n'),
    feedCategory: 'PATCH',
    imageUrl: null,
    accentColor: '#64748b',
    isFeatured: false,
    reactionSeed: { fire: 8, heart: 19, zap: 6 },
    ctaLabel: 'Lire le changelog',
    ctaHref: '/changelog',
    authorName: 'corto',
    authorRole: 'Messaging',
    authorAvatarUrl: '/dashboard-mock/assets/avatar-milo.svg',
    publishedAt: '2026-04-14T12:00:00+02:00',
    sections: [
      {
        category: 'BIG_FEATURE',
        items: [
          'New: reactions emoji sur les messages et aggregation des compteurs en direct.',
        ],
      },
      {
        category: 'SMALL_FEATURE',
        items: [
          'New: notifications groupees par conversation.',
          'New: mute un clan sans quitter la discussion.',
          'New: les apercus de message montrent maintenant le dernier auteur.',
        ],
      },
      {
        category: 'BUG_FIX',
        items: [
          'Fix: certains pings etaient emis deux fois quand une conversation etait ouverte sur mobile et desktop.',
        ],
      },
    ],
  },
  {
    id: 'mock-dashboard-u-8',
    date: '2026-04-13',
    title: 'La saison 4 commence lundi',
    summary: 'Nouveau pass a 90 paliers, reset des classements et recompenses exclusives de debut de saison.',
    body: [
      "La saison 4 demarre lundi 21 avril a 18h00.",
      "",
      "Au menu: un pass de 90 paliers, un reset complet des classements et des recompenses exclusives qu'on ne remettra pas dans les saisons suivantes. Cette entree est volontairement plus riche pour verifier l'expansion inline du changelog et les CTA dans la timeline.",
      "",
      "Tout le detail de la rotation des recompenses est visible dans le changelog.",
    ].join('\n'),
    feedCategory: 'DEV',
    imageUrl: null,
    accentColor: '#f59e0b',
    isFeatured: false,
    reactionSeed: { fire: 204, heart: 88, zap: 112 },
    ctaLabel: 'Decouvrir le pass',
    ctaHref: '/changelog',
    authorName: 'Equipe AuraTracker',
    authorRole: 'Live ops',
    authorAvatarUrl: '/dashboard-mock/assets/aura-icon.svg',
    publishedAt: '2026-04-13T10:00:00+02:00',
    sections: [
      {
        category: 'BIG_FEATURE',
        items: [
          'Pass saisonnier a 90 paliers avec recompenses exclusives.',
          'Reset complet des classements et relance des objectifs hebdo.',
        ],
      },
      {
        category: 'SMALL_FEATURE',
        items: [
          'Bonus de connexion renforce la premiere semaine.',
          'Banniere saisonniere et recap de progression ajoutes au dashboard.',
        ],
      },
    ],
  },
];

export async function ensureDashboardSeedEntries() {
  await prisma.$transaction(async (tx) => {
    for (const entry of DASHBOARD_SEED_ENTRIES) {
      await tx.updateEntry.upsert({
        where: { id: entry.id },
        create: {
          id: entry.id,
          date: entry.date,
          title: entry.title,
          summary: entry.summary,
          body: entry.body,
          feedCategory: entry.feedCategory,
          imageUrl: entry.imageUrl,
          accentColor: entry.accentColor,
          isFeatured: entry.isFeatured,
          reactionSeedFire: entry.reactionSeed.fire,
          reactionSeedHeart: entry.reactionSeed.heart,
          reactionSeedZap: entry.reactionSeed.zap,
          ctaLabel: entry.ctaLabel,
          ctaHref: entry.ctaHref,
          authorName: entry.authorName,
          authorRole: entry.authorRole,
          authorAvatarUrl: entry.authorAvatarUrl,
          isPublished: true,
          publishedAt: new Date(entry.publishedAt),
        },
        update: {
          date: entry.date,
          title: entry.title,
          summary: entry.summary,
          body: entry.body,
          feedCategory: entry.feedCategory,
          imageUrl: entry.imageUrl,
          accentColor: entry.accentColor,
          isFeatured: entry.isFeatured,
          reactionSeedFire: entry.reactionSeed.fire,
          reactionSeedHeart: entry.reactionSeed.heart,
          reactionSeedZap: entry.reactionSeed.zap,
          ctaLabel: entry.ctaLabel,
          ctaHref: entry.ctaHref,
          authorName: entry.authorName,
          authorRole: entry.authorRole,
          authorAvatarUrl: entry.authorAvatarUrl,
          isPublished: true,
          publishedAt: new Date(entry.publishedAt),
        },
      });

      await tx.updateItem.deleteMany({
        where: { entryId: entry.id },
      });

      const items = entry.sections.flatMap((section) =>
        section.items.map((text, order) => ({
          entryId: entry.id,
          category: section.category,
          text,
          order,
        }))
      );

      if (items.length > 0) {
        await tx.updateItem.createMany({
          data: items,
        });
      }
    }
  });
}
