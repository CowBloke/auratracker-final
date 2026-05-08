import type { TutorialFlow } from '@/components/tutorial/types';

export const youOnboarding: TutorialFlow = {
  id: 'you-onboarding',
  title: 'Bienvenue sur AuraTracker',
  description: 'Découvre la navigation, la section YOU et les outils essentiels en quelques étapes.',
  sections: [
    { id: 'navigation', title: 'Navigation', startIndex: 0, endIndex: 17 },
    { id: 'you-section', title: 'Section YOU', startIndex: 18, endIndex: 20 },
    { id: 'aide', title: 'Aide & outils', startIndex: 21, endIndex: 22 },
  ],
  steps: [
    // ── Navigation (0–7) ─────────────────────────────────────────────────────
    {
      id: 'welcome',
      placement: 'center',
      title: 'Bienvenue sur AuraTracker !',
      content: (
        <div className="space-y-3">
          <p>AuraTracker est une simulation économique multijoueur où tu gères des entreprises, investis, formes des alliances et accumules des richesses.</p>
          <p className="text-muted-foreground">Ce tutoriel te présente les éléments essentiels. Tu peux le quitter ou passer une section à tout moment.</p>
        </div>
      ),
    },
    {
      id: 'welcome-tabs-1',
      placement: 'center',
      title: 'Principaux onglets (1/2)',
      content: (
        <div className="space-y-3">
          <p className="text-muted-foreground">Voici les principales sections de la barre de navigation :</p>
          <div className="rounded-xl border border-border/30 p-3 bg-muted/5">
            <div className="grid gap-2">
              <div className="text-sm"><strong>Dashboard</strong> — Vue d'ensemble : statistiques, fil d'activité et notifications.</div>
              <div className="text-sm"><strong>YOU</strong> — Le coeur du jeu : ton profil, entreprises, investissements et onglets associés.</div>
              <div className="text-sm"><strong>Jeux</strong> — Mini-jeux pour gagner de l'Aura ou de l'argent.</div>
              <div className="text-sm"><strong>Classements</strong> — Meilleurs joueurs par richesse, Aura et performances.</div>
              <div className="text-sm"><strong>Clans</strong> — Rejoins ou crée un clan pour jouer en équipe.</div>
              <div className="text-sm"><strong>Marketplace</strong> — Achetez et vendez ressources, objets et actions entre joueurs.</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'welcome-tabs-2',
      placement: 'center',
      title: 'Principaux onglets (2/2)',
      content: (
        <div className="space-y-3">
          <div className="rounded-xl border border-border/30 p-3 bg-muted/5">
            <div className="grid gap-2">
              <div className="text-sm"><strong>Boutique / Shop</strong> — Achats directs de ressources et objets.</div>
              <div className="text-sm"><strong>Inventaire</strong> — Tes objets et biens personnels.</div>
              <div className="text-sm"><strong>Quêtes & Événements</strong> — Missions et récompenses temporaires.</div>
              <div className="text-sm"><strong>Forum / Suggestions</strong> — Communauté, idées et retours.</div>
              <div className="text-sm"><strong>Tutoriels</strong> — Tous les guides et tutoriels disponibles.</div>
            </div>
          </div>
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
      id: 'nav-dashboard',
      targetId: 'nav-dashboard',
      placement: 'right',
      title: 'Dashboard',
      content: (
        <p>Le <strong>Dashboard</strong> te donne un aperçu global : activité récente, notifications importantes et raccourcis vers tes actions principales.</p>
      ),
      route: '/dashboard',
    },
    {
      id: 'nav-games',
      targetId: 'nav-games',
      placement: 'right',
      title: 'Les Jeux',
      content: (
        <p>Accède à des dizaines de mini-jeux pour gagner de l'argent ou de l'<strong>Aura</strong>. Tu peux défier d'autres joueurs en duel ou rejoindre une partie via le salon de jeu.</p>
      ),
      route: '/games',
    },
    {
      id: 'nav-leaderboards',
      targetId: 'nav-leaderboards',
      placement: 'right',
      title: 'Classements',
      content: (
        <p>Les <strong>Classements</strong> affichent les meilleurs joueurs par richesse, Aura, performances en jeux et bien d'autres catégories. Un bon repère pour mesurer ta progression.</p>
      ),
      route: '/leaderboards',
    },
    {
      id: 'nav-clans',
      targetId: 'nav-clans',
      placement: 'right',
      title: 'Clans',
      content: (
        <p>Rejoins ou crée un <strong>Clan</strong> pour collaborer avec d'autres joueurs. Les clans participent à des guerres, partagent des ressources et gagnent des effets collectifs.</p>
      ),
      route: '/clans',
    },
    {
      id: 'nav-polymarket',
      targetId: 'nav-polymarket',
      placement: 'right',
      title: 'PolyMarket',
      content: (
        <p>Le <strong>PolyMarket</strong> te permet de spéculer sur les prix des ressources, des actions et des événements futurs. Gagne de l'argent en prédisant les tendances du marché.</p>
      ),
      route: '/polymarket',
    },
    {
      id: 'nav-market',
      targetId: 'nav-market',
      placement: 'right',
      title: 'Boutique',
      content: (
        <p>La <strong>Boutique</strong> (Shop) te permet d'acheter des ressources et objets directement. Utile pour compléter tes activités in-game rapidement.</p>
      ),
      route: '/market',
    },
    {
      id: 'nav-inventory',
      targetId: 'nav-inventory',
      placement: 'right',
      title: 'Inventaire',
      content: (
        <p>L'<strong>Inventaire</strong> contient tous tes objets, consommables et biens achetés. Tu peux les utiliser ou les vendre depuis cette page.</p>
      ),
      route: '/inventory',
    },
    {
      id: 'nav-marketplace',
      targetId: 'nav-marketplace',
      placement: 'right',
      title: 'Marketplace',
      content: (
        <p>La <strong>Marketplace</strong> est la place de marche du jeu : achete et vends des <strong>ressources</strong>, des objets et des actions d'entreprises entre joueurs en temps reel.</p>
      ),
      route: '/marketplace',
    },
    {
      id: 'nav-party',
      targetId: 'nav-party',
      placement: 'right',
      title: 'Party',
      content: (
        <p>La section <strong>Party</strong> rassemble tes groupes et événements sociaux : organise des rencontres et participe à des activités collectives.</p>
      ),
      route: '/party',
    },
    {
      id: 'nav-quests',
      targetId: 'nav-quests',
      placement: 'right',
      title: 'Quêtes',
      content: (
        <p>Les <strong>Quêtes</strong> offrent des objectifs avec récompenses. Elles sont une excellente manière de gagner de l'argent ou de l'Aura rapidement.</p>
      ),
      route: '/quests',
    },
    {
      id: 'nav-forum',
      targetId: 'nav-forum',
      placement: 'right',
      title: 'Forum',
      content: (
        <p>Le <strong>Forum</strong> est l'espace communautaire pour discuter, poser des questions et partager des guides avec d'autres joueurs.</p>
      ),
      route: '/forum',
    },
    {
      id: 'nav-suggestions',
      targetId: 'nav-suggestions',
      placement: 'right',
      title: 'Suggestions',
      content: (
        <p>Envie d'améliorations ? La page <strong>Suggestions</strong> te permet de proposer des idées ou de voter pour celles des autres.</p>
      ),
      route: '/suggestions',
    },
    {
      id: 'nav-rules',
      targetId: 'nav-rules',
      placement: 'right',
      title: 'Règles & Info',
      content: (
        <p>La section <strong>Règles</strong> contient les informations essentielles sur le fonctionnement de la plateforme et les règles en vigueur.</p>
      ),
      route: '/rules',
    },

    // ── Section YOU (16–19) ─────────────────────────────────────────────────
    {
      id: 'you-intro',
      placement: 'center',
      title: 'La section YOU',
      content: (
        <div className="space-y-2">
          <p>La section <strong>YOU</strong> est le centre de ton expérience AuraTracker. Elle contient deux onglets : <strong>Carte</strong> et <strong>Supply</strong>.</p>
          <p className="text-muted-foreground">Clique sur le logo pour y accéder — les prochaines étapes te guident à travers chaque onglet.</p>
        </div>
      ),
      route: '/you?tab=carte',
    },
    {
      id: 'you-tab-carte-nav',
      targetId: 'you-tab-carte',
      placement: 'right',
      title: 'Onglet Carte',
      content: (
        <div className="space-y-2">
          <p>L'onglet <strong>Carte</strong> affiche la vue interactive de la ville avec tous les quartiers et entreprises répartis par secteur.</p>
          <p className="text-xs text-muted-foreground"><strong>À gauche :</strong> Parcourir les entreprises · <strong>Au centre :</strong> La carte interactive · <strong>À droite :</strong> Notifications en temps réel</p>
        </div>
      ),
      route: '/you?tab=carte',
    },
    {
      id: 'you-tab-supply-nav',
      targetId: 'you-tab-supply',
      placement: 'right',
      title: 'Onglet Supply',
      content: (
        <div className="space-y-2">
          <p>L'onglet <strong>Supply</strong> contient le système de ressources et de chaînes de production.</p>
          <p className="text-xs text-muted-foreground"><strong>À gauche :</strong> Tes entreprises · <strong>Au centre :</strong> Graphe de production · <strong>À droite :</strong> Tes commandes et offres</p>
        </div>
      ),
      route: '/you?tab=supply',
    },

    // ── Aide & outils (20–21) ───────────────────────────────────────────────
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
      route: '/dashboard',
    },
    {
      id: 'conclusion',
      placement: 'center',
      title: 'Tu es prêt à jouer !',
      content: (
        <div className="space-y-2">
          <p>Excellent ! Tu maîtrises maintenant l'essentiel d'AuraTracker. Tu connais tous les principaux onglets et tu sais comment naviguer.</p>
          <p className="text-muted-foreground">D'autres tutoriels interactifs sont disponibles sur la page Tutoriels pour approfondir : jeux, clans, marketplace, et bien plus…</p>
        </div>
      ),
    },
  ],
};
