import type { TutorialFlow } from '@/components/tutorial/types';

export const buildBusinessAToZ: TutorialFlow = {
  id: 'build-business-a-to-z',
  title: 'Construire un business de A à Z',
  description: 'Un parcours interactif complet: créer, produire, améliorer et piloter une entreprise depuis l\'onglet Actions.',
  sections: [
    { id: 'intro', title: 'Cap', startIndex: 0, endIndex: 0 },
    { id: 'creation', title: 'Création', startIndex: 1, endIndex: 7 },
    { id: 'production', title: 'Production', startIndex: 8, endIndex: 11 },
    { id: 'pilotage', title: 'Pilotage', startIndex: 12, endIndex: 15 },
  ],
  steps: [
    // ── INTRO ───────────────────────────────────────────────────────────────
    {
      id: 'mission',
      placement: 'center',
      title: 'Objectif: une vraie entreprise',
      content: (
        <div className="space-y-2">
          <p>On va créer une entreprise complète depuis l'onglet Actions: type d'activité, capital, production, stock et ventes.</p>
          <p className="text-muted-foreground">Ce guide avance quand tu cliques sur les éléments demandés. Chaque action compte.</p>
        </div>
      ),
      route: '/you?tab=actions',
    },
    // ── CRÉATION ────────────────────────────────────────────────────────────
    {
      id: 'actions-tab-overview',
      targetId: 'you-tab-actions',
      placement: 'right',
      title: 'L\'onglet Actions',
      content: <p>L'onglet Actions centralise tout: créer un business, lancer des productions et gérer tes entreprises depuis un seul endroit.</p>,
      route: '/you?tab=actions',
    },
    {
      id: 'create-button',
      targetId: 'actions-create-button',
      placement: 'bottom',
      title: 'Créer un business',
      content: <p>Ce bouton ouvre le formulaire de création. Tu peux créer autant de businesses que ton niveau le permet.</p>,
      actionText: 'Clique sur « Créer » pour ouvrir le formulaire.',
      advanceOn: 'target-click',
      advanceDelayMs: 700,
    },
    {
      id: 'modal-ready',
      targetId: 'create-business-modal',
      placement: 'auto',
      title: 'Formulaire de création',
      content: <p>Ici tu choisis l'activité, le nom, la description et le capital. Chaque choix a un impact direct sur tes coûts et revenus.</p>,
      advanceOn: 'target-present',
      advanceDelayMs: 900,
    },
    {
      id: 'open-type-picker',
      targetId: 'create-business-type',
      placement: 'auto',
      title: 'Choisir le type d\'activité',
      content: <p>Le type d'activité détermine ce que tu produis, tes coûts fixes et les ressources nécessaires pour chaque production.</p>,
      actionText: 'Clique sur le bloc du type d\'activité pour voir toutes les options.',
      advanceOn: 'target-click',
      advanceDelayMs: 500,
    },
    {
      id: 'select-lemonade',
      targetId: 'business-type-option-lemonade',
      placement: 'auto',
      title: 'Un démarrage simple',
      content: <p>Le stand de limonade est idéal pour débuter: peu de frais, production lisible et marges faciles à comprendre.</p>,
      actionText: 'Clique sur « Stand de limonade » ou choisis un autre type niveau 1.',
      advanceOn: 'target-click',
      advanceDelayMs: 350,
    },
    {
      id: 'confirm-type',
      targetId: 'business-type-picker-confirm',
      placement: 'left',
      title: 'Confirmer le type',
      content: <p>Valide ton choix d'activité. Le formulaire va afficher les champs de nom, description et capital.</p>,
      actionText: 'Clique sur le bouton de confirmation.',
      advanceOn: 'target-click',
      advanceDelayMs: 500,
    },
    {
      id: 'fill-and-submit',
      targetId: 'create-business-submit',
      placement: 'left',
      title: 'Remplir et lancer',
      content: (
        <div className="space-y-2">
          <p>Tape un nom court, écris une courte description, ajuste le capital si besoin — puis clique sur « Créer ».</p>
          <p className="text-muted-foreground">Le bouton reste grisé tant que le nom ou la description est vide.</p>
        </div>
      ),
      actionText: 'Remplis le nom, la description et le capital, puis clique sur « Créer ».',
      advanceOn: 'target-click',
      advanceDelayMs: 1200,
    },
    // ── PRODUCTION ──────────────────────────────────────────────────────────
    {
      id: 'business-card',
      targetId: 'actions-business-card',
      placement: 'top',
      title: 'Ton entreprise est créée',
      content: <p>Elle apparaît ici sous forme d'une carte de production avec sa trésorerie, sa note et ses lignes de fabrication.</p>,
      route: '/you?tab=actions',
    },
    {
      id: 'ingredients-column',
      targetId: 'actions-ingredients',
      placement: 'right',
      title: 'Colonne Ingrédients',
      content: (
        <div className="space-y-2">
          <p>Liste tout ce qu'il faut pour lancer une production: ressources, frais fixes et source de paiement.</p>
          <p className="text-muted-foreground">Une carte rouge signale un stock manquant ou une trésorerie insuffisante — clique dessus pour acheter au marché.</p>
        </div>
      ),
    },
    {
      id: 'run-action',
      targetId: 'actions-produce-button',
      placement: 'left',
      title: 'Lancer la production',
      content: (
        <div className="space-y-2">
          <p>Ce bouton lance la production. Il reste grisé si une condition manque (source, trésorerie ou stock plein).</p>
          <p className="text-muted-foreground">Clique dessus quand tous les ingrédients sont disponibles. Le timer démarre et le stock se remplit à la fin.</p>
        </div>
      ),
      actionText: 'Lance une production si les ingrédients sont disponibles, sinon continue.',
      requireManualAdvance: true,
    },
    {
      id: 'stock-and-sell',
      targetId: 'actions-stock',
      placement: 'left',
      title: 'Stock et vente',
      content: (
        <div className="space-y-2">
          <p>La colonne de droite montre le stock produit. Le bouton « Vendre » t'envoie à la salle de marché pour publier une offre.</p>
          <p className="text-muted-foreground">Garde un œil sur la jauge: un stock plein bloque la production.</p>
        </div>
      ),
    },
    // ── PILOTAGE ────────────────────────────────────────────────────────────
    {
      id: 'upgrades',
      targetId: 'actions-upgrade-button',
      placement: 'bottom',
      title: 'Améliorer ton business',
      content: (
        <div className="space-y-2">
          <p>Ouvre le panneau d'upgrades: vitesse de production, taille des stocks et file d'attente.</p>
          <p className="text-muted-foreground">Commence par la file d'attente pour ne pas surveiller en permanence, puis accélère quand la demande suit.</p>
        </div>
      ),
      actionText: 'Clique sur « Améliorer » pour voir les options, puis ferme le panneau et continue.',
      requireManualAdvance: true,
    },
    {
      id: 'manage',
      targetId: 'actions-manage-button',
      placement: 'bottom',
      title: 'Gérer l\'équipe et la trésorerie',
      content: <p>Ouvre le panneau de gestion: inviter des membres, consulter les transactions et piloter la trésorerie du business.</p>,
      actionText: 'Clique sur « Gérer » pour explorer le panneau, puis ferme-le et continue.',
      requireManualAdvance: true,
    },
    {
      id: 'source-selection',
      targetId: 'actions-ingredients',
      placement: 'right',
      title: 'Choisir tes sources',
      content: (
        <div className="space-y-2">
          <p>Les cartes d'ingrédients sont des sélecteurs. Clique dessus pour choisir d'où vient chaque ressource: ton propre stock (gratuit) ou une offre de marché (payante).</p>
          <p className="text-muted-foreground">Priorité au stock interne pour maximiser la marge. Le marché sert de secours quand ton stock est vide.</p>
        </div>
      ),
    },
    {
      id: 'final-loop',
      placement: 'center',
      title: 'La boucle est bouclée',
      content: (
        <div className="space-y-2">
          <p>Tu maîtrises le cycle complet: créer un business, configurer les sources, lancer la production, surveiller le stock et vendre.</p>
          <p className="text-muted-foreground">Quand une carte vire au rouge, elle te dit exactement quoi corriger: trésorerie, stock vide ou source manquante. Suis les signaux.</p>
        </div>
      ),
      route: '/you?tab=actions',
    },
  ],
};
