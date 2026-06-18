import { useState } from 'react';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import { usePageSEO } from '@/hooks/usePageSEO';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(() => {
    return sessionStorage.getItem('admin_auth') === 'true';
  });

  // Panel administrativo interno, no debe indexarse
  usePageSEO({
    title: 'Admin | La Cabrona',
    description: 'Panel administrativo interno de La Cabrona Alitas & Beer.',
    canonicalUrl: 'https://barlacabrona.com/admin',
    noindex: true,
  });

  const handleLogin = () => {
    sessionStorage.setItem('admin_auth', 'true');
    setAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth');
    setAuthenticated(false);
  };

  if (!authenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return <AdminDashboard onLogout={handleLogout} />;
}