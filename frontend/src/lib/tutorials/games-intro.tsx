import type { TutorialFlow } from '@/components/tutorial/types';

export const gamesIntro: TutorialFlow = {
  id: 'games-intro',
  title: 'Les Jeux',
  description: 'Découvre comment jouer, gagner de l\'argent et défier d\'autres joueurs.',
  sections: [
    { id: 'decouverte', title: 'Découverte', startIndex: 0, endIndex: 3 },
    { id: 'multijoueur', title: 'Multijoueur', startIndex: 4, endIndex: 6 },
  ],
  steps: [
    // ── Découverte (0–3) ─────────────────────────────────────────────────────
    {
      id: 'intro',
      placement: 'center',
      title: 'Les Jeux AuraTracker',
      content: (
        <div className="space-y-2">
          <p>AuraTracker propose une large sélection de jeux intégrés — des classiques aux créations originales. Chaque partie peut te rapporter de l'argent ou de l'<strong>Aura</strong>.</p>
          <p className="text-muted-foreground">Ce tutoriel t'explique comment naviguer dans la section Jeux et tirer le meilleur parti des options multijoueur.</p>
        </div>
      ),
      route: '/games',
    },
    {
      id: 'nav-games',
      targetId: 'nav-games',
      placement: 'right',
      title: 'Accéder aux Jeux',
      content: (
        <p>Clique sur <strong>Jeux</strong> dans la barre de navigation pour voir tous les jeux disponibles. Ils sont organisés par catégories.</p>
      ),
      actionText: 'Clique sur Jeux pour ouvrir la section.',
      route: '/games',
    },
    {
      id: 'games-variety',
      placement: 'center',
      title: 'Variété de jeux',
      content: (
        <div className="space-y-2">
          <p>Tu trouveras des jeux de cartes (<strong>Poker, UNO</strong>), d'adresse (<strong>Mines, Crash</strong>), de stratégie (<strong>Échecs, Puissance 4</strong>) et des classiques (<strong>Snake, Tetris</strong>).</p>
          <p className="text-muted-foreground">Certains jeux ont des mises minimales ou des conditions d'accès. Lis les règles avant de jouer.</p>
        </div>
      ),
      route: '/games',
    },
    {
      id: 'leaderboards',
      targetId: 'nav-leaderboards',
      placement: 'right',
      title: 'Classements',
      content: (
        <p>Après chaque partie, tes résultats impactent tes <strong>classements</strong>. Consulte les classements pour voir où tu te situes face aux autres joueurs.</p>
      ),
      route: '/games',
    },

    // ── Multijoueur (4–6) ─────────────────────────────────────────────────────
    {
      id: 'multiplayer-intro',
      placement: 'center',
      title: 'Jouer avec les autres',
      content: (
        <div className="space-y-2">
          <p>La plupart des jeux supportent le <strong>mode multijoueur</strong>. Tu peux rejoindre une salle existante ou en créer une nouvelle et inviter des joueurs.</p>
        </div>
      ),
      route: '/games',
    },
    {
      id: 'duel',
      placement: 'center',
      title: 'Duels',
      content: (
        <div className="space-y-2">
          <p>Le système de <strong>duel</strong> te permet de défier directement un joueur spécifique. Lance un défi depuis son profil ou depuis certains jeux — il recevra une notification et peut accepter ou refuser.</p>
          <p className="text-muted-foreground">Les duels se jouent en temps réel ; le gagnant remporte la mise convenue.</p>
        </div>
      ),
      route: '/games',
    },
    {
      id: 'conclusion',
      placement: 'center',
      title: 'Prêt à jouer !',
      content: (
        <div className="space-y-2">
          <p>Tu sais maintenant naviguer dans la section Jeux. Lance une partie, grimpe dans les classements et défie tes adversaires !</p>
          <p className="text-muted-foreground">Pense à revenir sur la page <strong>Tutoriels</strong> pour découvrir les guides sur les Clans et le Marketplace.</p>
        </div>
      ),
    },
  ],
};
