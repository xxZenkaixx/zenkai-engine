// * Pure helper functions for computing progression signals from logged set history
// * Weight-primary logic with reps tiebreaker
// ! Falls back to reps-only for legacy sets without completed_weight

export function getProgressionSignal(history, type, target_reps) {
  if (!history || history.length < 2) {
    return 'insufficient';
  }

  if (type === 'bodyweight') {
    const parts = (target_reps || '').split('-').map(Number).filter(Boolean);
    const max = parts.length === 2 ? parts[1] : parts[0];
    if (!max) return 'same';

    const lastDate = new Date(history[history.length - 1].completed_at).toDateString();
    const lastSessionSets = history.filter(
      (s) => new Date(s.completed_at).toDateString() === lastDate
    );
    const allHitTop = lastSessionSets.every((s) => s.completed_reps >= max);
    return allHitTop ? 'up' : 'same';
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

// * Groups a flat sorted history array into date buckets for display
// ! Input should already be sorted by completed_at ASC
export function groupHistoryByDate(history) {
  if (!history || history.length === 0) {
    return [];
  }

  const groups = {};
  const orderedDates = [];

  history.forEach((set) => {
    const dateKey = new Date(set.completed_at).toLocaleDateString();

    if (!groups[dateKey]) {
      groups[dateKey] = [];
      orderedDates.push(dateKey);
    }

    groups[dateKey].push(set);
  });

  return orderedDates.reverse().map((date) => ({
    date,
    sets: groups[date]
  }));
}
