# Codebase Guide

This document explains where the main routes, pages, and core files live, and how the application is assembled.

## Build And Runtime Model

- The root `npm run dev` script runs both apps through `concurrently`.
- The backend runs with `tsx watch src/server.ts` and boots the Express server, Socket.io server, Prisma client, and scheduled background jobs.
- The backend `predev` and `prebuild` scripts run `prisma generate`; `predev` also runs `prisma db push --skip-generate`.
- The frontend runs on Vite at port 5173 and proxies `/api` and `/socket.io` to the backend on port 3000.
- Frontend routing is handled in `frontend/src/App.tsx` with `react-router-dom`.
- The app shell is built in `frontend/src/components/layout/Layout.tsx` and shared providers are mounted in `frontend/src/main.tsx`.

## Main Entry Points

- [backend/src/server.ts](backend/src/server.ts) wires middleware, REST routes, static assets, sockets, and startup logic.
- [backend/src/config/index.ts](backend/src/config/index.ts) loads runtime configuration.
- [backend/prisma/schema.prisma](backend/prisma/schema.prisma) defines the database models.
- [frontend/src/main.tsx](frontend/src/main.tsx) mounts providers and the router.
- [frontend/src/App.tsx](frontend/src/App.tsx) declares all client routes.
- [frontend/src/config/blockedPages.ts](frontend/src/config/blockedPages.ts) defines pages that can be blocked by maintenance controls.

## Backend Route Map

All REST route modules are mounted from [backend/src/server.ts](backend/src/server.ts). The route files are:

- `backend/src/routes/auth.ts` -> `/api/auth`
- `backend/src/routes/economy.ts` -> `/api/economy`
- `backend/src/routes/marketplace.ts` -> `/api/marketplace`
- `backend/src/routes/games.ts` -> `/api/games`
- `backend/src/routes/leaderboards.ts` -> `/api/leaderboards`
- `backend/src/routes/users.ts` -> `/api/users`
- `backend/src/routes/admin.ts` -> `/api/admin`
- `backend/src/routes/auracoin.ts` -> `/api/auracoin`
- `backend/src/routes/marketRoom.ts` -> `/api/market-room`
- `backend/src/routes/suggestions.ts` -> `/api/suggestions`
- `backend/src/routes/bombparty.ts` -> `/api/bombparty`
- `backend/src/routes/uploads.ts` -> `/api/uploads`
- `backend/src/routes/maintenance.ts` -> `/api/maintenance`
- `backend/src/routes/clans.ts` -> `/api/clans`
- `backend/src/routes/polymarket.ts` -> `/api/polymarket`
- `backend/src/routes/pass.ts` -> `/api/pass`
- `backend/src/routes/quests.ts` -> `/api/quests`
- `backend/src/routes/solitaire.ts` -> `/api/solitaire`
- `backend/src/routes/notifications.ts` -> `/api/notifications`
- `backend/src/routes/badges.ts` -> `/api/badges`
- `backend/src/routes/customBadges.ts` -> `/api/custom-badges`
- `backend/src/routes/support.ts` -> `/api/support`
- `backend/src/routes/clash.ts` -> `/api/clash`
- `backend/src/routes/polytrack.ts` -> `/api/polytrack`
- `backend/src/routes/changelog.ts` -> `/api/changelog`
- `backend/src/routes/you.ts` -> `/api/you`
- `backend/src/routes/ads.ts` -> `/api/ads`
- `backend/src/routes/messages.ts` -> `/api/messages`
- `backend/src/routes/justice.ts` -> `/api/justice`

Special admin Prisma Studio access is handled directly in `backend/src/server.ts` through `backend/src/routes/prismaStudio.ts`.

## Socket Handlers

Socket logic lives in `backend/src/socket/` and is registered in `backend/src/server.ts`.

- `backend/src/socket/chat.ts`
- `backend/src/socket/party.ts`
- `backend/src/socket/games.ts`
- `backend/src/socket/bombparty.ts`
- `backend/src/socket/poker.ts`
- `backend/src/socket/petitbac.ts`
- `backend/src/socket/battleship.ts`
- `backend/src/socket/puissancequatre.ts`
- `backend/src/socket/chess.ts`
- `backend/src/socket/duel.ts`
- `backend/src/socket/aiDuel.ts`
- `backend/src/socket/russianroulette.ts`
- `backend/src/socket/ballarena.ts`
- `backend/src/socket/uno.ts`
- `backend/src/socket/morpion.ts`

## Frontend Route Map

The public auth routes are defined first in [frontend/src/App.tsx](frontend/src/App.tsx):

- `/login` -> `frontend/src/pages/Login.tsx`
- `/banned` -> `frontend/src/pages/Banned.tsx`
- `/register` -> `frontend/src/pages/Register.tsx`

The protected app shell is rendered through `frontend/src/components/layout/Layout.tsx` and contains the main experience:

- `/` -> default redirect controlled by maintenance status
- `/dashboard` -> `frontend/src/pages/Dashboard.tsx`
- `/messages` -> `frontend/src/pages/Messages.tsx`
- `/games` -> `frontend/src/pages/Games.tsx`
- `/games/doodle-jump` -> `frontend/src/pages/DoodleJump.tsx`
- `/games/2048` -> `frontend/src/pages/Game2048.tsx`
- `/games/flappy-bird` -> `frontend/src/pages/FlappyBird.tsx`
- `/games/chrome-dino` -> `frontend/src/pages/ChromeDino.tsx`
- `/games/snake` -> `frontend/src/pages/Snake.tsx`
- `/games/blockblast` -> `frontend/src/pages/BlockBlast.tsx`
- `/games/fruit-ninja` -> `frontend/src/pages/FruitNinja.tsx`
- `/games/qs-watermelon` -> `frontend/src/pages/QSWatermelon.tsx`
- `/games/stack-tower` -> `frontend/src/pages/StackTower.tsx`
- `/games/geometry-dash` -> `frontend/src/pages/GeometryDash.tsx`
- `/games/casino` -> `frontend/src/pages/Casino.tsx`
- `/games/soccer` -> redirects to `/games/casino?table=soccer`
- `/games/mines` -> redirects to `/games/casino?table=mines`
- `/games/crash` -> redirects to `/games/casino?table=crash`
- `/games/salle-de-marche` -> `frontend/src/pages/MarketRoom.tsx`
- `/games/aura-coin` -> `frontend/src/pages/AuraCoin.tsx`
- `/games/stable-coin` -> `frontend/src/pages/StableCoin.tsx`
- `/games/chaos-coin` -> `frontend/src/pages/ChaosCoin.tsx`
- `/games/minesweeper` -> `frontend/src/pages/Minesweeper.tsx`
- `/market` and `/market/*` -> `frontend/src/pages/Shop.tsx`
- `/marketplace` and `/marketplace/*` -> `frontend/src/pages/Marketplace.tsx`
- `/games/bomb-party` -> `frontend/src/pages/BombParty.tsx`
- `/games/poker` -> `frontend/src/pages/Poker.tsx`
- `/games/petit-bac` -> `frontend/src/pages/PetitBac.tsx`
- `/games/bataille-navale` -> `frontend/src/pages/BatailleNavale.tsx`
- `/games/solitaire` -> `frontend/src/pages/Solitaire.tsx`
- `/games/racer` -> `frontend/src/pages/Racer.tsx`
- `/games/tetris` -> `frontend/src/pages/Tetris.tsx`
- `/games/knife-hit` -> `frontend/src/pages/KnifeHit.tsx`
- `/games/goyave-empire` -> `frontend/src/pages/GoyaveEmpire.tsx`
- `/games/clash-village` -> `frontend/src/pages/ClashVillage.tsx`
- `/games/puissance-quatre` -> `frontend/src/pages/PuissanceQuatre.tsx`
- `/games/echecs` -> `frontend/src/pages/Echecs.tsx`
- `/games/ball-arena` -> `frontend/src/pages/BallArena.tsx`
- `/games/logic-lab` -> `frontend/src/pages/Sudoku.tsx`
- `/games/russian-roulette` -> `frontend/src/pages/RussianRoulette.tsx`
- `/games/uno` -> `frontend/src/pages/Uno.tsx`
- `/games/morpion` -> `frontend/src/pages/Morpion.tsx`
- `/games/polytrack` -> `frontend/src/pages/Polytrack.tsx`
- `/games/eaglercraft` -> `frontend/src/pages/Eaglercraft.tsx`
- `/games/subway-surfers` -> `frontend/src/pages/SubwaySurfers.tsx`
- `/games/hexgl` -> `frontend/src/pages/HexGL.tsx`
- `/games/opengd` -> `frontend/src/pages/OpenGD.tsx`
- `/games/crossy-road` -> `frontend/src/pages/CrossyRoad.tsx`
- `/polymarket` -> `frontend/src/pages/Polymarket.tsx`
- `/leaderboards` -> `frontend/src/pages/Leaderboards.tsx`
- `/leaderboards/nombres` -> `frontend/src/pages/Numbers.tsx`
- `/party` -> `frontend/src/pages/Party.tsx`
- `/clans` -> `frontend/src/pages/Clans.tsx`
- `/inventory` -> `frontend/src/pages/Inventory.tsx`
- `/profile/:userId?` -> `frontend/src/pages/Profile.tsx`
- `/admin` -> `frontend/src/pages/Admin.tsx`
- `/rules` -> `frontend/src/pages/Rules.tsx`
- `/pass` -> `frontend/src/pages/Pass.tsx`
- `/quests` -> `frontend/src/pages/Quests.tsx`
- `/suggestions` -> `frontend/src/pages/Suggestions.tsx`
- `/settings` -> `frontend/src/pages/Settings.tsx`
- `/inbox` -> `frontend/src/pages/Inbox.tsx`
- `/support` -> `frontend/src/pages/Support.tsx`
- `/changelog` -> `frontend/src/pages/Changelog.tsx`
- `/you` -> `frontend/src/pages/You.tsx`

## Where Pages Are Organized

- `frontend/src/pages/admin/` contains the admin page tabs and subviews.
- `frontend/src/pages/you/` contains the simulation tabs and UI pieces for the "You" experience.
- `frontend/src/pages/` holds one file per route for the main application screens.
- `frontend/src/components/layout/` contains the persistent shell, header, sidebar, and global modals.
- `frontend/src/components/game/` contains prompts, overlays, and full-screen helpers shared by games.
- `frontend/src/components/chat/`, `frontend/src/components/party/`, `frontend/src/components/clans/`, `frontend/src/components/badges/`, `frontend/src/components/support/`, and `frontend/src/components/rewards/` group feature-specific UI.
- `frontend/src/services/api.ts` and `frontend/src/services/socket.ts` centralize HTTP and realtime client access.
- `frontend/src/contexts/` contains the app-wide providers for auth, sockets, notifications, features, theme, and rewards.
- `frontend/src/lib/` contains reusable helpers, design-system values, and shared utilities.

## Static Assets And Embedded Games

- `frontend/public/polytrack/`, `frontend/public/eaglercraft/`, and `frontend/public/watermelon/` are served as static game bundles.
- `frontend/public/assets/`, `frontend/public/images/`, `frontend/public/themes/`, and the other folders under `frontend/public/` hold static media and site assets.
- `frontend/vite.config.ts` defines the `@` alias and the dev server proxy rules.
- `backend/src/server.ts` also exposes the embedded game folders and upload directories.

## Useful Starting Points

- If you need the app shell, start with `frontend/src/components/layout/Layout.tsx`.
- If you need client routing, start with `frontend/src/App.tsx`.
- If you need server routing, start with `backend/src/server.ts`.
- If you need business logic for the life-sim mode, start in `backend/src/modules/you/` and `frontend/src/pages/you/`.
- If you need maintenance behavior, check `backend/src/routes/maintenance.ts` and `frontend/src/config/blockedPages.ts`.