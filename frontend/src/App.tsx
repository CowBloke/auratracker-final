import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Games from './pages/Games';
import DoodleJump from './pages/DoodleJump';
import Game2048 from './pages/Game2048';
import FlappyBird from './pages/FlappyBird';
import Casino from './pages/Casino';
import AuraCoin from './pages/AuraCoin';
import StableCoin from './pages/StableCoin';
import ChaosCoin from './pages/ChaosCoin';
import MarketRoom from './pages/MarketRoom';
import Leaderboards from './pages/Leaderboards';
import Numbers from './pages/Numbers';
import Profile from './pages/Profile';
import Inventory from './pages/Inventory';
import Shop from './pages/Shop';
import Marketplace from './pages/Marketplace';
import Party from './pages/Party';
import Clans from './pages/Clans';
import BombParty from './pages/BombParty';
import Poker from './pages/Poker';
import PetitBac from './pages/PetitBac';
import BatailleNavale from './pages/BatailleNavale';
import Polymarket from './pages/Polymarket';
import Admin from './pages/Admin';
import Rules from './pages/Rules';
import Tutoriels from './pages/Tutoriels';
import Suggestions from './pages/Suggestions';
import Maintenance from './pages/Maintenance';
import Settings from './pages/Settings';
import Banned from './pages/Banned';
import Quests from './pages/Quests';
import Solitaire from './pages/Solitaire';
import Racer from './pages/Racer';
import Tetris from './pages/Tetris';
import KnifeHit from './pages/KnifeHit';
import GoyaveEmpire from './pages/GoyaveEmpire';
import ClashVillage from './pages/ClashVillage';
import PuissanceQuatre from './pages/PuissanceQuatre';
import Echecs from './pages/Echecs';
import BallArena from './pages/BallArena';
import Sudoku from './pages/Sudoku';
import Inbox from './pages/Inbox';
import Messages from './pages/Messages';
import Blocked from './pages/Blocked';
import Minesweeper from './pages/Minesweeper';
import GeometryDash from './pages/GeometryDash';
import RussianRoulette from './pages/RussianRoulette';
import Uno from './pages/Uno';
import Morpion from './pages/Morpion';
import ChromeDino from './pages/ChromeDino';
import FruitNinja from './pages/FruitNinja';
import StackTower from './pages/StackTower';
import Snake from './pages/Snake';
import Support from './pages/Support';
import Changelog from './pages/Changelog';
import BraquageLegal from './pages/BraquageLegal';
import QSWatermelon from './pages/QSWatermelon';
import Polytrack from './pages/Polytrack';
import Eaglercraft from './pages/Eaglercraft';
import SubwaySurfers from './pages/SubwaySurfers';
import HexGL from './pages/HexGL';
import OpenGD from './pages/OpenGD';
import CrossyRoad from './pages/CrossyRoad';
import BlockBlast from './pages/BlockBlast';
import You from './pages/You';
import { BLOCKABLE_PAGES } from './config/blockedPages';
import { useFeatures } from './contexts/FeaturesContext';
import { CenteredSkeletonCard } from '@/components/ui/loading-skeletons';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <CenteredSkeletonCard />
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/register" replace />;
  }
  
  return <>{children}</>;
}

function DefaultLandingRedirect() {
  const { maintenanceStatus, maintenanceLoading } = useFeatures();

  if (maintenanceLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <CenteredSkeletonCard />
        </div>
      </div>
    );
  }

  return <Navigate to={maintenanceStatus.defaultLandingPage} replace />;
}

function App() {
  const location = useLocation();
  const { maintenanceStatus, maintenanceLoading } = useFeatures();
  const { user, loading } = useAuth();
  const canBypassMaintenance = Boolean(user?.isAdmin || user?.isSuperAdmin || user?.isBetaTester);

  // Vérifier si la page actuelle est en maintenance
  const isCurrentPageInMaintenance = () => {
    if (maintenanceLoading || loading || !maintenanceStatus.enabled || canBypassMaintenance) {
      return false;
    }

    // Toujours permettre l'accès aux pages admin, login et register
    if (
      location.pathname.startsWith('/admin') ||
      location.pathname.startsWith('/maintenance') ||
      location.pathname === '/login' ||
      location.pathname === '/register'
    ) {
      return false;
    }

    // Maintenance globale : toutes les autres pages sont bloquées
    return true;
  };

  const isCurrentPageBlocked = () => {
    if (maintenanceLoading || loading || canBypassMaintenance) {
      return false;
    }

    if (
      location.pathname.startsWith('/admin') ||
      location.pathname.startsWith('/maintenance') ||
      location.pathname === '/login' ||
      location.pathname === '/register'
    ) {
      return false;
    }

    if (!maintenanceStatus.disabledPages || maintenanceStatus.disabledPages.length === 0) {
      return false;
    }

    return BLOCKABLE_PAGES.some((page) => {
      if (!maintenanceStatus.disabledPages.includes(page.key)) {
        return false;
      }

      if (page.path === '/') {
        return location.pathname === '/' || location.pathname === '/dashboard';
      }

      return (
        location.pathname === page.path ||
        location.pathname.startsWith(`${page.path}/`)
      );
    });
  };

  const getCurrentBlockedPageKey = () => {
    if (!maintenanceStatus.disabledPages || maintenanceStatus.disabledPages.length === 0) {
      return null;
    }

    const matchedPage = BLOCKABLE_PAGES.find((page) => {
      if (!maintenanceStatus.disabledPages.includes(page.key)) {
        return false;
      }

      if (page.path === '/') {
        return location.pathname === '/' || location.pathname === '/dashboard';
      }

      return (
        location.pathname === page.path ||
        location.pathname.startsWith(`${page.path}/`)
      );
    });

    return matchedPage?.key ?? null;
  };

  if (loading || maintenanceLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <CenteredSkeletonCard />
        </div>
      </div>
    );
  }

  if (isCurrentPageInMaintenance()) {
    return <Maintenance message={maintenanceStatus.message} endDate={maintenanceStatus.endDate} />;
  }

  if (isCurrentPageBlocked()) {
    const blockedPageKey = getCurrentBlockedPageKey();
    const pageSpecificMessage = blockedPageKey
      ? maintenanceStatus.blockedPageMessages?.[blockedPageKey]
      : undefined;
    return <Blocked message={pageSpecificMessage || maintenanceStatus.blockedMessage} />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/banned" element={<Banned />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DefaultLandingRedirect />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="messages" element={<Messages />} />
        <Route path="games" element={<Games />} />
        <Route path="games/doodle-jump" element={<DoodleJump />} />
        <Route path="games/2048" element={<Game2048 />} />
        <Route path="games/flappy-bird" element={<FlappyBird />} />
        <Route path="games/chrome-dino" element={<ChromeDino />} />
        <Route path="games/snake" element={<Snake />} />
        <Route path="games/blockblast" element={<BlockBlast />} />
        <Route path="games/fruit-ninja" element={<FruitNinja />} />
        <Route path="games/qs-watermelon" element={<QSWatermelon />} />
        <Route path="games/stack-tower" element={<StackTower />} />
        <Route path="games/geometry-dash" element={<GeometryDash />} />
        <Route path="games/casino" element={<Casino />} />
        <Route path="games/soccer" element={<Navigate to="/games/casino?table=soccer" replace />} />
        <Route path="games/mines" element={<Navigate to="/games/casino?table=mines" replace />} />
        <Route path="games/crash" element={<Navigate to="/games/casino?table=crash" replace />} />
        <Route path="games/salle-de-marche" element={<MarketRoom />} />
        <Route path="games/aura-coin" element={<AuraCoin />} />
        <Route path="games/stable-coin" element={<StableCoin />} />
        <Route path="games/chaos-coin" element={<ChaosCoin />} />
        <Route path="games/minesweeper" element={<Minesweeper />} />
        <Route path="market" element={<Shop />} />
        <Route path="market/*" element={<Shop />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="marketplace/*" element={<Marketplace />} />
        <Route path="games/bomb-party" element={<BombParty />} />
        <Route path="games/poker" element={<Poker />} />
        <Route path="games/petit-bac" element={<PetitBac />} />
        <Route path="games/bataille-navale" element={<BatailleNavale />} />
        <Route path="games/solitaire" element={<Solitaire />} />
        <Route path="games/racer" element={<Racer />} />
        <Route path="games/tetris" element={<Tetris />} />
        <Route path="games/knife-hit" element={<KnifeHit />} />
        <Route path="games/goyave-empire" element={<GoyaveEmpire />} />
        <Route path="games/clash-village" element={<ClashVillage />} />
        <Route path="games/puissance-quatre" element={<PuissanceQuatre />} />
        <Route path="games/echecs" element={<Echecs />} />
        <Route path="games/ball-arena" element={<BallArena />} />
        <Route path="games/logic-lab" element={<Sudoku />} />
        <Route path="games/russian-roulette" element={<RussianRoulette />} />
        <Route path="games/uno" element={<Uno />} />
        <Route path="games/morpion" element={<Morpion />} />
        <Route path="games/polytrack" element={<Polytrack />} />
        <Route path="games/eaglercraft" element={<Eaglercraft />} />
        <Route path="games/subway-surfers" element={<SubwaySurfers />} />
        <Route path="games/hexgl" element={<HexGL />} />
        <Route path="games/opengd" element={<OpenGD />} />
        <Route path="games/crossy-road" element={<CrossyRoad />} />
        <Route path="polymarket" element={<Polymarket />} />
        <Route path="leaderboards" element={<Leaderboards />} />
        <Route path="leaderboards/nombres" element={<Numbers />} />
        <Route path="party" element={<Party />} />
        <Route path="clans" element={<Clans />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="profile/:userId?" element={<Profile />} />
        <Route path="admin" element={<Admin />} />
        <Route path="rules" element={<Rules />} />
        <Route path="tutoriels" element={<Tutoriels />} />
        <Route path="pass" element={<Navigate to="/quests" replace />} />
        <Route path="quests" element={<Quests />} />
        <Route path="suggestions" element={<Suggestions />} />
        <Route path="settings" element={<Settings />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="support" element={<Support />} />
        <Route path="changelog" element={<Changelog />} />
        <Route path="loto" element={<BraquageLegal />} />
        <Route path="braquage-legal" element={<Navigate to="/loto" replace />} />
        <Route path="you" element={<You />} />
      </Route>
    </Routes>
  );
}

export default App;
