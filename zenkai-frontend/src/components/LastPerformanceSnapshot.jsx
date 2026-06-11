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

        // Exclude skipped sets (0 reps) — a skip must never show as
        // "Last set: 0 reps @ 0 lb" or count as a personal best.
        const realSets = (data || []).filter(
          (s) => s.completed_reps != null && s.completed_reps > 0
        );

        if (!realSets.length) {
          setSnapshot(null);
          return;
        }

        const lastSet = realSets[realSets.length - 1];
        const bestSet = getPersonalBest(realSets);

        setSnapshot({
          lastReps: lastSet.completed_reps,
          lastWeight: lastSet.completed_weight != null ? parseFloat(lastSet.completed_weight) : null,
          lastDate: getLastLoggedDate(realSets),
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
      ? `${snapshot.lastReps} reps @ ${formatWeight(snapshot.lastWeight, equipmentType)}`
      : `${snapshot.lastReps} reps`;

  const bestLabel =
    snapshot.bestWeight != null
      ? `${snapshot.bestReps} reps @ ${formatWeight(snapshot.bestWeight, equipmentType)}`
      : `${snapshot.bestReps} reps`;

  return (
    <div className="ec-snapshot">
      <p>Last set: {lastLabel}</p>
      <p>Best set: {bestLabel}</p>
    </div>
  );
}
