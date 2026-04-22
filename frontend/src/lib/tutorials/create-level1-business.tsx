import type { TutorialFlow } from '@/components/tutorial/types';

export const createLevel1Business: TutorialFlow = {
  id: 'create-level1-business',
  title: 'Créer une entreprise niveau 1',
  description: 'Guide pas à pas pour créer ton premier business niveau 1.',
  sections: [
    { id: 'intro', title: 'Préparation', startIndex: 0, endIndex: 2 },
    { id: 'creation', title: 'Création', startIndex: 3, endIndex: 7 },
    { id: 'validation', title: 'Validation', startIndex: 8, endIndex: 9 },
  ],
  steps: [
    {
      id: 'intro',
      placement: 'center',
      title: 'Objectif du tutoriel',
      content: (
        <div className="space-y-2">
          <p>On va créer ensemble une <strong>entreprise de niveau 1</strong>, de l’ouverture de la fenêtre jusqu’à la validation finale.</p>
          <p className="text-muted-foreground">Prends n’importe quel type niveau 1 qui correspond à ton style de jeu.</p>
        </div>
      ),
      route: '/you?tab=travail',
    },
    {
      id: 'go-to-work-tab',
      targetId: 'you-tab-travail',
      placement: 'right',
      title: 'Onglet Travail',
      content: <p>Tout se passe ici : création, gestion et suivi de tes entreprises.</p>,
      actionText: 'Clique sur l’onglet Travail pour continuer.',
      route: '/you?tab=overview',
    },
    {
      id: 'open-create-business',
      targetId: 'travail-create-business-action',
      placement: 'right',
      title: 'Créer une entreprise',
      content: <p>Cette action ouvre le formulaire de création. Tu y choisis le type, le nom et le capital initial.</p>,
      actionText: 'Clique sur « Créer une entreprise ».',
      route: '/you?tab=travail',
    },
    {
      id: 'create-modal',
      targetId: 'create-business-modal',
      placement: 'auto',
      title: 'Fenêtre de création',
      content: <p>Tu es dans le bon formulaire. On va maintenant remplir chaque information nécessaire.</p>,
      route: '/you?tab=travail',
    },
    {
      id: 'choose-type',
      targetId: 'create-business-type',
      placement: 'auto',
      title: 'Choisis un type niveau 1',
      content: <p>Commence par sélectionner une activité <strong>niveau 1</strong>. C’est l’option idéale pour démarrer avec un risque maîtrisé.</p>,
      actionText: 'Clique sur le type d’activité puis sélectionne un business de niveau 1.',
      route: '/you?tab=travail',
    },
    {
      id: 'enter-name',
      targetId: 'create-business-name',
      placement: 'auto',
      title: 'Nomme ton entreprise',
      content: <p>Choisis un nom clair et mémorable. Ce nom apparaîtra partout dans ta gestion et dans les interactions sociales.</p>,
      actionText: 'Renseigne le champ « Nom ».',
      route: '/you?tab=travail',
    },
    {
      id: 'capital-tip',
      placement: 'center',
      title: 'Définis le capital de départ',
      content: (
        <div className="space-y-2">
          <p>Ajoute un capital initial suffisant pour lancer ton activité (achat de ressources, marge de sécurité, premières actions).</p>
          <p className="text-muted-foreground">Si tu choisis une banque, le fonctionnement est différent et le champ capital peut être absent.</p>
        </div>
      ),
      route: '/you?tab=travail',
    },
    {
      id: 'submit-business',
      targetId: 'create-business-submit',
      placement: 'left',
      title: 'Valider la création',
      content: <p>Quand tout est prêt, valide pour créer officiellement l’entreprise et débloquer sa gestion.</p>,
      actionText: 'Clique sur « Créer ».',
      route: '/you?tab=travail',
    },
    {
      id: 'check-owned-businesses',
      targetId: 'travail-owned-businesses',
      placement: 'auto',
      title: 'Vérifier le résultat',
      content: <p>Ta nouvelle structure doit apparaître dans <strong>Mes entreprises</strong>. C’est la preuve que la création est terminée.</p>,
      route: '/you?tab=travail',
    },
    {
      id: 'done',
      placement: 'center',
      title: 'Entreprise niveau 1 créée',
      content: (
        <div className="space-y-2">
          <p>Parfait, tu as terminé le cycle complet de création.</p>
          <p className="text-muted-foreground">Prochaine étape naturelle : ouvrir ton entreprise et configurer ses premières actions.</p>
        </div>
      ),
      route: '/you?tab=travail',
    },
  ],
};
