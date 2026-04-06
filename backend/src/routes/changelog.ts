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
    id: '2026-04-06-restaurant-business',
    date: '2026-04-06',
    title: 'Nouveau type de business: Restaurant',
    summary: 'Les joueurs peuvent désormais créer et gérer des restaurants, et personnaliser entièrement leur menu (produits et prix). L\'architecture interne a été rendue plus modulaire.',
    items: [
      { category: 'BIG_FEATURE', text: '**Restaurant** — Nouvelle catégorie de business niveau 1. Permet de vendre et d\'acheter des burgers, pizzas, poulet frit et sodas pour vos besoins quotidiens.', order: 0 },
      { category: 'BIG_FEATURE', text: '**Menu personnalisable** — Les propriétaires de restaurants peuvent maintenant modifier entièrement leur menu (noms des plats, prix, emojis) depuis l\'onglet Gérer.', order: 1 },
      { category: 'SMALL_FEATURE', text: '**Données modulaires** — Refonte technique : passage à un champ générique de données personnalisées pour préparer le terrain aux futurs types d\'entreprises configurables.', order: 2 },
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
