// * Shared weight rounding and formatting utilities.
// * Barbell: round to nearest 5 lb
// * Dumbbell: round to nearest 2.5 lb
// * All others: round to nearest 5 lb
// * Per-side display for barbell only (total / 2, no bar subtraction)

export function roundWeight(weight, equipmentType) {
  if (weight == null) return weight;
  if (equipmentType === 'barbell') return Math.round(weight / 5) * 5;
  if (equipmentType === 'dumbbell') return Math.round(weight / 2.5) * 2.5;
  return Math.round(weight / 5) * 5;
}

export function getBackoffWeight(mainWeight, percent, equipmentType) {
  if (mainWeight == null || !percent) return mainWeight;
  const raw = mainWeight * (1 - percent / 100);
  return roundWeight(raw, equipmentType);
}

export function getBackoffRest(assignedRest) {
  const baseRest = Number(assignedRest);
  const calculated = baseRest * 0.66;
  const rounded = Math.floor(calculated / 15) * 15;
  return Math.max(60, rounded);
}

// * Returns display string. Barbell gets per-side annotation.
// * Does NOT round — caller is responsible for passing a rounded value if needed.
export function formatWeight(weight, equipmentType) {
  if (weight == null) return null;

  if (equipmentType === 'barbell') {
    const perSide = weight / 2;
    return `${weight} lb (${perSide} per side)`;
  }

  return `${weight} lb`;
}
