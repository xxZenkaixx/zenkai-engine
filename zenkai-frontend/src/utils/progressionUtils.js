// * Pure helper functions for computing progression signals from logged set history
// * Weight-primary logic with reps tiebreaker
// ! Falls back to reps-only for legacy sets without completed_weight

export function getProgressionSignal(history) {
  if (!history || history.length < 2) {
    return 'insufficient';
  }

  const last = history[history.length - 1];
  const previous = history[history.length - 2];

  if (last.completed_weight != null && previous.completed_weight != null) {
    const lastWeight = parseFloat(last.completed_weight);
    const previousWeight = parseFloat(previous.completed_weight);

    if (lastWeight > previousWeight) {
      return 'up';
    }

    if (lastWeight < previousWeight) {
      return 'down';
    }

    if (last.completed_reps > previous.completed_reps) {
      return 'up';
    }

    if (last.completed_reps < previous.completed_reps) {
      return 'down';
    }

    return 'same';
  }

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

  const hasWeight = history.some((set) => set.completed_weight != null);

  if (hasWeight) {
    return history.reduce((best, set) => {
      const bestWeight = parseFloat(best.completed_weight ?? 0);
      const setWeight = parseFloat(set.completed_weight ?? 0);

      if (setWeight > bestWeight) {
        return set;
      }

      if (setWeight === bestWeight && set.completed_reps > best.completed_reps) {
        return set;
      }

      return best;
    });
  }

  return history.reduce((best, set) => {
    if (set.completed_reps > best.completed_reps) {
      return set;
    }

    return best;
  });
}

export function getLastLoggedDate(history) {
  if (!history || history.length === 0) {
    return null;
  }

  const last = history[history.length - 1];
  return new Date(last.completed_at).toLocaleDateString();
}
