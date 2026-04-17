// * Cable display and progression helpers.
// * micro_step_value is never stored — derived from stack_step_value and max_micro_levels.

// * Approximate weight of one micro increment
export function computeMicroStepValue(stackStepValue, maxMicroLevels) {
  const stack = parseFloat(stackStepValue);
  let levels = parseInt(maxMicroLevels);

  if (isNaN(stack) || stack <= 0) return 0;
  if (isNaN(levels) || levels < 0) levels = 0;

  return stack / (levels + 1);
}

// * Numeric display weight for a cable exercise
export function getCableDisplayWeight(
  baseStackWeight,
  stackStepValue,
  currentMicroLevel,
  maxMicroLevels
) {
  const base = parseFloat(baseStackWeight);
  const level = parseInt(currentMicroLevel);

  const safeBase = isNaN(base) ? 0 : base;
  const safeLevel = isNaN(level) ? 0 : level;

  const microStep = computeMicroStepValue(stackStepValue, maxMicroLevels);

  return safeBase + safeLevel * microStep;
}

// * Human-readable target string
export function formatCableTarget({
  baseStackWeight,
  stackStepValue,
  currentMicroLevel,
  maxMicroLevels,
  cableUnit,
  microType,
  microDisplayLabel
}) {
  const base = parseFloat(baseStackWeight);
  if (isNaN(base) || base <= 0) return '';

  const level = parseInt(currentMicroLevel);
  const safeLevel = isNaN(level) ? 0 : level;

  const unit = cableUnit ? cableUnit : '';

  const baseString = unit ? `Pin ${base}${unit}` : `Pin ${base}`;

  if (microType === 'none' || safeLevel <= 0) {
    return baseString;
  }

  const label =
    microDisplayLabel && microDisplayLabel.trim()
      ? microDisplayLabel.trim()
      : 'micro';

  return `${baseString} + ${safeLevel} ${label}`;
}
