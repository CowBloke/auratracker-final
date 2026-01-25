import { useEffect, useState } from 'react';
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
import Clash from './pages/Clash';
import Casino from './pages/Casino';
import AuraCoin from './pages/AuraCoin';
import Solaris from './pages/Solaris';
import Zenith from './pages/Zenith';
import Rift from './pages/Rift';
import MarketHall from './pages/MarketHall';
import MarketTrade from './pages/MarketTrade';
import Leaderboards from './pages/Leaderboards';
import Numbers from './pages/Numbers';
import Profile from './pages/Profile';
import Inventory from './pages/Inventory';
import Party from './pages/Party';
import Clans from './pages/Clans';
import BombParty from './pages/BombParty';
import Poker from './pages/Poker';
import PetitBac from './pages/PetitBac';
import BatailleNavale from './pages/BatailleNavale';
import RussianRoulette from './pages/RussianRoulette';
import Polymarket from './pages/Polymarket';
import Admin from './pages/Admin';
import Gallery from './pages/Gallery';
import PlayerMarket from './pages/PlayerMarket';
import GalleryAdmin from './pages/GalleryAdmin';
import Rules from './pages/Rules';
import Suggestions from './pages/Suggestions';
import Pass from './pages/Pass';
import Maintenance from './pages/Maintenance';
import Settings from './pages/Settings';
import Banned from './pages/Banned';
import Quests from './pages/Quests';
import Solitaire from './pages/Solitaire';
import { maintenanceApi } from './services/api';
import Blocked from './pages/Blocked';
import { BLOCKABLE_PAGES } from './config/blockedPages';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary text-xl">
          Chargement...
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  const location = useLocation();
  const [maintenanceStatus, setMaintenanceStatus] = useState<{
    enabled: boolean;
    message: string;
    pages: string[];
    endDate: string | null;
    blockedPages: string[];
    blockedMessage: string;
  }>({
    enabled: false,
    message: '',
    pages: [],
    endDate: null,
    blockedPages: [],
    blockedMessage: '',
  });
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const fetchMaintenance = async () => {
      try {
        const res = await maintenanceApi.getStatus();
        if (!isActive) return;
        setMaintenanceStatus({
          enabled: res.data.enabled,
          message: res.data.message || '',
          pages: res.data.pages || [],
          endDate: res.data.endDate || null,
          blockedPages: res.data.blockedPages || [],
          blockedMessage: res.data.blockedMessage || '',
        });
      } catch (error) {
        if (!isActive) return;
        setMaintenanceStatus({ enabled: false, message: '', pages: [], endDate: null, blockedPages: [], blockedMessage: '' });
      } finally {
        if (isActive) {
          setMaintenanceLoading(false);
        }
      }
    };

    fetchMaintenance();
    const interval = window.setInterval(fetchMaintenance, 60000);
    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, []);

  // Vérifier si la page actuelle est en maintenance
  const isCurrentPageInMaintenance = () => {
    if (maintenanceLoading || !maintenanceStatus.enabled) {
      return false;
    }

    // Toujours permettre l'accès aux pages admin, login et register
    if (
      location.pathname.startsWith('/admin') ||
      location.pathname === '/login' ||
      location.pathname === '/register'
    ) {
      return false;
    }

    // Maintenance globale : toutes les autres pages sont bloquées
    return true;
  };

  const isCurrentPageBlocked = () => {
    if (maintenanceLoading) {
      return false;
    }

    if (
      location.pathname.startsWith('/admin') ||
      location.pathname === '/login' ||
      location.pathname === '/register'
    ) {
      return false;
    }

    if (!maintenanceStatus.blockedPages || maintenanceStatus.blockedPages.length === 0) {
      return false;
    }

    return BLOCKABLE_PAGES.some((page) => {
      if (!maintenanceStatus.blockedPages.includes(page.key)) {
        return false;
      }

      if (page.path === '/') {
        return location.pathname === '/';
      }

      return (
        location.pathname === page.path ||
        location.pathname.startsWith(`${page.path}/`)
      );
    });
  };

  if (!maintenanceLoading && isCurrentPageInMaintenance()) {
    return <Maintenance message={maintenanceStatus.message} endDate={maintenanceStatus.endDate} />;
  }

  if (!maintenanceLoading && isCurrentPageBlocked()) {
    return <Blocked message={maintenanceStatus.blockedMessage} />;
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
        <Route index element={<Dashboard />} />
        <Route path="games" element={<Games />} />
        <Route path="games/doodle-jump" element={<DoodleJump />} />
        <Route path="games/2048" element={<Game2048 />} />
        <Route path="games/flappy-bird" element={<FlappyBird />} />
        <Route path="games/clash" element={<Clash />} />
        <Route path="games/casino" element={<Casino />} />
        <Route path="games/market" element={<MarketHall />} />
        <Route path="games/market/:coinId" element={<MarketTrade />} />
        <Route path="games/aura-coin" element={<AuraCoin />} />
        <Route path="games/market/solaris" element={<Solaris />} />
        <Route path="games/market/zenith" element={<Zenith />} />
        <Route path="games/market/rift" element={<Rift />} />
        <Route path="games/bomb-party" element={<BombParty />} />
        <Route path="games/poker" element={<Poker />} />
        <Route path="games/petit-bac" element={<PetitBac />} />
        <Route path="games/russian-roulette" element={<RussianRoulette />} />
        <Route path="games/bataille-navale" element={<BatailleNavale />} />
        <Route path="games/solitaire" element={<Solitaire />} />
        <Route path="games/polymarket" element={<Polymarket />} />
        <Route path="polymarket" element={<Polymarket />} />
        <Route path="leaderboards" element={<Leaderboards />} />
        <Route path="leaderboards/nombres" element={<Numbers />} />
        <Route path="party" element={<Party />} />
        <Route path="clans" element={<Clans />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="profile/:userId?" element={<Profile />} />
        <Route path="admin" element={<Admin />} />
        <Route path="admin/gallery" element={<GalleryAdmin />} />
        <Route path="gallery" element={<Gallery />} />
        <Route path="gallery/:userId" element={<Gallery />} />
        <Route path="market" element={<PlayerMarket />} />
        <Route path="rules" element={<Rules />} />
        <Route path="pass" element={<Pass />} />
        <Route path="quests" element={<Quests />} />
        <Route path="suggestions" element={<Suggestions />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
