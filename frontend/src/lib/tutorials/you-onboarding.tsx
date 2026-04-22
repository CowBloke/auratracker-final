import type { TutorialFlow } from '@/components/tutorial/types';

export const youOnboarding: TutorialFlow = {
  id: 'you-onboarding',
  title: 'Bienvenue sur AuraTracker',
  description: 'Découvre la navigation, la section YOU et les outils essentiels en quelques étapes.',
  sections: [
    { id: 'navigation', title: 'Navigation', startIndex: 0, endIndex: 7 },
    { id: 'you-section', title: 'Section YOU', startIndex: 8, endIndex: 13 },
    { id: 'aide', title: 'Aide & outils', startIndex: 14, endIndex: 15 },
  ],
  steps: [
    // ── Navigation (0–7) ─────────────────────────────────────────────────────
    {
      id: 'welcome',
      placement: 'center',
      title: 'Bienvenue sur AuraTracker !',
      content: (
        <div className="space-y-2">
          <p>AuraTracker est une simulation économique multijoueur où tu gères des entreprises, investis, formes des alliances et accumules des richesses.</p>
          <p className="text-muted-foreground">Ce tutoriel te présente les éléments essentiels. Tu peux le quitter ou passer une section à tout moment.</p>
        </div>
      ),
    },
    {
      id: 'sidebar',
      targetId: 'sidebar',
      placement: 'right',
      title: 'La barre de navigation',
      content: (
        <p>Cette barre sur la gauche te donne accès à toutes les sections du site. Elle se rétracte automatiquement — passe la souris dessus pour la voir en entier.</p>
      ),
      spotlightPadding: 4,
    },
    {
      id: 'sidebar-logo',
      targetId: 'sidebar-logo',
      placement: 'right',
      title: 'Le logo AuraTracker',
      content: (
        <p>Ce logo est ton point de départ : clique dessus pour basculer entre le <strong>Dashboard</strong> et la section <strong>YOU</strong>, le cœur du jeu.</p>
      ),
    },
    {
      id: 'nav-games',
      targetId: 'nav-games',
      placement: 'right',
      title: 'Les Jeux',
      content: (
        <p>Accède à des dizaines de mini-jeux pour gagner de l'argent ou de l'<strong>Aura</strong>. Tu peux défier d'autres joueurs en duel ou rejoindre une partie via le salon de jeu.</p>
      ),
    },
    {
      id: 'nav-leaderboards',
      targetId: 'nav-leaderboards',
      placement: 'right',
      title: 'Classements',
      content: (
        <p>Les <strong>Classements</strong> affichent les meilleurs joueurs par richesse, Aura, performances en jeux et bien d'autres catégories. Un bon repère pour mesurer ta progression.</p>
      ),
    },
    {
      id: 'nav-clans',
      targetId: 'nav-clans',
      placement: 'right',
      title: 'Clans',
      content: (
        <p>Rejoins ou crée un <strong>Clan</strong> pour collaborer avec d'autres joueurs. Les clans participent à des guerres, partagent des ressources et gagnent des effets collectifs.</p>
      ),
    },
    {
      id: 'nav-marketplace',
      targetId: 'nav-marketplace',
      placement: 'right',
      title: 'Le Marketplace',
      content: (
        <p>La place de marché du jeu : achète et vends des <strong>ressources</strong>, des objets et des actions d'entreprises entre joueurs en temps réel.</p>
      ),
    },
    {
      id: 'nav-tutoriels',
      targetId: 'nav-tutoriels',
      placement: 'right',
      title: 'Tutoriels',
      content: (
        <p>Cette section regroupe tous les guides du jeu, écrits et interactifs. Tu peux relancer n'importe quel tutoriel à tout moment depuis ici.</p>
      ),
    },

    // ── Section YOU (8–13) ───────────────────────────────────────────────────
    {
      id: 'you-intro',
      placement: 'center',
      title: 'La section YOU',
      content: (
        <div className="space-y-2">
          <p>La section <strong>YOU</strong> est le centre de ton expérience AuraTracker. Elle se divise en plusieurs onglets accessibles depuis la barre de navigation gauche.</p>
          <p className="text-muted-foreground">Clique sur le logo pour y accéder — les prochaines étapes te guident onglet par onglet.</p>
        </div>
      ),
      route: '/you?tab=overview',
    },
    {
      id: 'you-tab-overview',
      targetId: 'you-tab-overview',
      placement: 'right',
      title: 'Vue d\'ensemble',
      content: (
        <p>Ton tableau de bord personnel : statistiques globales, fil d'activité récent et notifications importantes en un coup d'œil.</p>
      ),
      route: '/you?tab=overview',
    },
    {
      id: 'you-tab-travail',
      targetId: 'you-tab-travail',
      placement: 'right',
      title: 'Travail',
      content: (
        <div className="space-y-2">
          <p>Le centre de ton empire économique. Crée des entreprises, gère tes employés, produis des ressources et accepte des offres de travail d'autres joueurs.</p>
        </div>
      ),
      route: '/you?tab=travail',
    },
    {
      id: 'you-tab-explore',
      targetId: 'you-tab-explore',
      placement: 'right',
      title: 'Explorer',
      content: (
        <p>Parcours les entreprises des autres joueurs : investis en tant qu'actionnaire, emprunte du capital, transfère des fonds ou achète des formations.</p>
      ),
      route: '/you?tab=explore',
    },
    {
      id: 'you-tab-social',
      targetId: 'you-tab-social',
      placement: 'right',
      title: 'Social',
      content: (
        <p>Gère tes <strong>relations</strong> avec les autres joueurs : amitié, mariage, liaison. Certains liens donnent des bonus économiques ou d'Aura.</p>
      ),
      route: '/you?tab=social',
    },
    {
      id: 'you-tab-finance',
      targetId: 'you-tab-finance',
      placement: 'right',
      title: 'Finance',
      content: (
        <p>Vue financière complète : comptes bancaires, épargne, historique de transactions, AuraCoin et suivi de tes revenus passifs.</p>
      ),
      route: '/you?tab=finance',
    },

    // ── Aide & outils (14–15) ────────────────────────────────────────────────
    {
      id: 'bug-report',
      targetId: 'nav-bug-report',
      placement: 'right',
      title: 'Signaler un bug',
      content: (
        <div className="space-y-2">
          <p>Ce bouton ouvre le formulaire de <strong>signalement de bug</strong>. Si quelque chose ne fonctionne pas correctement, décris le problème ici — les admins le verront.</p>
          <p className="text-muted-foreground">Tu peux joindre des captures d'écran pour aider à reproduire le problème.</p>
        </div>
      ),
      route: '/you?tab=overview',
    },
    {
      id: 'conclusion',
      placement: 'center',
      title: 'Tu es prêt à jouer !',
      content: (
        <div className="space-y-2">
          <p>Tu connais maintenant l'essentiel d'AuraTracker. La prochaine étape naturelle est de <strong>créer ta première entreprise</strong> dans l'onglet Travail.</p>
          <p className="text-muted-foreground">D'autres tutoriels interactifs sont disponibles sur la page Tutoriels pour aller plus loin : jeux, clans, marketplace…</p>
        </div>
      ),
    },
  ],
};
