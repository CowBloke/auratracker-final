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
import Profile from './pages/Profile';
import Inventory from './pages/Inventory';
import Party from './pages/Party';
import Clans from './pages/Clans';
import BombParty from './pages/BombParty';
import Poker from './pages/Poker';
import PetitBac from './pages/PetitBac';
import BatailleNavale from './pages/BatailleNavale';
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
import { maintenanceApi } from './services/api';

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
  const [maintenanceStatus, setMaintenanceStatus] = useState<{ enabled: boolean; message: string; pages: string[]; endDate: string | null }>({
    enabled: false,
    message: '',
    pages: [],
    endDate: null,
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
        });
      } catch (error) {
        if (!isActive) return;
        setMaintenanceStatus({ enabled: false, message: '', pages: [], endDate: null });
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
    if (maintenanceLoading || maintenanceStatus.pages.length === 0) {
      return false;
    }

    // Toujours permettre l'accès aux pages admin, login et banned
    if (
      location.pathname.startsWith('/admin') ||
      location.pathname === '/login' ||
      location.pathname === '/banned'
    ) {
      return false;
    }

    // Vérifier si le chemin actuel correspond à une page en maintenance
    const currentPath = location.pathname;
    
    // Si "/" est dans la liste, toutes les pages sont en maintenance (sauf exceptions ci-dessus)
    if (maintenanceStatus.pages.includes('/')) {
      return true;
    }
    
    // Vérifier les correspondances exactes
    if (maintenanceStatus.pages.includes(currentPath)) {
      return true;
    }

    // Vérifier les correspondances par préfixe (pour les routes dynamiques comme /profile/:userId)
    for (const pagePath of maintenanceStatus.pages) {
      if (pagePath !== '/' && currentPath.startsWith(pagePath)) {
        // S'assurer que c'est une correspondance complète (pas juste un préfixe partiel)
        // Par exemple, "/games" devrait correspondre à "/games" et "/games/..." mais pas à "/games123"
        if (currentPath === pagePath || currentPath.startsWith(pagePath + '/')) {
          return true;
        }
      }
    }

    return false;
  };

  if (!maintenanceLoading && isCurrentPageInMaintenance()) {
    return <Maintenance message={maintenanceStatus.message} endDate={maintenanceStatus.endDate} />;
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
        <Route path="games/bataille-navale" element={<BatailleNavale />} />
        <Route path="games/polymarket" element={<Polymarket />} />
        <Route path="polymarket" element={<Polymarket />} />
        <Route path="leaderboards" element={<Leaderboards />} />
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
