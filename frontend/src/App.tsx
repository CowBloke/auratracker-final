import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Games from './pages/Games';
import DoodleJump from './pages/DoodleJump';
import Clash from './pages/Clash';
import Casino from './pages/Casino';
import AuraCoin from './pages/AuraCoin';
import Marketplace from './pages/Marketplace';
import Leaderboards from './pages/Leaderboards';
import Profile from './pages/Profile';
import Inventory from './pages/Inventory';
import Party from './pages/Party';
import Clans from './pages/Clans';
import BombParty from './pages/BombParty';
import Poker from './pages/Poker';
import PetitBac from './pages/PetitBac';
import Admin from './pages/Admin';
import Rules from './pages/Rules';
import Suggestions from './pages/Suggestions';
import ReportBug from './pages/ReportBug';
import Pass from './pages/Pass';
import Changelog from './pages/Changelog';
import Maintenance from './pages/Maintenance';
import Settings from './pages/Settings';
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
  const [maintenanceStatus, setMaintenanceStatus] = useState<{ enabled: boolean; message: string }>({
    enabled: false,
    message: '',
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
        });
      } catch (error) {
        if (!isActive) return;
        setMaintenanceStatus({ enabled: false, message: '' });
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

  if (
    !maintenanceLoading &&
    maintenanceStatus.enabled &&
    !location.pathname.startsWith('/admin') &&
    location.pathname !== '/login'
  ) {
    return <Maintenance message={maintenanceStatus.message} />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
        <Route path="games/clash" element={<Clash />} />
        <Route path="games/casino" element={<Casino />} />
        <Route path="games/aura-coin" element={<AuraCoin />} />
        <Route path="games/bomb-party" element={<BombParty />} />
        <Route path="games/poker" element={<Poker />} />
        <Route path="games/petit-bac" element={<PetitBac />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="leaderboards" element={<Leaderboards />} />
        <Route path="party" element={<Party />} />
        <Route path="clans" element={<Clans />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="profile/:userId?" element={<Profile />} />
        <Route path="admin" element={<Admin />} />
        <Route path="rules" element={<Rules />} />
        <Route path="pass" element={<Pass />} />
        <Route path="changelog" element={<Changelog />} />
        <Route path="suggestions" element={<Suggestions />} />
        <Route path="report-bug" element={<ReportBug />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
