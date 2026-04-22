import type { TutorialFlow } from '@/components/tutorial/types';

export const clansIntro: TutorialFlow = {
  id: 'clans-intro',
  title: 'Les Clans',
  description: 'Comprends le système de clans : rejoindre, collaborer et participer aux guerres.',
  sections: [
    { id: 'bases', title: 'Les bases', startIndex: 0, endIndex: 3 },
    { id: 'guerres', title: 'Guerres de clans', startIndex: 4, endIndex: 6 },
  ],
  steps: [
    // ── Les bases (0–3) ──────────────────────────────────────────────────────
    {
      id: 'intro',
      placement: 'center',
      title: 'Le système de Clans',
      content: (
        <div className="space-y-2">
          <p>Les <strong>Clans</strong> sont des groupes de joueurs qui collaborent pour progresser ensemble. Rejoindre un clan te donne accès à des effets collectifs, un chat privé et des guerres entre clans.</p>
          <p className="text-muted-foreground">Tu peux créer ton propre clan ou en rejoindre un existant.</p>
        </div>
      ),
      route: '/clans',
    },
    {
      id: 'nav-clans',
      targetId: 'nav-clans',
      placement: 'right',
      title: 'Section Clans',
      content: (
        <p>Clique sur <strong>Clans</strong> dans la navigation pour voir tous les clans actifs, leurs membres, leurs niveaux et les critères d'entrée.</p>
      ),
      actionText: 'Ouvre la section Clans.',
      route: '/clans',
    },
    {
      id: 'rejoindre',
      placement: 'center',
      title: 'Rejoindre ou créer un clan',
      content: (
        <div className="space-y-2">
          <p>Pour <strong>rejoindre</strong> un clan : trouve-en un qui accepte des membres, lis ses conditions et envoie une demande. Le chef de clan valide les candidatures.</p>
          <p>Pour <strong>créer</strong> le tien : clique sur « Créer un clan », choisis un nom, un tag et une couleur. Tu deviens automatiquement chef.</p>
        </div>
      ),
      route: '/clans',
    },
    {
      id: 'effets',
      placement: 'center',
      title: 'Effets de clan',
      content: (
        <div className="space-y-2">
          <p>Les clans peuvent activer des <strong>effets collectifs</strong> qui bénéficient à tous les membres : bonus de revenus, réduction d'impôts, protection en guerre, etc.</p>
          <p className="text-muted-foreground">Ces effets sont déclenchés par les actions du clan (victoires, contributions de ressources) et ont une durée limitée.</p>
        </div>
      ),
      route: '/clans',
    },

    // ── Guerres de clans (4–6) ───────────────────────────────────────────────
    {
      id: 'guerres-intro',
      placement: 'center',
      title: 'Guerres entre clans',
      content: (
        <div className="space-y-2">
          <p>Les <strong>guerres de clans</strong> sont des confrontations organisées entre deux clans. Elles se jouent via des mini-jeux collectifs sur une carte stratégique.</p>
          <p className="text-muted-foreground">Le clan vainqueur gagne des ressources, de l'Aura et des effets temporaires pour tous ses membres.</p>
        </div>
      ),
      route: '/clans',
    },
    {
      id: 'contraband',
      placement: 'center',
      title: 'Ressources et contrebande',
      content: (
        <div className="space-y-2">
          <p>Les guerres impliquent des <strong>ressources stratégiques</strong>, notamment la contrebande. Les clans qui contrôlent la production de contrebande ont un avantage en guerre.</p>
          <p className="text-muted-foreground">C'est pourquoi les entreprises illégales ont un rôle important dans l'économie du jeu.</p>
        </div>
      ),
      route: '/clans',
    },
    {
      id: 'conclusion',
      placement: 'center',
      title: 'Prêt pour les clans !',
      content: (
        <div className="space-y-2">
          <p>Tu comprends maintenant le fonctionnement des clans. Rejoins-en un (ou crée le tien) pour profiter des bonus collectifs et participer aux guerres.</p>
          <p className="text-muted-foreground">Consulte les autres tutoriels pour maîtriser la production de ressources et le Marketplace.</p>
        </div>
      ),
    },
  ],
};
