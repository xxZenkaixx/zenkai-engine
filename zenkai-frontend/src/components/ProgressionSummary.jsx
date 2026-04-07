// * Read-only progression summary for exercise history
// * Uses real logged history data only
// ! Does not fetch data or affect workout flow

import { getLastLoggedDate, getPersonalBest, getProgressionSignal } from '../utils/progressionUtils';

const SIGNAL_LABELS = {
  up: '↑ Improved',
  down: '↓ Declined',
  same: '→ Same',
  insufficient: 'Not enough data'
};

export default function ProgressionSummary({ history }) {
  if (!history || history.length === 0) {
    return null;
  }

  const signal = getProgressionSignal(history);
  const personalBest = getPersonalBest(history);
  const lastLoggedDate = getLastLoggedDate(history);

  return (
    <div>
      <p><strong>Progression:</strong> {SIGNAL_LABELS[signal]}</p>
      <p><strong>Best reps logged:</strong> {personalBest}</p>
      <p><strong>Last logged:</strong> {lastLoggedDate}</p>
      <p><strong>Total sets logged:</strong> {history.length}</p>
    </div>
  );
}
