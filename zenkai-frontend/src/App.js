import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AdminDashboard from './components/AdminDashboard';
import AdminLayout from './components/AdminLayout';
import ClientWorkoutView from './components/ClientWorkoutView';
import ClientHome from './components/ClientHome';
import LoginPage from './components/LoginPage';
import { fetchLinkedClient } from './api/clientApi';

function AppShell() {
  const { user } = useAuth();
  const [view, setView] = useState('main');
  const [activeClientId, setActiveClientId] = useState(null);
  const [activeClientName, setActiveClientName] = useState(null);
  const [activeDayId, setActiveDayId] = useState(null);
  const [clientHomeTab, setClientHomeTab] = useState('dashboard');
  const [linkedClientId, setLinkedClientId] = useState(null);
  const [linkedClientName, setLinkedClientName] = useState(null);

  useEffect(() => {
    if (user?.role === 'client') {
      fetchLinkedClient()
        .then(c => { setLinkedClientId(c.id); setLinkedClientName(c.name); })
        .catch(() => { setLinkedClientId(null); setLinkedClientName(null); });
    }
  }, [user]);

  const isAdminEntry = window.location.pathname === '/admin';
  if (!user) return <LoginPage variant={isAdminEntry ? 'admin' : 'member'} />;

  const handleStartWorkout = (clientId, dayId = null) => {
    setActiveClientId(clientId);
    setActiveDayId(dayId);
    setView('workout');
  };

  const handleViewClientHome = (clientId, clientName = null) => {
    setActiveClientId(clientId);
    setActiveClientName(clientName);
    setView('clientHome');
  };

  if (user.role === 'client') {
    if (!linkedClientId) {
      return (
        <div style={{
          color: '#888',
          background: '#0a0a0a',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          Loading...
        </div>
      );
    }

    if (view === 'workout' && activeClientId) {
      return (
        <ClientWorkoutView
          clientId={activeClientId}
          initialDayId={activeDayId}
          onWorkoutFinished={() => {
            setClientHomeTab('dashboard');
            setView('main');
          }}
          onNavigateHistory={() => {
            setClientHomeTab('history');
            setView('main');
          }}
        />
      );
    }
    return (
      <ClientHome
        clientId={linkedClientId}
        clientName={linkedClientName}
        onStartWorkout={handleStartWorkout}
        initialTab={clientHomeTab}
        onBack={() => setView('main')}
      />
    );
  }

  if (view === 'clientHome' && activeClientId) {
    return (
      <AdminLayout
        activeSection="clientPortal"
        onSectionChange={(section) => {
          localStorage.setItem('adminSection', section);
          setView('main');
        }}
      >
        <ClientHome
          clientId={activeClientId}
          clientName={activeClientName}
          onStartWorkout={handleStartWorkout}
          initialTab={clientHomeTab}
          onBack={() => {
            localStorage.setItem('adminSection', 'clientPortal');
            setView('main');
          }}
        />
      </AdminLayout>
    );
  }

  if (view === 'workout' && activeClientId) {
    return (
      <AdminLayout
        activeSection="clientPortal"
        onSectionChange={(section) => {
          localStorage.setItem('adminSection', section);
          setView('main');
        }}
      >
        <ClientWorkoutView
          clientId={activeClientId}
          initialDayId={activeDayId}
          onWorkoutFinished={() => {
            setClientHomeTab('dashboard');
            setView('clientHome');
          }}
          onNavigateHistory={() => {
            setClientHomeTab('history');
            setView('clientHome');
          }}
        />
      </AdminLayout>
    );
  }

  return (
    <AdminDashboard
      onStartWorkout={handleStartWorkout}
      onViewClientHome={handleViewClientHome}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
