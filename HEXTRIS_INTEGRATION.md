# 🎮 Guide d'Intégration Hextris - AuraTracker

## 📋 Résumé de l'intégration

Hextris a été intégré au site AuraTracker avec succès. Le jeu reprend la même architecture que les autres jeux du site.

## 🎯 Fonctionnalités

✅ **Score Management**
- Capture automatique du score via postMessage
- Détection de fin de partie
- Nouveau record détecté et signalé

✅ **Récompenses**
- Calcul progressif des récompenses basé sur le score
- Bonus aura supplémentaire pour nouveau meilleur score
- Classement automatiquement mis à jour

✅ **Interface**
- Barre de contrôle supérieure (GameTopBar) avec score et meilleur score
- Classement visible (GameLeaderboard)
- Mode fullscreen supporté
- Button de redémarrage après fin de partie

✅ **Architecture**
- Jeu isolé en iframe pour éviter les conflits
- Communication secure via postMessage (vérification origin)
- Compatible avec tous les navigateurs modernes

## 🔧 Architecture technique

### Frontend (`/frontend`)

1. **Page Hextris** (`src/pages/Hextris.tsx`)
   - Composant React principal
   - Gère l'état du jeu (score, highScore, gameOver, etc.)
   - Communique avec le jeu via postMessage
   - Soumet les scores au backend

2. **Routing** (`src/App.tsx`)
   - Route: `/games/hextris`
   - Affichée dans la liste des jeux

3. **Game List** (`src/pages/Games.tsx`)
   - Hextris liste les jeux disponibles
   - Type: 'Puzzle'
   - Image et description intégrées

4. **Intégration du jeu** (`public/hextris/`)
   - Jeu Hextris original cloné
   - Script d'intégration: `js/auratracker-integration.js`
   - Index.html modifié pour charger le bridge

### Backend (`/backend`)

1. **Game Routes** (`src/routes/games.ts`)
   - Label: `hextris: 'Hextris'`
   - Configuration des récompenses
   - Fonction de calcul: `calculateHextrisRewards()`
   - Intégration dans le switch des types de jeux

2. **Reward Tiers**
   ```
   Score 0-399:        0.05x score + 0 aura
   Score 400-799:      0.08x score + 5 aura
   Score 800-1599:     0.12x score + 10 aura
   Score 1600-3199:    0.18x score + 20 aura
   Score 3200+:        0.25x score + 35 aura
   ```

## 📡 Flux de communication

```
1. Joueur lance le jeu Hextris (iframe)
   ↓
2. Script d'intégration detecte les scores (100ms polling)
   ↓
3. postMessage HEXTRIS_SCORE_UPDATE → parent React
   ↓
4. React affiche le score en temps réel
   ↓
5. Détection GAME_OVER (affichage écran fin de partie)
   ↓
6. postMessage HEXTRIS_GAME_OVER → parent React
   ↓
7. React soumet le score: POST /api/games/hextris/complete
   ↓
8. Backend:
   - Valide le score
   - Calcule récompenses
   - Met à jour highScore si nécessaire
   - Sauvegarde dans la base de données
   ↓
9. React affiche les résultats, récompenses, nouveau record
   ↓
10. Classement actualisé automatiquement
```

## 🎮 Comment jouer

1. Aller à `/games` → Hextris
2. Cliquer pour commencer une partie
3. Le jeu se lance en iframe
4. Score visible en temps réel en haut
5. À la fin, voir résultats et récompenses
6. Cliquer "Rejouer" pour une nouvelle partie

## 🔐 Sécurité

- Communication postMessage avec vérification d'origin
- Validation des scores au backend
- Sandbox iframe: `allow-same-origin allow-scripts allow-forms`
- Isolation du jeu par rapport au reste de l'app

## 📊 Statistiques

- **Type de jeu**: Puzzle
- **Système de score**: Cumulatif (score augmente pendant la partie)
- **Multijoueur**: Non (possibilité future)
- **Récompenses**: Oui
- **Classements**: Oui
- **Badges/Achievements**: Possibilité d'ajouter

## 🚀 Optimisations futures

1. Ajouter des skins/cosmétiques pour le jeu
2. Implémenter un mode multijoueur en temps réel
3. Ajouter des défis quotidiens/hebdomadaires
4. Intégrer des achievements/badges spécifiques
5. Ajouter des statistiques détaillées (temps joué, etc.)

## 🐛 Dépannage

### Le jeu ne démarre pas
- Vérifier que `/hextris/index.html` existe
- Vérifier que les scripts sont chargés (console F12)
- Vérifier les erreurs CORS (unlikely avec same-origin)

### Les scores ne se soumettent pas
- Vérifier que l'utilisateur est connecté
- Vérifier les logs du backend
- Vérifier que `gamesApi.completeGame()` fonctionne

### Le classement ne se met pas à jour
- Force rafraîchir (Ctrl+F5)
- Vérifier que le backend a reçu le score (logs)
- Vérifier la base de données (Prisma)

## 📝 Fichiers modifiés

### Frontend
- `frontend/src/pages/Hextris.tsx` (new)
- `frontend/src/App.tsx` (import + route)
- `frontend/src/pages/Games.tsx` (ajout à la liste)
- `frontend/src/lib/game-images.ts` (image mapping)
- `frontend/public/hextris/` (jeu)
- `frontend/public/hextris/js/auratracker-integration.js` (new)
- `frontend/public/hextris/index.html` (script ajouté)
- `frontend/public/images/games/hextris.png` (new)

### Backend
- `backend/src/routes/games.ts`
  - GAME_CHAT_LABELS (label ajouté)
  - GAME_REWARDS (config ajoutée)
  - calculateHextrisRewards() (fonction new)
  - Condition dans le switch (ajoutée)

## ✅ Checklist de validation

- [x] Jeu clôné sans modifications majeurs
- [x] Page React intégrée
- [x] Routes frontend et backend ajoutées
- [x] Script d'intégration crée
- [x] Labels et récompenses configurées
- [x] Image du jeu ajoutée
- [x] Aucune erreur de compilation
- [x] UI cohérente avec les autres jeux
- [x] Classements fonctionnels
- [x] Communication postMessage sécurisée
