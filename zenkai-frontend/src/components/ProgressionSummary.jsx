// * Read-only progression summary for exercise history
// * Uses stored completed_weight when available
// ! Falls back to reps-only for legacy sets without weight

import {
  getLastLoggedDate,
  getPersonalBest,
  getProgressionSignal
} from '../utils/progressionUtils';

const SIGNAL_LABELS = {
  up: '↑ Improved',
  down: '↓ Declined',
  same: '→ Same',
  insufficient: 'Not enough data'
};

export default function ProgressionSummary({ history, type, target_reps }) {
  if (!history || history.length === 0) {
    return null;
  }

  const signal = getProgressionSignal(history, type, target_reps);
  const bestSet = getPersonalBest(history);
  const lastSet = history[history.length - 1];
  const lastLoggedDate = getLastLoggedDate(history);

  const bestLabel =
    bestSet && bestSet.completed_weight != null
      ? `${bestSet.completed_reps} reps @ ${parseFloat(bestSet.completed_weight)} lbs`
      : bestSet
        ? `${bestSet.completed_reps} reps`
        : '—';

  const lastLabel =
    lastSet && lastSet.completed_weight != null
      ? `${lastSet.completed_reps} reps @ ${parseFloat(lastSet.completed_weight)} lbs`
      : lastSet
        ? `${lastSet.completed_reps} reps`
        : '—';

  return (
    <div>
      <p><strong>Progression:</strong> {SIGNAL_LABELS[signal]}</p>
      <p><strong>Best:</strong> {bestLabel}</p>
      <p><strong>Last:</strong> {lastLabel}</p>
      <p><strong>Last logged:</strong> {lastLoggedDate}</p>
      <p><strong>Total sets logged:</strong> {history.length}</p>
    </div>
  );
}
