// * Read-only snapshot of last-session and all-time best for a single exercise
// * Skipped sets (0 reps) are excluded; cable weights render in slider format
// ! Does not affect live workout state

import { useEffect, useState } from 'react';
import { fetchSetHistory } from '../api/loggedSetApi';
import { getPersonalBest } from '../utils/progressionUtils';
import { formatWeight } from '../utils/weightUtils';
import { formatCableWeightLabel } from '../utils/cableUtils';

export default function LastPerformanceSnapshot({ exerciseInstanceId, clientId, equipmentType, cableSetup }) {
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchSetHistory(exerciseInstanceId, clientId);

        // Exclude skipped sets (0 reps).
        const realSets = (data || []).filter(
          (s) => s.completed_reps != null && s.completed_reps > 0
        );

        if (!realSets.length) {
          setSnapshot(null);
          return;
        }

        // Most-recent session's sets — group by session_id, falling back to the
        // last calendar day for legacy rows that predate session_id.
        const last = realSets[realSets.length - 1];
        const lastSessionSets = last.session_id != null
          ? realSets.filter((s) => s.session_id === last.session_id)
          : realSets.filter(
              (s) =>
                s.session_id == null &&
                new Date(s.completed_at).toDateString() ===
                  new Date(last.completed_at).toDateString()
            );

        // Both follow the same "best" rule: heaviest weight, ties broken by reps.
        const lastBest = getPersonalBest(lastSessionSets);
        const allBest = getPersonalBest(realSets);

        setSnapshot({
          lastReps: lastBest ? lastBest.completed_reps : null,
          lastWeight: lastBest && lastBest.completed_weight != null ? parseFloat(lastBest.completed_weight) : null,
          allReps: allBest ? allBest.completed_reps : null,
          allWeight: allBest && allBest.completed_weight != null ? parseFloat(allBest.completed_weight) : null
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

  const fmt = (w) => {
    if (w == null) return null;
    if (equipmentType === 'cable' && cableSetup) {
      return formatCableWeightLabel(w, cableSetup);
    }
    return formatWeight(w, equipmentType);
  };

  const lastLabel =
    snapshot.lastWeight != null
      ? `${snapshot.lastReps} reps @ ${fmt(snapshot.lastWeight)}`
      : `${snapshot.lastReps} reps`;

  const allLabel =
    snapshot.allWeight != null
      ? `${snapshot.allReps} reps @ ${fmt(snapshot.allWeight)}`
      : `${snapshot.allReps} reps`;

  return (
    <div className="ec-snapshot">
      <p>Last session's best: {lastLabel}</p>
      <p>All time best: {allLabel}</p>
    </div>
  );
}
