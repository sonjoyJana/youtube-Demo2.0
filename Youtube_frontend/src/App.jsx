import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';
import Header from './components/Header.jsx';
import HomePage from './pages/HomePage.jsx';
import WatchPage from './pages/WatchPage.jsx';
import CallPage from './pages/CallPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ModerationPage from './pages/ModerationPage.jsx';
import Security from './pages/Security.jsx';
import LoginHistory from './pages/LoginHistory.jsx';
import TrustedDevices from './pages/TrustedDevices.jsx';
import Sessions from './pages/Sessions.jsx';
import Appearance from './pages/Appearance.jsx';
import Register from './pages/Register.jsx';
import NotFound from './pages/NotFound.jsx';
import { useAuth } from './context/AuthContext.jsx';

function AppLayout() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [location.pathname, location.hash]);

  return (
    <div className="app-shell">
      <Header />
      <Outlet />
    </div>
  );
}

function Protected() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="splash">
        <div className="splash-loader">
          <div className="spinner" />
          <p>Verifying your session…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function NotFoundPage() {
  return (
    <main className="not-found">
      <Compass size={40} />
      <h1>This page is off the map</h1>
      <p>The page you are looking for does not exist.</p>
      <Navigate to="/" replace />
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<Register />} />

      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/watch" element={<WatchPage />} />
        <Route element={<Protected />}>
          <Route path="/moderation" element={<ModerationPage />} />
          <Route path="/security" element={<Security />} />
          <Route path="/history" element={<LoginHistory />} />
          <Route path="/devices" element={<TrustedDevices />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/appearance" element={<Appearance />} />
          <Route path="/call" element={<CallPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
