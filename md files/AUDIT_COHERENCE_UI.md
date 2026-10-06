# Audit de cohérence UI — AuraTracker

Date : 2026-10-06. Méthode : sonde DOM sur 24 pages applicatives + 41 pages de jeux (largeur 1280 px, connecté admin, base de dev), complétée par une analyse statique de `frontend/src` (250 fichiers `.tsx`, ~116 000 lignes).

Les mesures `gauche/droite/padding/max-width/gap` viennent du premier élément rendu dans le conteneur de scroll du `Layout`.

## 1. Conteneurs de page : 5 familles au lieu d'une

`PageShell` (`max-w-7xl`, `p-4 md:p-6`, `gap-6`) est documenté comme « conteneur unique de toutes les pages ». En pratique :

| Famille | Pages | Largeur max | Padding | Gap |
|---|---|---|---|---|
| `PageShell` default | Dashboard, Games, Leaderboards, Numbers, Quests, Party, Market (Boutique), Marketplace, Inventory, PixelBoard, Suggestions, Rules, Settings, Inbox, Profile, Admin, Tutoriels | 1280 | 24 | 24 |
| `PageShell size="wide"` | **Clans, Forum**, Sudoku, Loto | 1536 | 24 | 24 |
| `PageShell size="full"` | HorseRace | aucune | 24 | 24 |
| `GameShell` | ~25 jeux solo | 1280 | 24 | **16** |
| Sans shell (div maison) | **Polymarket**, You, Messages, Support, Salle de marché, Aura Coin, Aura Stable, Chaos Coin, Clash Village, Hextris, Paper.io | variable | 0 / 16 / `px-6 pb-8` / `32px 24px` | normal / 16 |

Constats :
- Clans et Forum : largeur 1536 px au lieu de 1280 px, donc marges latérales plus petites que les autres pages.
- Polymarket : `w-full px-4 pb-6 lg:px-6 lg:pb-8 space-y-8` — pas de `PageShell`, pas de `max-w`, **pas de padding haut**, espacement 32 px au lieu de 24 px.
- You : `flex min-h-0 flex-1 flex-col`, padding 0 (page pleine largeur avec ses propres onglets).
- Messages / Support : `p-4 md:p-6` sans `max-w` ni `gap`, `overflow-hidden` ; Support est un simple `export { default } from './Messages'`.
- Aura Coin, Aura Stable, Chaos Coin : trois paddings différents (`32px 24px`, `0 24px 32px`, `0`).
- Clash Village : `p-4` seulement (16 px), pas de max-width.
- Hextris, Paper.io : padding 0, pas de max-width.
- `GameShell` utilise `gap-4`, `PageShell` `gap-6` : deux rythmes verticaux pour la même application.

## 2. En-têtes de page : `PageHeader` ignoré par la moitié du site

`PageHeader` (h1 `text-2xl font-semibold` + description + actions) existe, mais :

| Problème | Pages |
|---|---|
| Aucun `h1` | **Polymarket**, **You**, **Admin**, **Tutoriels** (utilise un `h2` en 30 px), Échecs, Salle de marché, Aura Stable, Chaos Coin |
| `h1` en 14 px | Messages, Support (titre « Messages » sur la page Support) |
| `h1` en 16 px | ~25 jeux `GameShell` (via `GameTopBar`) |
| `h1` en 13 px / 20 px / 24 px | HorseRace / Roulette russe / jeux de plateau |
| `h1` = nom d'utilisateur | Profil |
| `h1` avec caractère spécial | Aura Coin (`◈ AuraCoin`) |
| `h1` multiples | Casino (2 `h1`) |
| Titre dans `h2` | You (« Ton empire »), Polymarket |
| Pas de description sous le titre | Profil, Messages, Support, Admin, You, Polymarket, Tutoriels (description en `p` hors `PageHeader`) |

## 3. Noms incohérents entre sidebar, onglet, fil d'Ariane et `h1`

Quatre sources de vérité indépendantes (`i18n`, `page-meta.ts`, `<PageHeader title>` en dur, `<title>`).

| Route | Sidebar | `page-meta` / onglet | `h1` |
|---|---|---|---|
| /inbox | — | Boîte de réception | **Inbox** |
| /leaderboards | Classement | Classements | Classement |
| /party | Groupe | Groupe | **Groupes** |
| /rules | Règlement/Info | Règlement | **Principes** |
| /settings | — | Paramètres | **Réglages** |
| /marketplace | Marché | **Marketplace** | Marché |
| /tutoriels | **Tutoriel** | Tutoriels | **Tutoriels interactifs** |
| /you | Moi | Moi | (aucun) |
| /games/stack-tower | Tour empilée | Tour empilée | **Stack Tower** |
| /games/casino | Casino | Casino | **Etage Casino** (faute : « Étage ») |
| /games/blockblast, hextris, paper-io, dotsandboxes, horse-race | — | **« Games / Blockblast »**, **« Games / Paper Io »**, **« Games / Dotsandboxes »**, **« Games / Horse Race »** (fallback automatique, pas d'entrée dans `page-meta`) | divers |
| /loto, /pass, /forum, /pixel-board, /messages, /tutoriels… | — | absents ou partiels de `page-meta` | — |

Autres écarts de nommage :
- Mélange français / anglais : Inbox, Marketplace, Pixel Board, Matchmaking duel, Reporter un bug, « Upgrade token reserved… », « Seed now includes… ».
- Majuscules : « Bataille Navale » (h1) / « Bataille navale » (meta), « PolyTrack » / « Polytrack ».

## 4. Emojis et pictogrammes dans l'interface

- Emojis dans des chaînes de l'UI hors contenu de jeu : `Clans.tsx` (21), `you/components/*` (≈50), `Messages.tsx` (7), `ChatSidebar` (6), `Tutoriels.tsx` (4), `Polymarket.tsx` (3), `AdminPage.tsx` (4), `i18n.ts` (10), cartes de jeux dans `/games` (🍉 🦖 🐍 🐔 🧱 💣 🏇 🟦 🟪 mélangés à des icônes).
- Icône décorative devant le titre : Tutoriels (`BookOpen` devant le `h2`), Aura Coin (`◈`).
- Deux jeux de visuels pour les cartes de jeux : images (`images/games/*`) et emojis.

## 5. Typographie

Échelle de titres de page réellement rendue : 13, 14, 16, 20, 24, 30 px. Titres de section : `h2` 14 / 18 / 20 px, `h3` 14 / 16 px avec `font-weight: 400` (Règlement, Tutoriels) alors que le reste est en 600.

## 6. États (chargement, vide, confirmation)

- Chargement : `Skeleton` (23 fichiers), `Spinner` (22), `Loader2` + `animate-spin` (40), texte « Chargement… » (8) — quatre patterns. Polymarket affiche un spinner centré plein écran.
- Confirmations : `window.confirm()` natif dans 13 fichiers (GameLeaderboard, ClashVillage, GoyaveEmpire, Forum, ForumPost, PixelBoard, HorseRace, Leaderboards, Messages, Clans, AdminPage, SettingsTab, you/modals) alors qu'`AppDialogContext` / `AlertDialog` existent.
- Overlays faits main (`fixed inset-0`) au lieu de `Dialog` : IntroVideo, TutorialWelcomeModal, TutorialOverlay, ReferralClaimAnimation, MoneyIncomeOverlay, RewardCollector, Uno, Casino, BraquageLegal.
- Éléments HTML bruts hors `components/ui` : 127 `<button` dans 49 fichiers, 19 `<input` dans 11 fichiers, 7 `<table` dans 6 fichiers.

## 7. Couleurs et tokens

- Classes de palette Tailwind brutes (`bg-red-500`, `text-white`…) hors tokens : HorseRace 405, Casino 242, Uno 72, ClashVillage 53, Minesweeper 34, BatailleNavale 30, BlockBlast 28, puis une vingtaine de fichiers.
- Les couleurs hexadécimales dans les jeux canvas (KnifeHit, GeometryDash…) sont légitimes. À corriger : hex dans `Inventory` (50), `Clans` (35), `PixelBoard` (34), `Poker` (31), `RussianRoulette` (44).

## 8. Langue et monnaie

- Accents manquants dans des textes visibles : « Economie », « Communaute » (Nombres), « a sous », « animee », « evite », « acceleration », « a ete ajoute », « volatilite reduite et spreads serres », « tres instable » (page-meta), AdminPage (7), Casino (3), Games (3), etc.
- Monnaie : la barre du haut affiche **€** ; la Boutique affiche **$1800**, `+$${bonusMoney}` ; formatage via `toLocaleString` dispersé dans 20+ fichiers sans helper unique.

## 9. Autres écarts

- `Admin.tsx` fait 2 lignes (ré-export) ; `You.tsx` 1 ligne ; `Support.tsx` 1 ligne : couches inutiles.
- Page 404 : ajoutée dans le commit `4ab42922`, sans shell applicatif.
- Hero du Dashboard : phrase différente entre deux chargements (« Heureux de te revoir, admin ! » / « Salut admin, quoi de beau ? »).
- Nombre de pages de jeux sans `PageHeader` / avec `GameTopBar` : le titre est dans une barre, pas dans l'en-tête de page.

## 10. Ce qui est déjà cohérent (à conserver)

`Layout`, `Sidebar`, `SiteHeader`, composants `ui/*` shadcn, `AuthShell` (Login, Register, Banned, Maintenance), `PageShell` sur ~35 pages, `Card` / `Item` / `Empty` / `Alert` pour les surfaces récemment migrées.

## 11. Avancement de la refonte (2026-10-06)

Garde-fous : `frontend/src/ui-consistency.test.ts` (22 tests au total avec les tests existants).

### Fait

| Sujet | Résultat |
|---|---|
| Conteneur de page | `PageShell` unique (`max-w-7xl`, `p-4 md:p-6`, `gap-6`), sans variante de largeur. Clans, Forum, Sudoku, Echecs, HorseRace, Loto alignés. Polymarket, Messages/Support, Admin, Aura Coin/Stable/Chaos, Salle de marché, Clash Village migrés. |
| En-tête de page | `PageHeader` partout (titre et description lus dans `page-meta.ts`). `GameShell` l'affiche aussi ; `GameTopBar` n'a plus de titre. 60 des 65 routes sondées conformes (le reste : Loto, mesure faussée par l'overlay de confettis ; 4 faux positifs « $ » corrigés depuis). |
| Noms de pages | Une seule source (`page-meta.ts`), toutes les routes enregistrées, sidebar alignée (Classement, Groupe, Règlement, Tutoriels, Marché). |
| Emojis | Retirés des titres, messages d'état, logs admin ; icônes lucide à la place. Conservés dans le contenu des jeux (symboles, produits, réactions, carte). |
| Typographie | `h1` 24 px partout (profil et carte exceptés, voir test), `h2` = `text-lg font-semibold`, `h3` = `text-base font-semibold`. |
| Dialogues | Plus de `confirm`/`alert` natifs ; Dialog pour la bienvenue du tutoriel et le choix de couleur d'Uno. |
| Écrans de jeu | `GameStartOverlay` / `GameOverOverlay` (même libellé, mêmes boutons, même format de récompenses) sur 10 jeux. |
| Monnaie | Euro partout ; `lib/format.ts` (formatMoney, formatSignedMoney, formatCompactMoney, formatRewards) ; backend (notification de Passe, badges du seed) aligné. |
| Langue | Accents corrigés sur ~330 chaînes, apostrophes, tutoiement généralisé (~110 phrases). |
| Tableaux | Les 7 `<table>` de l'admin utilisent le composant `Table`. |

### Reste à faire / limites connues

- `pages/Games.tsx` et `lib/game-images.ts` : travail en cours côté utilisateur, volontairement non commités. Contiennent encore ~120 montants en `$` (corrigés dans l'arbre de travail, non commités), du vouvoiement et des accents manquants.
- Accents : un détecteur trouve encore ~580 occurrences candidates dans 88 fichiers (dont beaucoup de mots valides sans accent comme « base » ou « mise »). Les plus concentrées : `AdminPage`, `you/components/modals`, `lib/i18n`, `Tutoriels`, `Clans`.
- `lib/tutorials/*` : non repris pour le tutoiement ni la monnaie.
- `<button>` bruts (≈125) et `<input>` (19, surtout `file` et `color`) : non convertis, un audit au cas par cas reste nécessaire.
- Couches plein écran faites main conservées : intro vidéo, confettis, animations de récompense, tutoriel pas à pas.
- Couleurs de palette brutes : confinées aux plateaux de jeu thématiques (Casino, HorseRace, Uno, Minesweeper…) et aux textes sur images.
- Données de démonstration en anglais dans le seed (« Seed now includes… ») et défaut `authorName` du schéma Prisma (« Equipe AuraTracker », nécessiterait une migration).
- Les jeux plateau multi-joueurs gardent leurs écrans de fin propres (Uno, Poker, Échecs, etc.).
