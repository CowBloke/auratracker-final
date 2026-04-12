import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

type UpdateCategory = 'BIG_FEATURE' | 'SMALL_FEATURE' | 'BUG_FIX';
const CATEGORIES: UpdateCategory[] = ['BIG_FEATURE', 'SMALL_FEATURE', 'BUG_FIX'];
const LEGACY_IMAGE_UPLOAD_ENTRY_ID = '2026-04-01-image-upload-reliability';
const CANONICAL_APRIL_FIRST_ENTRY_ID = '2026-04-01-ui-toasts-fixes';

type EntryWithItems = {
  id: string;
  date: string;
  title: string;
  summary: string;
  createdAt: Date;
  items: { id: string; category: string; text: string; order: number }[];
};

const SEED_ENTRIES = [
  {
    id: '2026-04-12-modules-fixes-admin-chat-auravision',
    date: '2026-04-12',
    title: 'Maintenance auto, modération chat et messages business',
    summary: 'Grosse passe de correctifs et d améliorations sur la modération (ban/mute), la maintenance automatique du week-end, la robustesse roulette/casino, la visio AuraVision, l admin utilisateur, les business, les messages, les uploads Aura Scroll et plusieurs corrections economiques et UI.',
    items: [
      { category: 'BUG_FIX', text: '**Bans enrichis partout** — Les payloads de ban HTTP/Socket incluent maintenant `userId` et `ban.id` (middleware auth, server socket, chat socket, action admin), et le frontend stocke ces identifiants meme quand ils arrivent via `ban.userId`.', order: 0 },
      { category: 'SMALL_FEATURE', text: '**Maintenance automatique week-end** — Nouveau flag `maintenance_auto_weekend_enabled` exposé en API maintenance et dans l admin: la maintenance peut s activer automatiquement le samedi et dimanche, en plus du mode manuel.', order: 1 },
      { category: 'BUG_FIX', text: '**Casino roulette anti double start** — Le backend verrouille le demarrage de manche par utilisateur (`activeCasinoStartLocks`) pour eviter les doubles requetes, et le frontend verrouille immediatement l UI avant l animation.', order: 2 },
      { category: 'SMALL_FEATURE', text: '**Roulette testée en isolation** — Ajout du helper `startRouletteRound` (start + refresh best effort) avec tests unitaires Vitest pour garantir le comportement en cas d echec de refresh utilisateur.', order: 3 },
      { category: 'BUG_FIX', text: '**Marketplace clan** — Les objets de type `CLAN_SLOT_UPGRADE` ne peuvent plus etre mis en vente sur la marketplace.', order: 4 },
      { category: 'BIG_FEATURE', text: '**Pack massif de badges auto** — Ajout d une large serie de nouveaux badges auto (quetes daily, speedrun, horaires de victoire, series, cadeaux, referrals, Polymarket, guerres de clan, collection complete, etc.).', order: 5 },
      { category: 'SMALL_FEATURE', text: '**Chat mute: contestation intégrée** — Quand un joueur est mute, le champ d envoi est desactive avec message explicite et formulaire de contestation direct vers le support.', order: 6 },
      { category: 'BUG_FIX', text: '**Chat sidebar: unread plus propre** — Le marquage des messages lus en bas de conversation ne se fait plus quand le panneau est fermé.', order: 7 },
      { category: 'BUG_FIX', text: '**Messages DM: auto-scroll intelligent** — Le scroll bas ne se declenche plus inutilement: il suit le changement de conversation et les nouveaux messages seulement si l utilisateur etait deja en bas.', order: 8 },
      { category: 'SMALL_FEATURE', text: '**Admin maintenance UX** — Le modal maintenance ajoute un switch dedie au mode auto week-end et l etat resume affiche correctement le mode actif.', order: 9 },
      { category: 'BUG_FIX', text: '**Admin utilisateurs: base aura/argent fiabilisée** — L edition utilisateur calcule maintenant le resultat depuis la base saisie dans le formulaire (solde direct), ce qui evite les ecarts de calcul sur ajout/retrait.', order: 10 },
      { category: 'SMALL_FEATURE', text: '**Admin signalements: snapshot complet lisible** — Le bloc des messages de contexte devient scrollable et affiche tout le snapshot avec retour a la ligne.', order: 11 },
      { category: 'SMALL_FEATURE', text: '**You/Explore: tri et pubs multiples** — Nouveau tri (avis, nombre d avis, recents, anciens, revenus) et rotation de plusieurs bannières pub dedupliquees au lieu d une seule.', order: 12 },
      { category: 'SMALL_FEATURE', text: '**Sidebar: logo You plus visible** — Le bouton logo recoit un nudge visuel (bounce/shadow) quand on peut ouvrir You pour rendre ce point d entree plus evident.', order: 13 },
      { category: 'BIG_FEATURE', text: '**AuraVision WebRTC plus robuste** — Ajout d une logique de negotiation parfaite (collision d offers), gestion prudente des ICE candidates et recovery automatique (ICE restart + timeout disconnect) pour limiter les decrochages.', order: 14 },
      { category: 'BIG_FEATURE', text: '**You: marche secondaire des actions** — Nouveau systeme complet de revente de parts de business: creation d annonce, achat, annulation, endpoints API dedies, serialisation dans l etat You, et persistance Prisma via `BusinessShareMarketListing`.', order: 15 },
      { category: 'BIG_FEATURE', text: '**Nouveau business illegal** — Ajout du type `illegal_market` (creation, balancing, menu, icone/couleurs/carte/explore) avec achats dedies et progression XP Illegalite cote vendeur et acheteur.', order: 16 },
      { category: 'SMALL_FEATURE', text: '**Ameliorations business illegales** — Le business illegal gagne des upgrades achetables sur tresorerie (revenu, satisfaction, XP), exposes dans l UI de gestion et sauvegardes dans `customData`.', order: 17 },
      { category: 'SMALL_FEATURE', text: '**Profil: courbe aura/argent 30 jours** — Nouvelle API `/users/:id/economy-history` et nouveau graphique sur le profil pour suivre l evolution quotidienne de l aura et de l argent.', order: 18 },
      { category: 'SMALL_FEATURE', text: '**Messagerie DM: ticks lu/non lu** — La liste des conversations affiche maintenant l etat de lecture du dernier message sortant (`check` / `double check`) selon `lastReadAt` des participants.', order: 19 },
      { category: 'SMALL_FEATURE', text: '**Navigation You enrichie** — Nouvel onglet `Marche actions` dans la sidebar + presence chat + i18n, et rendu de l onglet dans la page You.', order: 20 },
      { category: 'BUG_FIX', text: '**Business invites: droits manager** — L invitation de membres ne repose plus sur un simple participant, mais sur la verification manager, pour eviter les invitations non autorisees.', order: 21 },
      { category: 'SMALL_FEATURE', text: '**Banque: visibilite remboursement client** — L interface de gestion des prets affiche maintenant les finances du client (money/aura), indique s il peut solder immediatement, et clarifie le bouton de remboursement integral cote emprunteur.', order: 22 },
      { category: 'BUG_FIX', text: '**Salaires business fiabilises** — Le paiement journalier verifie maintenant la prise du jour dans la transaction avant de debiter la tresorerie et de crediter le joueur, ce qui evite les doubles paiements en cas de requetes concurrentes.', order: 23 },
      { category: 'BUG_FIX', text: '**Revenus bancaires securises** — Les interets journaliers des comptes epargne ne sont plus verses si la ligne business a deja ete reclamee pour la journee, ce qui evite les doublons de revenus et les calculs partiels.', order: 24 },
      { category: 'SMALL_FEATURE', text: '**Chat: details des reactions** — Les reactions deviennent cliquables et ouvrent un panneau listant les utilisateurs qui ont reagit, avec aperçu du message d origine.', order: 25 },
      { category: 'SMALL_FEATURE', text: '**Admin utilisateurs: repartition par classe** — Un nouveau tableau regroupe les utilisateurs par classe avec leur aura, leur tri interne et un comptage par groupe.', order: 26 },
      { category: 'SMALL_FEATURE', text: '**Admin roles: badges unifies** — Les badges de roles administrateur utilisent maintenant une logique unique avec les libelles normalises pour super admin, admin, beta tester, fiscal inspector et judge.', order: 27 },
      { category: 'BUG_FIX', text: '**Business: action invest debloquee** — Plusieurs types d entreprise peuvent maintenant utiliser l action `invest`, ce qui aligne les actions disponibles avec le reste de la gestion business.', order: 28 },
      { category: 'BUG_FIX', text: '**Business: invitations synchronisees** — Les notifications d invitation se mettent maintenant a jour apres acceptation ou refus, avec le bon statut et la bonne disponibilite des actions cote utilisateur.', order: 29 },
      { category: 'BIG_FEATURE', text: '**Messages: onglet Affaires dedie** — La page Messages separe maintenant les conversations business du reste des messages, avec un onglet dedie, son tri propre et une navigation plus claire.', order: 30 },
      { category: 'SMALL_FEATURE', text: '**Messages et chat: export JSON admin** — Les admins peuvent maintenant exporter une conversation ou le chat complet en JSON depuis l interface, pour faciliter les controles et le support.', order: 31 },
      { category: 'SMALL_FEATURE', text: '**Admin: limites jeux visibles** — Un nouvel onglet `Limites jeux` a ete ajoute dans l administration pour centraliser les regles et plafonds de jeu.', order: 32 },
      { category: 'BUG_FIX', text: '**Aura Scroll: uploads plus robustes** — Les uploads images/videos acceptent mieux les types MIME avec parametres, les limites passent a 12 Mo pour les images et 15 Mo pour les videos, et un retry automatique couvre les erreurs reseau temporaires.', order: 33 },
      { category: 'BUG_FIX', text: '**Aura Scroll: selections file mieux gerees** — Le selecteur video refuse les lots de plusieurs fichiers, et les champs de fichier sont reinitialises apres selection pour permettre de re-uploader le meme media.', order: 34 },
      { category: 'BUG_FIX', text: '**Clans: fin de guerre basee sur l heure** — Les guerres de clan se terminent maintenant uniquement a l heure prevue, ce qui evite les clotures prematurees sur simple score.', order: 35 },
      { category: 'BUG_FIX', text: '**Uploads: MIME normalises** — Les types MIME sont maintenant nettoyes des parametres `; charset=...` avant validation, ce qui evite de refuser des fichiers valides.', order: 36 },
      { category: 'BUG_FIX', text: '**Marketplace: usage d objet plus strict et compatible** — Le type d objet est maintenant normalise (`trim + uppercase`), les effets consommables lisent plusieurs cles (`bonusAura/auraBonus/aura`, `bonusMoney/moneyBonus/money/cash`), et les objets sans effet exploitable renvoient une erreur 400 explicite au lieu d un succes silencieux.', order: 37 },
      { category: 'BUG_FIX', text: '**Revenus business quotidiens fiabilises** — Le credit journalier est traite business par business avec garde transactionnelle anti double credit, notifications separees actionnaires/proprietaire, et emission des mises a jour de solde partage pour tous les comptes impactes.', order: 38 },
      { category: 'SMALL_FEATURE', text: '**Historique prets business etendu** — La vue des prets d un business remonte maintenant jusqu a 100 lignes recentes (au lieu de 8) pour offrir un suivi complet en gestion.', order: 39 },
    ],
  },
  {
    id: '2026-04-11-adblock-global',
    date: '2026-04-11',
    title: 'Adblock — Effet étendu à tout le site',
    summary: 'L\'effet Adblock supprime maintenant les publicités sur toutes les pages du site, et l\'indicateur est visible dans la barre de navigation globale.',
    items: [
      { category: 'BUG_FIX', text: '**Adblock global** — Les publicités (bannières et cartes) sont maintenant masquées sur toutes les pages (Inventaire, Jeux, Shop, Polymarket, Classements) quand l\'effet Adblock est actif, plus uniquement sur You.', order: 0 },
      { category: 'SMALL_FEATURE', text: '**Indicateur Adblock** — Un badge "Adblock actif" s\'affiche dans la barre de navigation sur toutes les pages tant que l\'effet est en cours.', order: 1 },
    ],
  },
  {
    id: '2026-04-11-subway-opengd-playable',
    date: '2026-04-11',
    title: 'Subway Surfers Clone & OpenGD maintenant jouables',
    summary: 'Les deux jeux étaient bloqués sur une page "build manquant" — remplacés par des implémentations HTML5 canvas jouables directement dans le navigateur.',
    items: [
      { category: 'BIG_FEATURE', text: '**Subway Surfers Clone** — Runner 3 voies pseudo-3D jouable : changement de voie (←→), saut (↑), glissade (↓), pièces, obstacles variés et vitesse progressive.', order: 0 },
      { category: 'BIG_FEATURE', text: '**OpenGD** — Platformer Geometry Dash-style jouable : sauts, double saut, orbes, obstacles procéduraux, thèmes de couleur qui changent et score persistant.', order: 1 },
    ],
  },
  {
    id: '2026-04-11-page-informations',
    date: '2026-04-11',
    title: 'Nouvelle page Informations',
    summary: 'Ajout d\'une page Informations avec les paliers d\'imposition en temps réel et une structure de tutoriels.',
    items: [
      { category: 'SMALL_FEATURE', text: '**Page Informations** — Nouvelle page accessible depuis la barre latérale avec deux onglets : Informations (paliers fiscaux mis à jour dynamiquement depuis l\'admin) et Tutoriels (structure en place, contenu à venir).', order: 0 },
    ],
  },
  {
    id: '2026-04-10-judge-fiscal-panel-access',
    date: '2026-04-10',
    title: 'Administration — Acces inspection fiscale pour les juges',
    summary: 'Les juges peuvent maintenant ouvrir le panel admin en mode lecture seule et consulter la meme vue inspection fiscale que les inspecteurs du fisc.',
    items: [
      { category: 'SMALL_FEATURE', text: '**Admin · Vue inspection fiscale partagée** — Les juges disposent maintenant du meme acces lecture seule que les inspecteurs du fisc dans le panel admin, avec les onglets logs, impots et inspection fiscale.', order: 0 },
    ],
  },
  {
    id: '2026-04-10-bug-fixes-race-condition-notifs',
    date: '2026-04-10',
    title: 'Corrections de bugs — double claim, defis duels, notifications',
    summary: 'Correction d une race condition sur le pass quotidien, fuite de defis en duel quand la cible se deconnecte, journalisation des echecs de notifications, ajouts de confort dans la messagerie judiciaire et Messages, et Aura Scroll devient infini avec ordre melange.',
    items: [
      { category: 'BUG_FIX', text: '**Pass quotidien · Double claim impossible** — La verification "deja reclamé aujourd\'hui" est maintenant effectuee a l interieur de la transaction Prisma, ce qui empeche deux requetes simultanees d accorder deux fois les recompenses.', order: 0 },
      { category: 'BUG_FIX', text: '**Duels · Defi annule quand la cible se deconnecte** — Quand le joueur cible d un defi se deconnecte, le defi est maintenant annule immediatement (timer stoppe, challenger notifie), au lieu de rester en attente jusqu a expiration.', order: 1 },
      { category: 'BUG_FIX', text: '**Notifications · Echecs journalises** — Les erreurs de creation de notification ne sont plus silencieusement ignorees ; elles apparaissent maintenant dans les logs serveur pour faciliter le debug.', order: 2 },
      { category: 'BUG_FIX', text: '**Jeux · Plafond argent applique par jeu** — Le plafond journalier d argent des jeux est maintenant calcule par type de jeu (et non plus globalement sur tous les jeux), pour eviter qu un jeu bloque les gains des autres.', order: 3 },
      { category: 'SMALL_FEATURE', text: '**Justice · Pseudos visibles pour les juges** — Dans les dossiers judiciaires, les juges voient maintenant les pseudos des participants affiches entre parentheses a cote de leur role.', order: 4 },
      { category: 'SMALL_FEATURE', text: '**Justice · Apercu image plein ecran** — Les images envoyees dans un dossier judiciaire s ouvrent maintenant en plein ecran au clic, comme dans le reste de la messagerie.', order: 5 },
      { category: 'SMALL_FEATURE', text: '**Messages · Corbeille au survol** — Dans les conversations, le bouton de suppression admin se place maintenant au bord du message et n apparait qu au survol, pour rester plus discret tout en restant accessible.', order: 6 },
      { category: 'SMALL_FEATURE', text: '**Aura Scroll · Feed infini melange** — Le scroll continue maintenant en boucle sans ecran de fin, avec un ordre aleatoire par cycle pour eviter de revoir toujours les videos dans la meme sequence.', order: 7 },
      { category: 'SMALL_FEATURE', text: '**Echecs · Navigation historique des coups** — Pendant une partie ou en spectateur, vous pouvez maintenant revisiter les coups precedents avec les boutons de navigation (debut/precedent/suivant/direct) ou le clavier (`←`, `→`, `Home`, `End`) comme sur chess.com.', order: 8 },
    ],
  },
  {
    id: '2026-04-09-inbox-group-chat-notifications',
    date: '2026-04-09',
    title: 'Inbox - Notifications de chat regroupees',
    summary: 'Les notifications de chat ne s empilent plus message par message: elles sont regroupees par conversation et mises a jour avec le dernier message. Le modal admin de modification utilisateur permet aussi de saisir directement l aura finale cible. Les juges de dossier peuvent maintenant valider l ajout d un temoin directement dans le fil de discussion. Cette journee ajoute aussi des statistiques de parrainage dans l admin, une gestion pub simplifiee et plus complete, ainsi que des items de boutique personnalises avec suivi dans l inventaire.',
    items: [
      { category: 'BUG_FIX', text: '**Inbox chat regroupee** — Pour une meme conversation (Messages prives) ou un meme chat de clan, les nouveaux messages mettent maintenant a jour une notification unique au lieu d en creer plusieurs.', order: 0 },
      { category: 'BUG_FIX', text: '**Admin utilisateurs · Aura finale directe** — Dans le modal de modification utilisateur, le champ aura attend maintenant directement le total cible (au lieu d un +/−), avec affichage de la variation calculee automatiquement.', order: 1 },
      { category: 'BUG_FIX', text: '**Justice · Validation temoin** — Dans un dossier judiciaire, le juge du dossier peut maintenant valider l ajout d un temoin directement au message de demande, sans devoir passer par les droits admin globaux.', order: 2 },
      { category: 'BIG_FEATURE', text: '**Admin · Statistiques de parrainage** — Un nouvel ecran `Referrals` a ete ajoute au panel admin avec funnel complet (codes, invites approuves/en attente, conversions, recompenses versees) et classement des meilleurs parrains.', order: 3 },
      { category: 'SMALL_FEATURE', text: '**Publicites simplifiees** — La creation de pub utilise maintenant un format unique (plus de selection CARD/BANNER/INTERSTITIAL), puis la diffusion publique reutilise les pubs actives sur les placements du site.', order: 4 },
      { category: 'SMALL_FEATURE', text: '**Admin · Moderation pubs et suppression definitive** — La boite de reception admin affiche maintenant toutes les pubs (pas seulement en attente), avec action de suppression definitive et notification au proprietaire.', order: 5 },
      { category: 'BIG_FEATURE', text: '**Epiceries/Restaurants · Articles personnalises + inventaire achats** — Les menus peuvent inclure image/emoji par article, et chaque achat est maintenant enregistre dans un onglet `Achats` de l inventaire du joueur.', order: 6 },
      { category: 'SMALL_FEATURE', text: '**Cabinets d avocats · Roles metier** — Le profil avocat permet maintenant de choisir un vrai titre (Associe, Collaborateur, Stagiaire, Of Counsel...), avec gestion et tri plus lisibles cote equipe.', order: 7 },
      { category: 'BUG_FIX', text: '**Justice · Groupes dossier securises** — Les conversations de dossier limitent maintenant le renommage/ajout de membres aux admins, et les demandes de temoin des parties passent par un flux dedie.', order: 8 },
      { category: 'BUG_FIX', text: '**Marketplace · URL image skin simplifiee** — Le calcul de l image de skin dans les statistiques du marche utilise maintenant directement `stat.effect`, ce qui supprime un cast inutile et fiabilise la recuperation de l URL.', order: 9 },
    ],
  },
  {
    id: '2026-04-08-skeleton-loading-screens',
    date: '2026-04-08',
    title: 'Chargement - Ecrans skeleton partout',
    summary: 'Les principales pages affichent désormais des skeleton screens cohérents à la place des textes de chargement et des spinners bruts.',
    items: [
      { category: 'SMALL_FEATURE', text: '**Boot app** — L\'écran de chargement global et les redirections protégées utilisent maintenant un skeleton plein écran au lieu d\'un texte "Chargement...".', order: 0 },
      { category: 'SMALL_FEATURE', text: '**Pages clés** — YOU, Messages, Inbox, Changelog, Settings, Inventory, Marketplace, Leaderboards, Clash Village, Polytrack et Clans affichent désormais des placeholders adaptés à leur mise en page.', order: 1 },
      { category: 'SMALL_FEATURE', text: '**Chat et listes** — Les vues de messagerie et de classement utilisent des squelettes de conversation, de tableau et de liste pour garder la structure visible pendant le chargement.', order: 2 },
      { category: 'SMALL_FEATURE', text: '**Admin · Répartition utilisateurs** — Un nouvel onglet `Répartition` a été ajouté dans le dashboard admin avec des graphes par niveau et par classe, les moyennes Aura/Argent par classe et un top des joueurs par niveau.', order: 3 },
      { category: 'SMALL_FEATURE', text: '**Admin · Ajustement Répartition** — Le bloc `Répartition par sexe` a été retiré de l\'onglet pour conserver un focus sur les statistiques classe/niveau demandées.', order: 4 },
      { category: 'BUG_FIX', text: '**Hub Jeux · Raccourci Soccer** — Le raccourci direct vers la table `Soccer` a été retiré de la page Jeux pour éviter l\'accès rapide dédié depuis le catalogue.', order: 5 },
    ],
  },
  {
    id: '2026-04-08-admin-forced-divorce',
    date: '2026-04-08',
    title: 'Administration — Divorce forcé dans la liste utilisateurs',
    summary: 'Les admins peuvent désormais dissoudre immédiatement un mariage depuis la liste des utilisateurs.',
    items: [
      { category: 'SMALL_FEATURE', text: '**Users · Divorce forcé** — Un nouveau bouton permet aux admins de forcer la dissolution d’un mariage depuis la liste des utilisateurs. Le compte commun est partagé, les demandes en attente sont nettoyées et la relation repasse en état divorcé.', order: 0 },
    ],
  },
  {
    id: '2026-04-07-xp-system-overhaul',
    date: '2026-04-07',
    title: 'Système XP — Toutes les actions récompensées',
    summary: 'Chaque action du jeu rapporte ou retire maintenant de l\'XP dans la compétence correspondante : mariage, divorce, prêts, investissements, ventes, justice, business et plus encore.',
    items: [
      { category: 'BIG_FEATURE', text: '**XP sur toutes les actions** — L\'ensemble des actions du jeu alimentent désormais l\'XP : créer une entreprise, encaisser un prêt, rembourser, investir, se marier, divorcer, acheter, vendre, déposer une plainte, plaider, etc.', order: 0 },
      { category: 'BIG_FEATURE', text: '**Proportionnel aux montants** — Les XP Finance et Affaires sont proportionnels aux sommes engagées (ex. prêt de 10 000€ = plus d\'XP qu\'un prêt de 500€), ce qui évite le spam de petites actions.', order: 1 },
      { category: 'BIG_FEATURE', text: '**Justice et XP** — Le juge peut désormais indiquer si le plaignant gagne ou perd lors du verdict. Le gagnant gagne du Social XP, le perdant en perd.', order: 2 },
      { category: 'SMALL_FEATURE', text: '**Divorce = pénalité** — Accepter un divorce retire 15 points d\'XP Social aux deux parties.', order: 3 },
      { category: 'SMALL_FEATURE', text: '**Mariage = bonus** — Accepter un mariage rapporte 20 XP Social aux deux et 10 XP Charisme au demandeur.', order: 4 },
      { category: 'SMALL_FEATURE', text: '**Startup renforcée** — Lancer une recherche rapporte Affaires + Intelligence XP. Déployer un produit rapporte Affaires XP proportionnel au niveau déployé.', order: 5 },
      { category: 'SMALL_FEATURE', text: '**Remboursement de prêt** — Rembourser intégralement un prêt rapporte 10 XP Finance (comportement financier responsable).', order: 6 },
    ],
  },
  {
    id: '2026-04-07-messages-group-info-modal',
    date: '2026-04-07',
    title: 'Messagerie — Gestion des groupes & Amendes Admin',
    summary: "Les groupes de discussion s'ouvrent maintenant dans une fiche unique. Les administrateurs peuvent désormais appliquer des amendes aux utilisateurs avec montant configurable.",
    items: [
      { category: 'SMALL_FEATURE', text: "**Fiche de groupe unifiée** — Le titre d'un groupe ouvre désormais un panneau unique pour modifier le nom, l'icône, la photo et gérer les membres sans passer par plusieurs menus.", order: 0 },
      { category: 'SMALL_FEATURE', text: "**Amendes administrateur** — Les admins peuvent maintenant appliquer des amendes avec montant configurable via un slider (10—5000). L'amende s'affiche en rouge sur l'écran de l'utilisateur sanctionné.", order: 1 },
      { category: 'BUG_FIX', text: "**Bouton Message depuis un profil** — Cliquer sur `Message` depuis le profil d'un joueur ouvre maintenant bien sa conversation DM dans l'onglet Messages, au lieu de basculer par erreur sur une conversation support.", order: 2 },
    ],
  },
  {
    id: '2026-04-06-prisma-studio',
    date: '2026-04-06',
    title: 'Accès sécurisé à Prisma Studio',
    summary: 'Les administrateurs peuvent désormais lancer et accéder à Prisma Studio directement depuis le panel.',
    items: [
      { category: 'BIG_FEATURE', text: '**Prisma Studio** — Ajout d\'un bouton dans l\'administration permettant aux super admins de lancer et d\'ouvrir une instance sécurisée de Prisma Studio (proxy avec support webSockets).', order: 0 },
    ],
  },
  {
    id: '2026-04-06-restaurant-business',
    date: '2026-04-06',
    title: 'Améliorations des Business & Nouveau type Restaurant',
    summary: 'Ajout de restaurants modulables. Rôles des associés étendus (pouvoirs complets), remboursements automatiques en cas de liquidation bancaire, corrections sur les formations et les mariages polygames.',
    items: [
      { category: 'BIG_FEATURE', text: '**Restaurant** — Nouvelle catégorie de business niveau 1. Permet de vendre et d\'acheter des burgers, pizzas, poulet frit et sodas pour vos besoins quotidiens.', order: 0 },
      { category: 'BIG_FEATURE', text: '**Menu personnalisable** — Les propriétaires de restaurants peuvent maintenant modifier entièrement leur menu (noms des plats, prix, emojis, **sections ordonnées et glisser-déposer**) depuis l\'onglet Gérer.', order: 1 },
      { category: 'SMALL_FEATURE', text: '**Données modulaires** — Refonte technique : passage à un champ générique de données personnalisées pour préparer le terrain aux futurs types d\'entreprises configurables.', order: 2 },
      { category: 'BIG_FEATURE', text: '**Rôle Associé dans les Business** — Un employé embauché comme "associé", "associée", ou "partner" bénéficie désormais **exactement des mêmes droits** que le créateur du business (gestion, retraits, actions).', order: 3 },
      { category: 'SMALL_FEATURE', text: '**Faillites Bancaires** — En cas de liquidation ou suppression d\'une banque, l\'argent déposé par l\'ensemble des clients (comptes courants) est **automatiquement restitué** au lieu d\'être perdu.', order: 4 },
      { category: 'BUG_FIX', text: '**Infidélité** — Le fait qu\'un(e) conjoint(e) soit marié(e) ou en couple avec une **autre personne simultanément** compte logiquement comme de la tricherie (onglet Social).', order: 5 },
      { category: 'BUG_FIX', text: '**Avis des formations** — Résolution du prompt d\'avis redondant qui se rouvrait lors de chaque consultation d\'une formation acquise, bloquant aléatoirement l\'envoi (les avis à "0" ne sont plus un problème).', order: 6 },
    ],
  },
  {
    id: '2026-04-04-justice-system',
    date: '2026-04-04',
    title: 'Système judiciaire — Cour Suprême & Cabinets d\'avocats',
    summary: 'Un système judiciaire complet fait son entrée : déposez des plaintes formelles, ouvrez des dossiers avec juges, avocats et plaidoiries, et prononcez des verdicts depuis la messagerie.',
    items: [
      { category: 'BIG_FEATURE', text: '**Cour Suprême** — Nouvelle institution d\'État visible en tête de la page Entreprises. Permet de déposer une plainte formelle contre un autre joueur (titre, description, preuves).', order: 0 },
      { category: 'BIG_FEATURE', text: '**Cabinets d\'avocats** — Nouvelle catégorie d\'entreprise. Un cabinet peut représenter une partie lors d\'un procès.', order: 1 },
      { category: 'BIG_FEATURE', text: '**Dossiers judiciaires** — Quand un admin accepte une plainte, un groupe de messagerie est automatiquement créé avec les admins en rôle de Juge, et les deux parties assignées. Chaque rôle a sa propre couleur dans le chat.', order: 2 },
      { category: 'BIG_FEATURE', text: '**Plaidoiries confidentielles** — Chaque partie peut soumettre un argument écrit visible uniquement par les juges. Accès via le bouton "Plaidoiries" dans le bandeau du dossier.', order: 3 },
      { category: 'BIG_FEATURE', text: '**Verdict & sanction** — Les juges peuvent changer le statut du dossier (En cours → Délibération → Verdict rendu) et rédiger un verdict officiel avec sanction optionnelle, affiché dans le fil de messagerie.', order: 4 },
      { category: 'SMALL_FEATURE', text: '**Interface admin** — Dans la Cour Suprême, les admins voient les plaintes en attente avec boutons Accepter / Rejeter. Accepter ouvre automatiquement le dossier et redirige vers le groupe de messagerie.', order: 5 },
      { category: 'SMALL_FEATURE', text: '**Sélecteur de rôle** — Dans un groupe de tribunal, les admins peuvent choisir en quel rôle ils envoient leurs messages (Juge, Défenseur public plaignant, Défenseur public défendeur, etc.).', order: 6 },
    ],
  },
  {
    id: '2026-04-04-xp-system-skills',
    date: '2026-04-04',
    title: 'Système XP automatique & score Illégalité',
    summary: 'Les compétences You gagnent maintenant de l\'XP automatiquement via vos actions. L\'agence immobilière vend des biens, un score Illégalité est introduit, la page Salle de marché est allégée, Polymarket sépare désormais les événements résolus dans un historique dédié, les switchers liste/grille sont harmonisés, l\'avatar utilisateur de la top bar revient en affichage rond sans card, les badges non lus de sidebar restent visibles même en mode réduit, et les icônes de monnaie sont maintenant unifiées avec la topbar partout sur le site.',
    items: [
      { category: 'BIG_FEATURE', text: '**XP automatique** — Les compétences progressent via vos actions : Affaires (collecte NPC), Finance (dépôt en banque), Intelligence (achat de formations), Charisme (aura reçue), Social (achat immobilier via agence).', order: 0 },
      { category: 'BIG_FEATURE', text: '**Agence immobilière** — Achetez des biens immobiliers (Studio, T3, Maison, Villa) depuis une agence pour gagner du XP Social.', order: 1 },
      { category: 'SMALL_FEATURE', text: '**Score Illégalité** — Un nouveau score lié aux activités du marché noir est introduit (XP obtenu via activités illégales à venir).', order: 2 },
      { category: 'BUG_FIX', text: '**Achat en limonade/épicerie corrigé** — Les boutons "Acheter" des stands de limonade et épiceries fonctionnent maintenant correctement.', order: 3 },
      { category: 'BUG_FIX', text: '**Sidebar marché corrigée** — Sur la page marketplace, la navigation ne met plus en surbrillance deux entrées en même temps (`/market` et `/marketplace`). L’état actif repose maintenant sur un vrai segment de route.', order: 4 },
      { category: 'BUG_FIX', text: '**Erreur React Hooks sur Quêtes corrigée** — Le crash `Rendered more hooks than during the previous render` a été corrigé en garantissant un ordre de hooks stable.', order: 5 },
      { category: 'SMALL_FEATURE', text: '**Filtres marketplace allégés** — La barre de recherche et les menus déroulants du marketplace reviennent en affichage direct, sans card ni texte d’en-tête ajouté, pour rester cohérents avec l’UI du site.', order: 5 },
      { category: 'SMALL_FEATURE', text: '**Salle de marché simplifiée** — Le grand bandeau d’introduction (titre descriptif et bloc "Coin à surveiller") a été retiré pour laisser un accès direct aux trois cartes de coins.', order: 6 },
      { category: 'SMALL_FEATURE', text: '**Marketplace épuré** — Le bandeau d’introduction communautaire (titre, texte, boutons et stats) ainsi que l’en-tête `Marché` ont été retirés pour afficher directement les onglets et les listings.', order: 7 },
      { category: 'SMALL_FEATURE', text: '**Page Quêtes plus pratique** — La page Quêtes propose maintenant une barre de recherche, un tri via menu déroulant et un switch de vue liste / grille (3 colonnes), sans encadrement en card pour ces contrôles.', order: 8 },
      { category: 'SMALL_FEATURE', text: '**Polymarket, historique résolus dédié** — Les événements résolus ne s’affichent plus dans l’onglet `Événements` et passent dans un onglet dédié. La vue met en avant des métriques globales du site (nombre de paris et volume total misé) au lieu des choix individuels.', order: 9 },
      { category: 'SMALL_FEATURE', text: '**Switch liste/grille unifié** — Les pages avec bascule de vue (`Inventaire`, `Suggestions`, `Polymarket`, `Quêtes`) utilisent désormais exactement le même composant et le même style, avec le switch aligné à droite de la ligne de filtres.', order: 10 },
      { category: 'BUG_FIX', text: '**Avatar top bar sans card** — Le menu utilisateur dans la barre du haut n\'utilise plus de conteneur ovale: seul l\'avatar (photo/icone) rond reste visible.', order: 11 },
      { category: 'SMALL_FEATURE', text: '**Page Pass ultra-minimaliste** — L\'UI de la page Pass a été simplifiée au maximum: suppression des textes non essentiels, retrait du titre `Pass`, suppression des dégradés, retour du compte à rebours et barre de progression en noir.', order: 12 },
      { category: 'SMALL_FEATURE', text: '**Badge Messages en sidebar réduite** — La pastille de non lus de la page Messagerie reste maintenant visible aussi quand la sidebar est en mode `collapsed` (icône).', order: 13 },
      { category: 'SMALL_FEATURE', text: '**Badge Changelog en sidebar réduite** — La pastille rouge du Changelog reste maintenant visible aussi quand la sidebar est en mode `collapsed` (icône).', order: 14 },
      { category: 'BUG_FIX', text: '**Ordre des conversations Messages auto-mis à jour** — Sur la page Messages, la liste des conversations se réordonne maintenant automatiquement selon le dernier message reçu/envoyé, pour toujours remonter les discussions les plus récentes.', order: 15 },
      { category: 'SMALL_FEATURE', text: '**Icônes de monnaie harmonisées** — L\'aura et l\'argent utilisent désormais partout les mêmes pictos que la topbar : éclair jaune pour l\'aura et pièce verte pour l\'argent, y compris dans Pass, Quêtes, Inbox, classements, clans et les écrans d\'admin.', order: 16 },
    ],
  },
  {
    id: '2026-04-04-buyout-limit-one',
    date: '2026-04-04',
    title: 'Rachat d\'entreprise : limite d\'une par joueur',
    summary: 'Un joueur ne peut désormais racheter qu\'une seule entreprise au maximum.',
    items: [
      { category: 'SMALL_FEATURE', text: '**Limite de rachat** — Il est maintenant impossible de faire une offre de rachat si vous possédez déjà une entreprise. La limite est d\'une entreprise rachetée par joueur.', order: 0 },
    ],
  },
  {
    id: '2026-04-04-business-capital-debit',
    date: '2026-04-04',
    title: 'Création d\'entreprise : capital de départ débité',
    summary: 'Le capital de départ saisi lors de la création d\'une entreprise est maintenant correctement prélevé sur le compte du joueur en plus des frais de création.',
    items: [
      { category: 'BUG_FIX', text: '**Capital de départ débité à la création** — Auparavant, le capital initial était placé dans la trésorerie de l\'entreprise sans être déduit du solde du joueur. Il est maintenant correctement prélevé.', order: 0 },
    ],
  },
  {
    id: '2026-04-04-startup-treasury',
    date: '2026-04-04',
    title: 'Startups : dépenses sur la trésorerie',
    summary: 'Les coûts de recherche des produits startup sont désormais prélevés sur la trésorerie de l\'entreprise, et non plus sur le compte personnel du joueur.',
    items: [
      { category: 'BUG_FIX', text: '**Financement startup via trésorerie** — Lancer une recherche de produit débite maintenant la trésorerie de la startup. Assurez-vous d\'y déposer des fonds avant de lancer une recherche.', order: 0 },
    ],
  },
  {
    id: '2026-04-04-sound-effects',
    date: '2026-04-04',
    title: 'Effets sonores',
    summary: 'Le site dispose maintenant d\'effets sonores pour les notifications, les récompenses et les interactions clés, avec une option d\'activation et de volume dans les paramètres.',
    items: [
      { category: 'BIG_FEATURE', text: '**Effets sonores** — Des sons synthétiques (aucun fichier audio requis) jouent automatiquement lors des notifications, récompenses et interactions. Tout est généré via l\'API Web Audio.', order: 0 },
      { category: 'SMALL_FEATURE', text: '**Paramètres Sons** — Une nouvelle section "Sons" dans les Paramètres permet d\'activer/désactiver les sons et de régler le volume. Un bouton d\'aperçu permet de tester chaque type de son.', order: 1 },
    ],
  },
  {
    id: '2026-04-04-clan-events-system',
    date: '2026-04-04',
    title: 'Événements de clan hebdomadaires',
    summary: "Un nouveau système d'événements de clan permet de lancer des semaines compétitives avec quêtes, mini-jeux, classement et récompenses gérés depuis l'admin.",
    items: [
      { category: 'BIG_FEATURE', text: "**Événements de clan complets** — Les clans peuvent maintenant participer à des événements limités dans le temps avec début/fin, score global, historique d'activité et classement final.", order: 0 },
      { category: 'BIG_FEATURE', text: "**Quêtes d'événement** — Chaque événement peut contenir plusieurs quêtes reliées aux activités du jeu et des clans, avec progression et attribution automatique des points au clan.", order: 1 },
      { category: 'BIG_FEATURE', text: "**Mini-jeux d'événement** — Les événements supportent maintenant des mini-jeux jouables directement depuis la page Clans, avec score, cooldown, nombre max de tentatives et conversion du score en points de clan.", order: 2 },
      { category: 'BIG_FEATURE', text: "**Récompenses par rang** — À la fin de l'événement, le classement des clans est figé automatiquement et les membres reçoivent des récompenses par palier de rang avec argent, aura et objet optionnel.", order: 3 },
      { category: 'SMALL_FEATURE', text: "**Hub événement dans la page Clans** — Un nouvel onglet affiche l'événement en cours, le top des clans, la progression des quêtes, l'activité récente et les récompenses prévues.", order: 0 },
      { category: 'SMALL_FEATURE', text: "**Dashboard admin** — L'administration peut maintenant créer, modifier et supprimer des événements de clan avec leur bannière, leurs quêtes, leurs mini-jeux et leurs paliers de récompense.", order: 1 },
    ],
  },
  {
    id: '2026-04-04-aura-games-clarified',
    date: '2026-04-04',
    title: "Jeux qui rapportent de l'aura",
    summary: "Le changelog précise maintenant quels jeux donnent actuellement de l'aura et lesquels n'en donnent pas côté serveur.",
    items: [
      { category: 'SMALL_FEATURE', text: "**Récompenses d'aura clarifiées** — Les jeux qui donnent actuellement de l'aura sont désormais explicités, avec distinction entre les jeux vraiment récompensés et ceux simplement présents dans le hub.", order: 0 },
      { category: 'BUG_FIX', text: "**Jeux sans gain d'aura distingués** — Le changelog mentionne aussi les jeux visibles dans le catalogue mais sans gain d'aura pour le moment côté logique serveur.", order: 0 },
    ],
  },
  {
    id: '2026-04-04-casino-badges-expansion',
    date: '2026-04-04',
    title: 'Casino — beaucoup plus de badges',
    summary: "Le casino gagne une vraie collection de badges autour du volume de parties, des victoires, des défaites, des jackpots et des classements spéciaux, et le chat permet maintenant de charger les messages plus anciens depuis le haut de la conversation.",
    items: [
      { category: 'BIG_FEATURE', text: "**Collection casino enrichie** — Le casino dispose maintenant d'une large série de badges dédiés au jeu régulier, avec des paliers de participation sur 1, 10, 25, 50 et 100 parties.", order: 0 },
      { category: 'BIG_FEATURE', text: "**Badges de victoires et de défaites** — De nouveaux badges tombent désormais selon le nombre de wins et de losses au casino, pour mieux récompenser autant les gros veinards que les habitués de la ruine.", order: 1 },
      { category: 'BIG_FEATURE', text: "**Jackpots et domination casino** — Des badges spéciaux ont été ajoutés pour les jackpots majeurs ainsi que pour le joueur avec le plus de victoires au casino.", order: 2 },
      { category: 'SMALL_FEATURE', text: "**Attribution immédiate** — Les badges casino concernés sont recalculés juste après chaque partie, sans attendre un recalcul global du système de badges.", order: 0 },
      { category: 'SMALL_FEATURE', text: "**Historique du chat** — Quand on remonte tout en haut du chat, un bouton permet maintenant de charger les messages plus anciens sans perdre sa position de lecture.", order: 1 },
    ],
  },
  {
    id: '2026-04-04-daily-racer-rewards',
    date: '2026-04-04',
    title: 'Daily Racer et Chrome Dino',
    summary: "Le classement Daily Racer suit maintenant minuit Paris avec récompenses automatiques du top 3, et Chrome Dino affiche des récompenses un peu mieux calibrées et plus lisibles.",
    items: [
      { category: 'BIG_FEATURE', text: "**Récompenses du classement journalier** — À 00h00 (heure de Paris), les 3 meilleurs temps du Daily Racer de la veille reçoivent automatiquement une récompense selon leur position au classement.", order: 0 },
      { category: 'SMALL_FEATURE', text: "**Message inbox automatique** — Les gagnants reçoivent maintenant un message dans l'inbox récapitulant leur place et les gains obtenus.", order: 0 },
      { category: 'SMALL_FEATURE', text: "**Chrome Dino reequilibre** — Les recompenses commencent maintenant un peu plus tot et les gros scores paient mieux, avec un bonus de nouveau record legerement augmente.", order: 1 },
      { category: 'SMALL_FEATURE', text: "**Chrome Dino plus lisible** — La page affiche maintenant clairement le score minimum a atteindre pour etre recompense et un recap de la derniere run avec argent, aura et mention de nouveau record.", order: 2 },
      { category: 'BUG_FIX', text: "**Reset journalier cohérent** — Le Daily Racer utilise désormais le jour de Paris pour éviter un décalage entre le classement du jour et la distribution des récompenses à minuit.", order: 0 },
    ],
  },
  {
    id: '2026-04-04-goyave-empire-expansion',
    date: '2026-04-04',
    title: 'Goyave Empire — extension de fin de partie',
    summary: "Goyave Empire gagne de nouveaux bâtiments de fin de partie, Polymarket améliore le suivi des performances et plusieurs écrans reçoivent des ajustements de qualité de vie.",
    items: [
      { category: 'BIG_FEATURE', text: "**Nouveaux bâtiments** — Trois nouveaux bâtiments de fin de partie ont été ajoutés dans Goyave Empire : `Multivers`, `Chronoforge` et `Temple divin`, avec des coûts et revenus adaptés à une progression beaucoup plus longue.", order: 0 },
      { category: 'SMALL_FEATURE', text: "**Plus d'upgrades avancés** — Les branches d'amélioration de `Usine`, `Plantation`, `Laboratoire`, `Vaisseau` et `Dimension` ont été prolongées avec de nouveaux paliers pour mieux accompagner le late game.", order: 0 },
      { category: 'SMALL_FEATURE', text: "**Branches dédiées aux nouveaux bâtiments** — Les nouveaux bâtiments disposent eux aussi de leurs propres améliorations pour éviter une fin de run trop abrupte.", order: 1 },
      { category: 'SMALL_FEATURE', text: "**Polymarket trie aussi l'historique** — L'onglet `Mes paris` peut maintenant etre trie par date de fin des evenements ou par gain / perte, en plus de l'ordre chronologique classique.", order: 2 },
      { category: 'SMALL_FEATURE', text: "**Resume gains / pertes** — Un nouvel onglet `Resume` dans l'historique Polymarket affiche le net total, le ROI, la moyenne par pari, le plus gros gain, la plus grosse perte et le meilleur potentiel encore en cours.", order: 3 },
      { category: 'SMALL_FEATURE', text: "**Vue grille 3x3** — Les pages `Polymarket` et `Suggestions` affichent maintenant les cartes sur 3 colonnes en mode grille (au lieu de 2), pour une lecture plus dense sur grand ecran.", order: 4 },
      { category: 'BUG_FIX', text: "**Sauvegardes compatibles** — Le calcul serveur et l'état de sauvegarde ont été mis à jour pour reconnaître correctement les nouveaux bâtiments et upgrades sans casser les parties existantes.", order: 0 },
    ],
  },
  {
    id: '2026-04-04-clan-banner-height',
    date: '2026-04-04',
    title: 'Clans, guerres, Crossy Road et qualité de vie',
    summary: "Les guerres de clan utilisent maintenant un système de trophées avec matchmaking par proximité, la page clan affiche mieux les infos clés, l'objet d'agrandissement peut monter à 7 membres, un onglet affiche l'historique des dépôts, Crossy Road propose maintenant un sas avec un mode Dollar Run à cash out, BlockBlast rejoint le hub jeux, les jeux passent en contrôles ZQSD, les admins peuvent exporter le chat global, le graphe `Joueurs en ligne` devient cliquable, le thème burgandy disparaît, les stats de temps de jeu sont plus fiables et les cartes du hub jeux sont plus lisibles (format carré + paliers au survol + visuels légèrement zoomés).",
    items: [
      { category: 'BIG_FEATURE', text: "**Trophées de guerre de clan** — Chaque clan possède maintenant un total de trophées persistant. Les victoires et défaites de guerre font gagner ou perdre des trophées selon l'écart de score final, avec bonus en cas d'upset contre un clan mieux classé.", order: 1 },
      { category: 'BIG_FEATURE', text: "**Matchmaking de guerre par trophées** — Un clan ne peut plus déclarer une guerre à n'importe quel adversaire disponible: seules les cibles avec l'écart de trophées le plus faible sont autorisées.", order: 2 },
      { category: 'SMALL_FEATURE', text: "**Header de clan plus immersif** — La bannière affichée en haut de la page clan est maintenant plus haute sur mobile comme sur desktop, ce qui réduit l'effet d'image coupée et améliore la mise en avant du visuel du clan.", order: 0 },
      { category: 'SMALL_FEATURE', text: "**Trophées visibles sur la page clan** — Le total de trophées est maintenant affiché directement dans l'en-tête principal du clan, en plus des informations détaillées dans l'onglet guerre.", order: 1 },
      { category: 'SMALL_FEATURE', text: "**Historique de guerre enrichi** — Les récompenses et l'historique des guerres affichent désormais aussi les variations de trophées clan par clan.", order: 2 },
      { category: 'BIG_FEATURE', text: "**Crossy Road à deux versions** — La page Crossy Road affiche maintenant un sas de sélection pour choisir entre le mode classique et une variante `Dollar Run` inspirée de Mission Uncrossable.", order: 0 },
      { category: 'SMALL_FEATURE', text: "**Contrôles clavier en ZQSD** — Les jeux qui utilisaient `WASD` affichent maintenant `ZQSD` dans l'interface et acceptent les touches françaises correspondantes pour jouer plus naturellement sur clavier AZERTY.", order: 3 },
      { category: 'SMALL_FEATURE', text: "**Clans jusqu'à 7 membres** — L'objet d'agrandissement de clan peut maintenant être acheté et utilisé une deuxième fois. La taille maximale d'un clan passe ainsi de 5 à 7 membres.", order: 2 },
      { category: 'SMALL_FEATURE', text: "**Historique du solde de clan** — Un nouvel onglet `Historique solde` affiche maintenant les participations à la banque du clan avec le membre, le montant déposé et la date du dépôt.", order: 4 },
      { category: 'BIG_FEATURE', text: "**BlockBlast dans le hub jeux** — Portage fidèle de Blockerino avec pièces identiques, mode Classic/Chaos, scoring combos, et intégration complète Aura (scores persistants, récompenses et classement).", order: 0 },
      { category: 'SMALL_FEATURE', text: "**Dollar Run avec cash out** — Dans la nouvelle variante de Crossy Road, chaque ligne franchie augmente la cagnotte avec des multiplicateurs et un combo. Si le joueur se fait écraser avant d'appuyer sur `Cash out`, il repart avec 0.", order: 6 },
      { category: 'SMALL_FEATURE', text: "**Export admin du chat** — Un bouton 'Exporter' a ete ajoute dans l'administration pour telecharger tous les messages du chat global au format JSON, avec auteurs, reponses, reactions, images et dates.", order: 1 },
      { category: 'BIG_FEATURE', text: "**Creation explicite du village** — Dans Clash Village, un joueur doit maintenant cliquer sur `Creer mon village` lors de sa premiere visite. Ouvrir la page ne cree plus automatiquement un village attaquable.", order: 6 },
      { category: 'BIG_FEATURE', text: "**Suppression du village** — Un bouton permet maintenant de supprimer son village Clash si on ne veut plus jouer. Tant qu'aucun village n'est recree, le joueur n'apparait plus comme cible dans le jeu.", order: 7 },
      { category: 'SMALL_FEATURE', text: "**Graphe `Joueurs en ligne` cliquable** — Dans l'administration, un clic sur le graphe journalier permet maintenant de figer la liste de droite pour voir qui etait connecte a une heure precise, puis de recliquer pour liberer la selection.", order: 5 },
      { category: 'SMALL_FEATURE', text: "**Hub jeux plus net** — Les cartes de jeux reviennent en format carre, la grille des paliers de gains n'apparait plus qu'au survol pour alleger la lecture, et les visuels sont legerement zoomes par defaut.", order: 8 },
      { category: 'BUG_FIX', text: '**Suppression du thème burgandy** — Le thème burgandy a été retiré de la liste des thèmes disponibles pour éviter un rendu de texte illisible.', order: 0 },
      { category: 'BUG_FIX', text: "**Stats admin temps de jeu** — Les widgets `temps passé par jeu` et `classement temps de jeu` s'appuient maintenant sur le temps réellement passé sur les pages de jeux via les snapshots de présence, au lieu de mélanger temps connecté global et durées de logs incomplètes. Plus de jeux remontent et les totaux sont désormais cohérents avec l'activité réelle.", order: 2 },
      { category: 'BUG_FIX', text: "**Protection avant creation** — Les joueurs sans village ne sont plus exposes au matchmaking ni aux actions Clash. Avant la creation du premier village, personne ne peut donc les attaquer.", order: 4 },
      { category: 'BUG_FIX', text: "**Inbox achats clan redirigée** — Les notifications d'achat d'améliorations/objets de clan ouvrent maintenant la page `Clans` (inventaire de clan) au lieu de l'inventaire joueur.", order: 5 },
    ],
  },
  {
    id: '2026-04-04-you-loan-collateral-motivation',
    date: '2026-04-04',
    title: 'YOU, actionnariat, dashboard et administration',
    summary: "Les demandes de prêt peuvent maintenant inclure une hypothèque en aura et une lettre de motivation, les entreprises YOU peuvent ouvrir leur capital via des propositions d actionnariat, un actionnaire devient automatiquement fondateur au-delà de 50% de parts, le fondateur peut lancer des rachats ciblés de parts, le parrainage arrive sur le dashboard avec un nouveau contrôle côté admin, les widgets dashboard couvrent désormais les trois marchés crypto, les formations YOU affichent maintenant des avis commentés et les services de transfert perso sont utilisables depuis son propre business.",
    items: [
      { category: 'BIG_FEATURE', text: "**Hypothèque en aura** — Les demandes de prêt peuvent maintenant inclure un montant d'aura mis en garantie. Si le prêt est accepté, cette aura est bloquée jusqu'au remboursement.", order: 0 },
      { category: 'BIG_FEATURE', text: "**Saisie en cas de défaut** — Si l'emprunteur ne peut pas rembourser et que l'échéance est dépassée, le propriétaire de la banque peut récupérer automatiquement l'aura bloquée en hypothèque.", order: 1 },
      { category: 'BIG_FEATURE', text: "**Actionnariat des entreprises** — Un joueur peut maintenant proposer de devenir actionnaire d'une entreprise YOU en choisissant une part du capital et une somme associée. Le money reste bloqué pendant l'attente puis est libéré ou versé selon la décision du propriétaire.", order: 2 },
      { category: 'SMALL_FEATURE', text: "**Description de clan modifiable** — Le chef de clan peut maintenant modifier directement la description du clan depuis l'en-tete de la page clan.", order: 0 },
      { category: 'SMALL_FEATURE', text: "**Lettre de motivation** — Chaque demande de prêt peut maintenant contenir un message expliquant à quoi servira l'argent et comment le joueur compte rembourser.", order: 1 },
      { category: 'SMALL_FEATURE', text: "**Vue enrichie des prêts** — Les modales YOU affichent maintenant l'hypothèque proposée, l'aura actuellement bloquée et la motivation associée aux demandes et prêts actifs.", order: 2 },
      { category: 'SMALL_FEATURE', text: "**Suivi des debiteurs banque** — Les banques voient maintenant plus clairement qui doit rembourser, avec le taux, la duree, le reste du, la date d'echeance, le temps restant et la date d'accord du pret.", order: 3 },
      { category: 'SMALL_FEATURE', text: "**Carte de parrainage sur le dashboard** — Le dashboard joueur peut maintenant afficher une card dédiée au parrainage avec le code, les statistiques et un bouton de copie rapide.", order: 4 },
      { category: 'SMALL_FEATURE', text: "**Contrôle admin du dashboard** — Une nouvelle option dans l'administration permet d'afficher ou masquer la card de parrainage sur le dashboard.", order: 5 },
      { category: 'SMALL_FEATURE', text: "**Parrainage simplifié** — Le bouton `Gérer` a été retiré du widget dashboard et le bouton `Réclamer` a été retiré des réglages de parrainage pour alléger l'interface.", order: 6 },
      { category: 'SMALL_FEATURE', text: "**Avis commentés pour les formations** — La notation des services YOU permet maintenant d'ajouter un commentaire en plus des étoiles, et les business `formation` affichent ces avis directement dans leur fiche quand on les ouvre.", order: 7 },
      { category: 'SMALL_FEATURE', text: "**Montant suggéré auto-calculé** — La modale `Devenir actionnaire` propose un montant indicatif calculé automatiquement selon la part demandée, avec un bouton pour le reprendre en un clic.", order: 8 },
      { category: 'SMALL_FEATURE', text: "**Acceptation et capital partagé** — Le propriétaire peut accepter ou refuser chaque proposition. En cas d accord, l argent est transféré, l investisseur devient actionnaire et la répartition du capital devient visible dans les fiches business.", order: 9 },
      { category: 'SMALL_FEATURE', text: "**Transfert via sa propre plateforme** — Un joueur qui possède son propre service de transfert peut maintenant envoyer de l'argent directement depuis l'onglet Travail, sans être obligé de passer par le service d'un concurrent.", order: 10 },
      { category: 'SMALL_FEATURE', text: "**UI actionnaires complète** — L'onglet Explorer propose maintenant une modal 'Devenir actionnaire' avec suggestion auto-calculée, et l'onglet Travail affiche les participations, les propositions envoyées, les demandes à valider et la répartition du capital.", order: 11 },
      { category: 'SMALL_FEATURE', text: "**Widgets crypto dashboard** — Le dashboard affiche maintenant aussi `Aura Stable` et `Chaos Coin` avec prix, variation en direct et mini-graphe, en plus d'`Aura Coin`.", order: 12 },
      { category: 'BIG_FEATURE', text: "**Fondateur auto au-dessus de 50%** — Lorsqu'une proposition d'actionnariat est acceptée et qu'un investisseur dépasse 50% des parts d'un business YOU, il devient automatiquement le nouveau fondateur de l'entreprise.", order: 13 },
      { category: 'SMALL_FEATURE', text: "**Rachat ciblé des parts par le fondateur** — Le fondateur peut désormais envoyer une offre de rachat de parts à un actionnaire précis, qui peut accepter ou refuser séparément.", order: 14 },
    ],
  },
  {
    id: '2026-04-03-fix-download-logs-all-time',
    date: '2026-04-03',
    title: 'Fix export logs — tous les temps',
    summary: "Le mode 'Tous les temps' exportait incorrectement les logs filtrés par type/jeu/pseudo actifs dans l'UI.",
    items: [
      { category: 'BUG_FIX', text: "**Export logs complet** — En mode 'Tous les temps', tous les logs sont maintenant exportés sans aucun filtre ni limite de date.", order: 0 },
    ],
  },
  {
    id: '2026-04-03-you-page-upgrades',
    date: '2026-04-03',
    title: 'YOU — Explorer, formations multiples, tutoriel et profil',
    summary: "L'onglet Explorer devient modal, les centres de formation supportent plusieurs formations, le tutoriel est revu et les entreprises sont personnalisables.",
    items: [
      { category: 'BIG_FEATURE', text: "**Explorer modal** — Cliquer sur un business dans l'onglet Explorer ouvre maintenant une modal avec toutes les actions, au lieu du panneau lateral.", order: 0 },
      { category: 'BIG_FEATURE', text: "**Formations multiples** — Les centres de formation peuvent desormais proposer plusieurs formations independantes avec titre, description, image et prix differents.", order: 1 },
      { category: 'BIG_FEATURE', text: "**Profil entreprise** — Chaque proprietaire peut modifier le nom, la description et le logo (URL) de son entreprise depuis ManageBusinessModal.", order: 2 },
      { category: 'SMALL_FEATURE', text: "**Tutoriel revu** — Le guide de demarrage est maintenant toujours visible sur la page Overview (pas seulement quand le fil est vide) avec 5 etapes centrees sur la creation d'une epicerie. Un bouton 'Rejouer' permet de le relancer a tout moment.", order: 3 },
      { category: 'SMALL_FEATURE', text: "**Notation apres action** — La popup de notation apparait automatiquement apres avoir utilise un service (formation, transfert, investissement...).", order: 4 },
      { category: 'SMALL_FEATURE', text: "**Boutiques** — Les articles dans les epiceries et stands de limonade sont achetables directement depuis la modal du business.", order: 5 },
    ],
  },
  {
    id: '2026-04-01-party-dropdown-members',
    date: '2026-04-01',
    title: 'Groupes plus lisibles',
    summary: "Les cartes de groupe deviennent des menus deroulants pour afficher les utilisateurs seulement quand on en a besoin.",
    items: [
      { category: 'SMALL_FEATURE', text: "**Page groupe** — La liste des membres du groupe actuel est maintenant repliee dans un menu deroulant 'Utilisateurs du groupe' pour alleger la page.", order: 0 },
      { category: 'SMALL_FEATURE', text: "**Groupes ouverts** — Chaque groupe public peut maintenant etre ouvert pour voir les utilisateurs qu'il contient sans afficher toutes les listes en permanence.", order: 1 },
      { category: 'SMALL_FEATURE', text: "**Widget groupe** — Le widget du header utilise lui aussi une section deroulante pour afficher les utilisateurs du groupe actif.", order: 2 },
    ],
  },
  {
    id: '2026-04-01-clans-wording',
    date: '2026-04-01',
    title: 'Terminologie des clans',
    summary: "Le site affiche maintenant 'clan' a la place de 'guilde' dans l'interface.",
    items: [
      { category: 'SMALL_FEATURE', text: "**Terminologie unifiee** — Les libelles de navigation, statistiques, metadonnees de page et messages visibles utilisent maintenant 'clan' et 'clans' au lieu de 'guilde' et 'guildes'.", order: 0 },
    ],
  },
  {
    id: '2026-04-01-clan-banner-item',
    date: '2026-04-01',
    title: 'Bannière de clan',
    summary: "Un nouvel objet de clan permet d'acheter, téléverser et afficher une bannière de clan.",
    items: [
      { category: 'BIG_FEATURE', text: "**Objet banniere de clan** — Un objet `CLAN_BANNER` peut maintenant etre cree depuis l'admin, achete avec la banque du clan, puis active par le chef pour televerser l'image de banniere.", order: 0 },
      { category: 'SMALL_FEATURE', text: "**Activation guidee** — Depuis la page clan, l'objet affiche un bouton dedie au choix de l'image et ouvre directement une fenetre d'upload avec apercu.", order: 1 },
      { category: 'SMALL_FEATURE', text: "**Affichage du clan** — La banniere televersee s'affiche en haut de la page clan quand ce clan est selectionne.", order: 2 },
    ],
  },
  {
    id: CANONICAL_APRIL_FIRST_ENTRY_ID,
    date: '2026-04-01',
    title: 'Corrections UI & Notifications',
    summary: "Toasts unifiés, badge changelog rouge, doublons de notifications corrigés, uploads d'images plus fiables, top bar persistante, page Pass refondue, Fruit Ninja rééquilibré, Snake ajouté au hub, HexGL intégré au catalogue jeux et nouveaux filtres du hub jeux.",
    items: [
      { category: 'BUG_FIX', text: '**Badge changelog** — La pastille de notifications non lues dans la sidebar passe au rouge, cohérent avec les autres badges.', order: 0 },
      { category: 'BUG_FIX', text: '**Toasts en double** — Les achats en boutique, claims de quêtes, ouverture du pass et investissements business ne déclenchaient plus deux toasts simultanément.', order: 1 },
      { category: 'BUG_FIX', text: "**Formats d'image mieux geres** — Les uploads acceptent maintenant aussi l'AVIF et reconnaissent mieux certains MIME types courants comme `image/jpg`.", order: 2 },
      { category: 'BUG_FIX', text: "**Uploads d'images plus robustes** — La validation et l'ecriture des images sont centralisees cote serveur pour eviter les comportements differents selon la page ou le type d'upload.", order: 3 },
      { category: 'BUG_FIX', text: "**Conversion automatique d'images** — Sur les navigateurs compatibles, certains formats comme HEIC/HEIF ou SVG sont convertis automatiquement vers un format supporte avant envoi.", order: 4 },
      { category: 'BUG_FIX', text: "**Une carte par jour** — Le backend fusionne les entrees de changelog ayant la meme date et evite maintenant la creation de doublons sur une meme journee.", order: 5 },
      { category: 'BUG_FIX', text: "**Fruit Ninja reequilibre** — La difficulte monte moins brutalement: les fruits arrivent moins vite, les doubles vagues commencent plus tard et les triples vagues ne peuvent plus saturer l'ecran trop tot.", order: 6 },
      { category: 'BUG_FIX', text: "**Top bar persistante** — Le layout garde maintenant toujours la barre du haut visible pendant le scroll en contraignant correctement la zone de contenu et en maintenant le header au-dessus des pages.", order: 7 },
      { category: 'BUG_FIX', text: "**Inventaire trie comme la boutique** — La page inventaire reprend maintenant le meme ordre de types que la boutique et regroupe correctement les objets par categorie dans l'onglet `Tous`.", order: 8 },
      { category: 'BUG_FIX', text: "**Inbox de bienvenue** — Un message de bienvenue est maintenant envoye automatiquement dans l'inbox lors de la premiere connexion reussie d'un compte, sans doublon aux connexions suivantes.", order: 9 },
      { category: 'BUG_FIX', text: "**Cards de jeux cliquables** — Le calque de navigation passe maintenant au-dessus du contenu des cartes pour que tout le bloc ouvre bien le jeu au clic.", order: 10 },
      { category: 'BUG_FIX', text: "**Page YOU sans mojibake** — Les libelles et titres de gestion business n'affichent plus de caracteres parasites (ex: `Â·`) et utilisent un separateur propre.", order: 11 },
      { category: 'SMALL_FEATURE', text: '**Fermer un toast** — Un bouton ✕ permet maintenant de fermer manuellement chaque toast.', order: 0 },
      { category: 'SMALL_FEATURE', text: '**Toasts unifiés** — Tous les toasts du site (y compris la page Admin) passent par le même système visuel.', order: 1 },
      { category: 'SMALL_FEATURE', text: "**Selection d'images plus claire** — Les zones d'upload affichent des formats explicitement supportes pour mieux guider les utilisateurs avant l'envoi.", order: 2 },
      { category: 'SMALL_FEATURE', text: '**Page Pass refondue** — L’interface de la page Pass a ete entierement retravaillee pour retrouver la meme direction visuelle que le reste du site, avec un hero plus propre, des cartes plus coherentes et une meilleure mise en avant des recompenses.', order: 3 },
      { category: 'SMALL_FEATURE', text: "**Filtres du hub jeux** — La page Jeux propose maintenant des filtres pour les recompenses et les jeux beta, avec des controles admin pour gerer le catalogue.", order: 4 },
      { category: 'SMALL_FEATURE', text: "**Classements HexGL** — La page Classements affiche maintenant la categorie HexGL avec ses statistiques associees.", order: 5 },
      { category: 'SMALL_FEATURE', text: "**Profil mis a jour** — HexGL apparait aussi dans le catalogue de jeux du profil.", order: 6 },
      { category: 'SMALL_FEATURE', text: "**Stats de clan** — Les statistiques de participants aux guerres de clans sont maintenant exposees pour alimenter les vues concernees.", order: 7 },
      { category: 'SMALL_FEATURE', text: "**Titre de gestion business ameliore** — La modale de gestion affiche maintenant un titre plus visible, centre, avec une icone coloree adaptee au type de business.", order: 8 },
      { category: 'BIG_FEATURE', text: '**Snake dans le hub jeux** — Un nouveau Snake natif a ete ajoute avec interface coherente, plein ecran, pause, difficultes, classement, recompenses et integration complete dans le catalogue, la sidebar et les profils.', order: 4 },
      { category: 'BIG_FEATURE', text: '**HexGL dans le hub jeux** — HexGL est maintenant integre au catalogue jeux avec statistiques, soumission des scores et classement dedie.', order: 5 },
    ],
  },
  {
    id: '2026-03-30-chess-promotion',
    date: '2026-03-30',
    title: 'Échecs',
    summary: 'Promotion des pions corrigée.',
    items: [
      { category: 'BUG_FIX', text: '**Promotion aux échecs** — La promotion par glisser-déposer fonctionne désormais correctement, et le choix de la pièce (dame, tour, fou, cavalier) est bien pris en compte.', order: 0 },
    ],
  },
  {
    id: '2026-03-29-updates-page',
    date: '2026-03-29',
    title: 'Centre de mises à jour',
    summary: "Nouvelle page d'historique avec suivi des nouveautés non lues.",
    items: [
      { category: 'BIG_FEATURE', text: '**Page Mises à jour** — Nouvelle page listant les changements par date, accessible depuis la barre latérale.', order: 0 },
      { category: 'BIG_FEATURE', text: "**Compteur de nouveautés** — Un badge apparaît sur le lien tant que des mises à jour n'ont pas été consultées.", order: 1 },
      { category: 'BIG_FEATURE', text: "**OpenGD dans le hub jeux** — Une nouvelle page OpenGD est disponible dans le catalogue et la barre latérale, avec le même mode plein écran/pause/rechargement que les autres jeux web.", order: 3 },
      { category: 'SMALL_FEATURE', text: '**Thème appliqué** — La page respecte le thème de couleur actif.', order: 0 },
      { category: 'BUG_FIX', text: "**Polymarket multi-choix** — Les événements créés avec des options personnalisées (3-4 choix) s'affichaient incorrectement en Oui/Non. Les options personnalisées sont désormais correctement transmises et affichées.", order: 0 },
      { category: 'BIG_FEATURE', text: '**Classement global dans les classements** — Le classement global combiné est maintenant accessible directement depuis la page Classements, avec un panneau explicatif sur le mode de calcul.', order: 2 },
      { category: 'SMALL_FEATURE', text: "**Badge classement global amélioré** — L'infobulle du badge sur les profils affiche désormais le tier, le rang, le top %, et une explication du score combiné.", order: 1 },
      { category: 'SMALL_FEATURE', text: "**Inventaire amélioré** — Ajout d'une barre de recherche, d'un tri via menu déroulant, et d'un basculement entre affichage liste et grille.", order: 2 },
    ],
  },
];

async function mergeDuplicateEntriesByDate() {
  const entries = await prisma.updateEntry.findMany({
    include: { items: true },
    orderBy: [{ createdAt: 'asc' }],
  });

  const entriesByDate = new Map<string, EntryWithItems[]>();
  for (const entry of entries) {
    const group = entriesByDate.get(entry.date);
    if (group) {
      group.push(entry);
    } else {
      entriesByDate.set(entry.date, [entry]);
    }
  }

  for (const sameDateEntries of entriesByDate.values()) {
    if (sameDateEntries.length <= 1) {
      continue;
    }

    const [entryToKeep, ...entriesToDelete] = sameDateEntries;
    const existingKeys = new Set(entryToKeep.items.map((item) => `${item.category}:${item.text}`));
    const maxOrderByCategory = new Map<string, number>();

    for (const item of entryToKeep.items) {
      const current = maxOrderByCategory.get(item.category) ?? -1;
      maxOrderByCategory.set(item.category, Math.max(current, item.order));
    }

    const itemsToCreate: { entryId: string; category: string; text: string; order: number }[] = [];

    for (const duplicateEntry of entriesToDelete) {
      for (const item of duplicateEntry.items) {
        const key = `${item.category}:${item.text}`;
        if (existingKeys.has(key)) {
          continue;
        }

        const nextOrder = (maxOrderByCategory.get(item.category) ?? -1) + 1;
        maxOrderByCategory.set(item.category, nextOrder);
        existingKeys.add(key);

        itemsToCreate.push({
          entryId: entryToKeep.id,
          category: item.category,
          text: item.text,
          order: nextOrder,
        });
      }
    }

    if (itemsToCreate.length > 0) {
      await prisma.updateItem.createMany({ data: itemsToCreate });
    }

    await prisma.updateEntry.deleteMany({
      where: { id: { in: entriesToDelete.map((entry) => entry.id) } },
    });
  }
}

async function ensureSeeded() {
  const canonicalEntry = SEED_ENTRIES.find((entry) => entry.id === CANONICAL_APRIL_FIRST_ENTRY_ID);
  if (canonicalEntry) {
    const legacyEntry = await prisma.updateEntry.findUnique({
      where: { id: LEGACY_IMAGE_UPLOAD_ENTRY_ID },
      include: { items: true },
    });

    if (legacyEntry) {
      const canonicalExists = await prisma.updateEntry.findUnique({
        where: { id: CANONICAL_APRIL_FIRST_ENTRY_ID },
        include: { items: true },
      });

      if (!canonicalExists) {
        await prisma.updateEntry.create({
          data: {
            id: canonicalEntry.id,
            date: canonicalEntry.date,
            title: canonicalEntry.title,
            summary: canonicalEntry.summary,
            items: { create: canonicalEntry.items },
          },
        });
      }

      await prisma.updateItem.deleteMany({
        where: { entryId: LEGACY_IMAGE_UPLOAD_ENTRY_ID },
      });
      await prisma.updateEntry.delete({
        where: { id: LEGACY_IMAGE_UPLOAD_ENTRY_ID },
      });
    }
  }

  const existingEntries = await prisma.updateEntry.findMany({
    include: { items: true },
    orderBy: [{ createdAt: 'asc' }],
  });
  const existingEntriesById = new Map(existingEntries.map((entry) => [entry.id, entry]));
  const existingEntriesByDate = new Map<string, EntryWithItems>();
  for (const entry of existingEntries) {
    if (!existingEntriesByDate.has(entry.date)) {
      existingEntriesByDate.set(entry.date, entry);
    }
  }

  const itemKeysByEntryId = new Map<string, Set<string>>();
  for (const entry of existingEntries) {
    itemKeysByEntryId.set(
      entry.id,
      new Set(entry.items.map((item) => `${item.category}:${item.text}`))
    );
  }

  for (const entry of SEED_ENTRIES) {
    const existingEntry = existingEntriesById.get(entry.id);

    if (!existingEntry) {
      const existingForDate = existingEntriesByDate.get(entry.date);

      if (!existingForDate) {
        const createdEntry = await prisma.updateEntry.create({
          data: {
            id: entry.id,
            date: entry.date,
            title: entry.title,
            summary: entry.summary,
            items: { create: entry.items },
          },
          include: { items: true },
        });

        existingEntriesById.set(entry.id, createdEntry);
        existingEntriesByDate.set(entry.date, createdEntry);
        itemKeysByEntryId.set(
          entry.id,
          new Set(entry.items.map((item) => `${item.category}:${item.text}`))
        );
      } else {
        const existingItemKeys = itemKeysByEntryId.get(existingForDate.id) ?? new Set<string>();
        const missingItems = entry.items.filter((item) => !existingItemKeys.has(`${item.category}:${item.text}`));

        if (missingItems.length > 0) {
          await prisma.updateItem.createMany({
            data: missingItems.map((item) => ({
              entryId: existingForDate.id,
              category: item.category,
              text: item.text,
              order: item.order,
            })),
          });

          for (const item of missingItems) {
            existingItemKeys.add(`${item.category}:${item.text}`);
          }
          itemKeysByEntryId.set(existingForDate.id, existingItemKeys);
        }
      }

      continue;
    }

    const existingItemKeys = itemKeysByEntryId.get(existingEntry.id) ?? new Set<string>();
    const missingItems = entry.items.filter((item) => !existingItemKeys.has(`${item.category}:${item.text}`));

    if (existingEntry.date !== entry.date || existingEntry.title !== entry.title || existingEntry.summary !== entry.summary) {
      await prisma.updateEntry.update({
        where: { id: entry.id },
        data: {
          date: entry.date,
          title: entry.title,
          summary: entry.summary,
        },
      });
    }

    if (missingItems.length > 0) {
      await prisma.updateItem.createMany({
        data: missingItems.map((item) => ({
          entryId: entry.id,
          category: item.category,
          text: item.text,
          order: item.order,
        })),
      });

      for (const item of missingItems) {
        existingItemKeys.add(`${item.category}:${item.text}`);
      }
      itemKeysByEntryId.set(existingEntry.id, existingItemKeys);
    }
  }

  await mergeDuplicateEntriesByDate();
}

async function notifyNewChangelogEntry(entry: { id: string; title: string; summary: string }) {
  const approvedUsers = await prisma.user.findMany({
    where: { isApproved: true },
    select: { id: true },
  });

  await Promise.all(
    approvedUsers.map((user) =>
      createNotification({
        userId: user.id,
        type: 'SYSTEM',
        title: `Nouvelle mise a jour: ${entry.title}`,
        body: entry.summary,
        link: '/changelog',
        icon: 'megaphone',
      })
    )
  );
}

const requireAdmin = (req: AuthRequest, res: Response, next: Function) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET / — public, returns all entries with items
router.get('/', async (_req, res: Response) => {
  await ensureSeeded();
  const entries = await prisma.updateEntry.findMany({
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: { items: true },
  });
  return res.json(entries.map((e) => ({
    id: e.id,
    date: e.date,
    title: e.title,
    summary: e.summary,
    sections: groupItems(e.items),
  })));
});

// GET /ids — cheap unread-count helper
router.get('/ids', async (_req, res: Response) => {
  await ensureSeeded();
  const entries = await prisma.updateEntry.findMany({
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
  });
  return res.json({ ids: entries.map((e) => e.id) });
});

// POST / — admin, create entry
router.post('/', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { date, title, summary } = req.body as { date?: string; title?: string; summary?: string };
  if (!date || !title || !summary) {
    return res.status(400).json({ error: 'date, title et summary sont requis' });
  }

  const existingEntryForDate = await prisma.updateEntry.findFirst({
    where: { date },
    orderBy: [{ createdAt: 'asc' }],
    include: { items: true },
  });

  if (existingEntryForDate) {
    return res.status(200).json({
      id: existingEntryForDate.id,
      date: existingEntryForDate.date,
      title: existingEntryForDate.title,
      summary: existingEntryForDate.summary,
      sections: groupItems(existingEntryForDate.items),
    });
  }

  const entry = await prisma.updateEntry.create({
    data: { date, title, summary },
    include: { items: true },
  });

  void notifyNewChangelogEntry({
    id: entry.id,
    title: entry.title,
    summary: entry.summary,
  }).catch((error) => {
    console.error('Failed to send changelog notifications:', error);
  });

  return res.status(201).json({ id: entry.id, date: entry.date, title: entry.title, summary: entry.summary, sections: [] });
});

// DELETE /:id — admin, delete entry
router.delete('/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await prisma.updateEntry.delete({ where: { id } });
  return res.json({ success: true });
});

// POST /:id/items — admin, add item to entry
router.post('/:id/items', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { category, text } = req.body as { category?: string; text?: string };
  if (!category || !text) {
    return res.status(400).json({ error: 'category et text sont requis' });
  }
  if (!CATEGORIES.includes(category as UpdateCategory)) {
    return res.status(400).json({ error: 'Catégorie invalide' });
  }
  const lastItem = await prisma.updateItem.findFirst({
    where: { entryId: id, category },
    orderBy: { order: 'desc' },
  });
  const item = await prisma.updateItem.create({
    data: { entryId: id, category, text, order: (lastItem?.order ?? -1) + 1 },
  });
  return res.status(201).json({ id: item.id, text: item.text, category: item.category });
});

// DELETE /:entryId/items/:itemId — admin, delete item
router.delete('/:entryId/items/:itemId', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { itemId } = req.params;
  await prisma.updateItem.delete({ where: { id: itemId } });
  return res.json({ success: true });
});
function groupItems(items: { id: string; category: string; text: string; order: number }[]) {
  const map: Record<string, { id: string; text: string }[]> = {
    BIG_FEATURE: [],
    SMALL_FEATURE: [],
    BUG_FIX: [],
  };
  for (const item of [...items].sort((a, b) => a.order - b.order)) {
    if (map[item.category]) {
      map[item.category].push({ id: item.id, text: item.text });
    }
  }
  return CATEGORIES
    .filter((cat) => map[cat].length > 0)
    .map((cat) => ({ category: cat, items: map[cat] }));
}


export default router;
