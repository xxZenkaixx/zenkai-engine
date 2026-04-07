// * Read-only snapshot of last and best performance for a single exercise
// * Uses history data only and does not affect live workout state
// ! Non-critical display only

import { useEffect, useState } from 'react';
import { fetchSetHistory } from '../api/loggedSetApi';
import { getLastLoggedDate, getPersonalBest } from '../utils/progressionUtils';

export default function LastPerformanceSnapshot({ exerciseInstanceId, clientId }) {
  const [snapshot, setSnapshot] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const loadSnapshot = async () => {
      try {
        const data = await fetchSetHistory(exerciseInstanceId, clientId);

        if (!data || data.length === 0) {
          setSnapshot(null);
          return;
        }

        const lastSet = data[data.length - 1];

        setSnapshot({
          lastReps: lastSet.completed_reps,
          lastDate: getLastLoggedDate(data),
          bestReps: getPersonalBest(data)
        });
      } catch {
        setSnapshot(null);
      } finally {
        setHasLoaded(true);
      }
    };

    loadSnapshot();
  }, [exerciseInstanceId, clientId]);

  if (!hasLoaded || !snapshot) {
    return null;
  }

  return (
    <div>
      <p>Last: {snapshot.lastReps} reps — {snapshot.lastDate}</p>
      <p>Best: {snapshot.bestReps} reps</p>
    </div>
  );
}
