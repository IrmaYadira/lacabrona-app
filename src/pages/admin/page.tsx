import { useState } from 'react';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(() => {
    return sessionStorage.getItem('admin_auth') === 'true';
  });

  // Panel administrativo interno, no debe indexarse
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