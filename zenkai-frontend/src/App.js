// * Root component toggles between admin view and client workout view (no routing for MVP 1)
import { useState } from 'react';
import AdminDashboard from './components/AdminDashboard';
import ClientWorkoutView from './components/ClientWorkoutView';
import ClientHome from './components/ClientHome';
import LandingPage from './components/LandingPage';

export default function App() {
  const [landed, setLanded] = useState(false);
  const [view, setView] = useState('admin');
  const [activeClientId, setActiveClientId] = useState(null);
  const [activeClientName, setActiveClientName] = useState(null);
  const [activeDayId, setActiveDayId] = useState(null);

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

  if (!landed) return <LandingPage onDone={() => setLanded(true)} />;

  return (
    <div>
      {view === 'admin' && (
        <AdminDashboard onStartWorkout={handleStartWorkout} onViewClientHome={handleViewClientHome} />
      )}

      {view === 'clientHome' && activeClientId && (
        <>
          <button onClick={() => setView('admin')}>Back to Admin</button>
          <ClientHome
            clientId={activeClientId}
            clientName={activeClientName}
            onStartWorkout={handleStartWorkout}
            onBack={() => {
              localStorage.setItem('adminSection', 'clientPortal');
              setView('admin');
            }}
          />
        </>
      )}

      {view === 'workout' && activeClientId && (
        <>
          <button onClick={() => setView('admin')}>
            Back to Admin
          </button>

          <ClientWorkoutView
            clientId={activeClientId}
            initialDayId={activeDayId}
            onWorkoutFinished={() => setView('clientHome')}
          />
        </>
      )}
    </div>
  );
}
