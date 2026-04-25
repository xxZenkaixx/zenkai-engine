import { useState, useEffect } from 'react';
import { fetchWorkoutSessions } from '../api/historyApi';
import ClientWorkoutSessionDetail from './ClientWorkoutSessionDetail';

export default function ClientWorkoutHistoryList({ clientId, initialSessionKey }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    setSelectedSession(null);

    fetchWorkoutSessions(clientId)
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setSessions(arr);
        if (initialSessionKey) {
          const match = arr.find(
            (s) => `${s.date}-${s.program_day_id}` === initialSessionKey
          );
          if (match) setSelectedSession(match);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <p>Loading sessions...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (sessions.length === 0) return <p>No workout sessions yet.</p>;

  return (
    <div>
      <h3>Workout Sessions</h3>
      <ul>
        {sessions.map((s) => {
          const label = s.day_name || `Day ${s.day_number}`;
          const key = `${s.date}-${s.program_day_id}`;
          return (
            <li
              key={key}
              style={{
                cursor: 'pointer',
                fontWeight:
                  selectedSession?.date === s.date &&
                  selectedSession?.program_day_id === s.program_day_id
                    ? 'bold'
                    : 'normal'
              }}
              onClick={() => {
                const isSame =
                  selectedSession?.date === s.date &&
                  selectedSession?.program_day_id === s.program_day_id;
                setSelectedSession(isSame ? null : s);
              }}
            >
              {s.date} | {label} | {s.total_sets} sets
            </li>
          );
        })}
      </ul>

      {selectedSession && (
        <ClientWorkoutSessionDetail
          clientId={clientId}
          date={selectedSession.date}
          programDayId={selectedSession.program_day_id}
          dayLabel={selectedSession.day_name || `Day ${selectedSession.day_number}`}
        />
      )}
    </div>
  );
}
