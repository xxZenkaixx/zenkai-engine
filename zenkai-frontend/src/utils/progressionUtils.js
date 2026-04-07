// * Pure helpers for simple progression visibility
// * Uses real logged set fields only
// ! Current schema does not include completed_weight

export function getProgressionSignal(history) {
    if (!history || history.length < 2) {
      return 'insufficient';
    }

    const last = history[history.length - 1];
    const previous = history[history.length - 2];

    if (last.completed_reps > previous.completed_reps) {
      return 'up';
    }

    if (last.completed_reps < previous.completed_reps) {
      return 'down';
    }

    return 'same';
  }

  export function getPersonalBest(history) {
    if (!history || history.length === 0) {
      return null;
    }

    return Math.max(...history.map((set) => set.completed_reps));
  }

  export function getLastLoggedDate(history) {
    if (!history || history.length === 0) {
      return null;
    }

    const last = history[history.length - 1];
    return new Date(last.completed_at).toLocaleDateString();
  }
