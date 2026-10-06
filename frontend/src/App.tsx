import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Games = lazy(() => import('./pages/Games'));
const DoodleJump = lazy(() => import('./pages/DoodleJump'));
const Game2048 = lazy(() => import('./pages/Game2048'));
const FlappyBird = lazy(() => import('./pages/FlappyBird'));
const Casino = lazy(() => import('./pages/Casino'));
const AuraCoin = lazy(() => import('./pages/AuraCoin'));
const StableCoin = lazy(() => import('./pages/StableCoin'));
const ChaosCoin = lazy(() => import('./pages/ChaosCoin'));
const MarketRoom = lazy(() => import('./pages/MarketRoom'));
const Leaderboards = lazy(() => import('./pages/Leaderboards'));
const Numbers = lazy(() => import('./pages/Numbers'));
const Profile = lazy(() => import('./pages/Profile'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Shop = lazy(() => import('./pages/Shop'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const Party = lazy(() => import('./pages/Party'));
const Clans = lazy(() => import('./pages/Clans'));
const BombParty = lazy(() => import('./pages/BombParty'));
const Poker = lazy(() => import('./pages/Poker'));
const PetitBac = lazy(() => import('./pages/PetitBac'));
const BatailleNavale = lazy(() => import('./pages/BatailleNavale'));
const Polymarket = lazy(() => import('./pages/Polymarket'));
const PixelBoard = lazy(() => import('./pages/PixelBoard'));
const Admin = lazy(() => import('./pages/Admin'));
const Rules = lazy(() => import('./pages/Rules'));
const Tutoriels = lazy(() => import('./pages/Tutoriels'));
const Suggestions = lazy(() => import('./pages/Suggestions'));
import Maintenance from './pages/Maintenance';
const Settings = lazy(() => import('./pages/Settings'));
import Banned from './pages/Banned';
import NotFound from './pages/NotFound';
const Quests = lazy(() => import('./pages/Quests'));
const Solitaire = lazy(() => import('./pages/Solitaire'));
const Racer = lazy(() => import('./pages/Racer'));
const Tetris = lazy(() => import('./pages/Tetris'));
const KnifeHit = lazy(() => import('./pages/KnifeHit'));
const GoyaveEmpire = lazy(() => import('./pages/GoyaveEmpire'));
const ClashVillage = lazy(() => import('./pages/ClashVillage'));
const PuissanceQuatre = lazy(() => import('./pages/PuissanceQuatre'));
const Echecs = lazy(() => import('./pages/Echecs'));
const BallArena = lazy(() => import('./pages/BallArena'));
const Sudoku = lazy(() => import('./pages/Sudoku'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Messages = lazy(() => import('./pages/Messages'));
import Blocked from './pages/Blocked';
const Minesweeper = lazy(() => import('./pages/Minesweeper'));
const GeometryDash = lazy(() => import('./pages/GeometryDash'));
const RussianRoulette = lazy(() => import('./pages/RussianRoulette'));
const Uno = lazy(() => import('./pages/Uno'));
const Morpion = lazy(() => import('./pages/Morpion'));
const ChromeDino = lazy(() => import('./pages/ChromeDino'));
const FruitNinja = lazy(() => import('./pages/FruitNinja'));
const StackTower = lazy(() => import('./pages/StackTower'));
const Snake = lazy(() => import('./pages/Snake'));
const Support = lazy(() => import('./pages/Support'));
const BraquageLegal = lazy(() => import('./pages/BraquageLegal'));
const QSWatermelon = lazy(() => import('./pages/QSWatermelon'));
const Polytrack = lazy(() => import('./pages/Polytrack'));
const Eaglercraft = lazy(() => import('./pages/Eaglercraft'));
const HexGL = lazy(() => import('./pages/HexGL'));
const CrossyRoad = lazy(() => import('./pages/CrossyRoad'));
const BlockBlast = lazy(() => import('./pages/BlockBlast'));
const Hextris = lazy(() => import('./pages/Hextris'));
const PaperIo = lazy(() => import('./pages/PaperIo'));
const DotsAndBoxes = lazy(() => import('./pages/DotsAndBoxes'));
const HorseRace = lazy(() => import('./pages/HorseRace'));
const You = lazy(() => import('./pages/You'));
const IntroVideo = lazy(() => import('./components/IntroVideo'));
const Forum = lazy(() => import('./pages/Forum'));
const ForumPost = lazy(() => import('./pages/ForumPost'));
import { BLOCKABLE_PAGES } from './config/blockedPages';
import { useFeatures } from './contexts/FeaturesContext';
import { CenteredSkeletonCard } from '@/components/ui/loading-skeletons';
import { getPageMetaForPath } from '@/lib/page-meta';

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

  useEffect(() => {
    const pageTitle = getPageMetaForPath(location.pathname).title;
    document.title = location.pathname === '/' ? 'Aura Tracker' : `${pageTitle} | Aura Tracker`;
  }, [location.pathname]);

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
    <>
    {user && !user.hasSeenIntroVideo && (
      <Suspense fallback={null}>
        <IntroVideo />
      </Suspense>
    )}
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
        <Route path="games/hexgl" element={<HexGL />} />
        <Route path="games/crossy-road" element={<CrossyRoad />} />
        <Route path="games/hextris" element={<Hextris />} />
        <Route path="games/paper-io" element={<PaperIo />} />
        <Route path="games/dotsandboxes" element={<DotsAndBoxes />} />
        <Route path="games/horse-race" element={<HorseRace />} />
        <Route path="polymarket" element={<Polymarket />} />
        <Route path="pixel-board" element={<PixelBoard />} />
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
        <Route path="changelog" element={<Navigate to="/dashboard" replace />} />
        <Route path="loto" element={<BraquageLegal />} />
        <Route path="braquage-legal" element={<Navigate to="/loto" replace />} />
        <Route path="you" element={<You />} />
        <Route path="forum" element={<Forum />} />
        <Route path="forum/c/:subredditName" element={<Forum />} />
        <Route path="forum/c/:subredditName/post/:postId" element={<ForumPost />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  );
}

export default App;
