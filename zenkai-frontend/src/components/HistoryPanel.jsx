// * Read-only exercise history panel
// * Fetches lazily on first open
// ! Does not control workout flow, timer, or set locking

import { useState } from 'react';
import { fetchSetHistory } from '../api/loggedSetApi';

export default function HistoryPanel({ exerciseInstanceId, clientId, targetWeight }) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const handleToggleHistory = async () => {
    if (!isOpen && !hasLoaded) {
      setIsLoading(true);
      setHistoryError('');

      try {
        const data = await fetchSetHistory(exerciseInstanceId, clientId);
        setHistory(data);
        setHasLoaded(true);
      } catch (err) {
        setHistoryError(err.message || 'Failed to load history');
      } finally {
        setIsLoading(false);
      }
    }

    setIsOpen((prev) => !prev);
  };

  return (
    <div>
      <button type="button" onClick={handleToggleHistory}>
        {isOpen ? 'Hide History' : 'Show History'}
      </button>

      {isOpen && (
        <div>
          <h4>Exercise History</h4>

          {isLoading && <p>Loading history...</p>}

          {!isLoading && historyError && (
            <p style={{ color: 'red' }}>{historyError}</p>
          )}

          {!isLoading && !historyError && history.length === 0 && (
            <p>No history yet.</p>
          )}

          {!isLoading && !historyError && history.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Set</th>
                  <th>Weight</th>
                  <th>Reps</th>
                </tr>
              </thead>
              <tbody>
                {history.map((set) => (
                  <tr key={set.id}>
                    <td>{new Date(set.completed_at).toLocaleDateString()}</td>
                    <td>{set.set_number}</td>
                    <td>{targetWeight ?? '—'}</td>
                    <td>{set.completed_reps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
