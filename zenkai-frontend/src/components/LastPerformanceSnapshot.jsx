// * Read-only snapshot of last and best performance for a single exercise
// * Uses stored completed_weight when available
// ! Does not affect live workout state

import { useEffect, useState } from 'react';
import { fetchSetHistory } from '../api/loggedSetApi';
import { getPersonalBest, getLastLoggedDate } from '../utils/progressionUtils';
import { formatWeight } from '../utils/weightUtils';

export default function LastPerformanceSnapshot({ exerciseInstanceId, clientId, equipmentType }) {
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchSetHistory(exerciseInstanceId, clientId);

        if (!data || data.length === 0) {
          setSnapshot(null);
          return;
        }

        const lastSet = data[data.length - 1];
        const bestSet = getPersonalBest(data);

        setSnapshot({
          lastReps: lastSet.completed_reps,
          lastWeight: lastSet.completed_weight != null ? parseFloat(lastSet.completed_weight) : null,
          lastDate: getLastLoggedDate(data),
          bestReps: bestSet ? bestSet.completed_reps : null,
          bestWeight: bestSet && bestSet.completed_weight != null
            ? parseFloat(bestSet.completed_weight)
            : null
        });
      } catch {
        setSnapshot(null);
      }
    };

    load();
  }, [exerciseInstanceId, clientId]);

  if (!snapshot) {
    return null;
  }

  const lastLabel =
    snapshot.lastWeight != null
      ? `${snapshot.lastReps} reps @ ${formatWeight(snapshot.lastWeight, equipmentType)} — ${snapshot.lastDate}`
      : `${snapshot.lastReps} reps — ${snapshot.lastDate}`;

  const bestLabel =
    snapshot.bestWeight != null
      ? `${snapshot.bestReps} reps @ ${formatWeight(snapshot.bestWeight, equipmentType)}`
      : `${snapshot.bestReps} reps`;

  return (
    <div>
      <p>Last: {lastLabel}</p>
      <p>Best: {bestLabel}</p>
    </div>
  );
}
