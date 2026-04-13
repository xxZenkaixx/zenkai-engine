// * Root component toggles between admin view and client workout view (no routing for MVP 1)
import { useState } from 'react';
import AdminDashboard from './components/AdminDashboard';
import ClientWorkoutView from './components/ClientWorkoutView';
import ClientHome from './components/ClientHome';

export default function App() {
  const [view, setView] = useState('admin');
  const [activeClientId, setActiveClientId] = useState(null);

  // * switch into workout view for selected client
  const handleStartWorkout = (clientId) => {
    setActiveClientId(clientId);
    setView('workout');
  };

  const handleViewClientHome = (clientId) => {
    setActiveClientId(clientId);
    setView('clientHome');
  };

  return (
    <div>
      {view === 'admin' && (
        <AdminDashboard onStartWorkout={handleStartWorkout} onViewClientHome={handleViewClientHome} />
      )}

      {view === 'clientHome' && activeClientId && (
        <>
          <button onClick={() => setView('admin')}>Back to Admin</button>
          <ClientHome clientId={activeClientId} onStartWorkout={handleStartWorkout} />
        </>
      )}

      {view === 'workout' && activeClientId && (
        <>
          <button onClick={() => setView('admin')}>
            Back to Admin
          </button>

          <ClientWorkoutView clientId={activeClientId} />
        </>
      )}
    </div>
  );
}
