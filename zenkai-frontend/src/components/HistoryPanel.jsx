// * Read-only history view for a single exercise + client
// * Fetched lazily on first open
// ! Does not affect live workout state

import { useState } from 'react';
import { fetchSetHistory } from '../api/loggedSetApi';
import ProgressionSummary from './ProgressionSummary';
import { groupHistoryByDate } from '../utils/progressionUtils';
import { formatWeight } from '../utils/weightUtils';

export default function HistoryPanel({ exerciseInstanceId, clientId, targetWeight, equipmentType }) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [groupedHistory, setGroupedHistory] = useState([]);
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
        setGroupedHistory(groupHistoryByDate(data));
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
            <>
              <ProgressionSummary history={history} />

              {groupedHistory.map(({ date, sets }) => (
                <div key={date}>
                  <p><strong>{date}</strong></p>

                  <ul>
                    {sets.map((set) => (
                      <li key={set.id}>
                        Set {set.set_number}: {set.completed_reps} reps
                        {set.completed_weight != null
                          ? ` @ ${formatWeight(parseFloat(set.completed_weight), equipmentType)}`
                          : targetWeight != null
                            ? ` @ ${formatWeight(targetWeight, equipmentType)} (prescribed)`
                            : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
