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

// * Compute regressed cable state after a failed set
export function computeNextCableStateOnRegression(
  cableState,
  { stack_step_value, max_micro_levels, decrease_percent }
) {
  const base = parseFloat(cableState.base_stack_weight);
  const level = parseInt(cableState.current_micro_level) || 0;
  const stackStep = parseFloat(stack_step_value);
  const maxLevels = parseInt(max_micro_levels) || 0;

  const microStep = computeMicroStepValue(stack_step_value, max_micro_levels);
  const currentWeight = base + level * microStep;
  const targetWeight = currentWeight * (1 - decrease_percent);

  const pinOffset = Math.floor((targetWeight - base) / stackStep);
  const newBase = Math.max(stackStep, base + pinOffset * stackStep);

  let newLevel = 0;
  if (microStep > 0 && maxLevels > 0) {
    newLevel = Math.min(maxLevels, Math.floor((targetWeight - newBase) / microStep));
    if (newLevel < 0) newLevel = 0;
  }

  return { base_stack_weight: newBase, current_micro_level: newLevel };
}

// * Compute progressed cable state after a max-rep set
export function computeNextCableStateOnProgression(
  cableState,
  { stack_step_value, max_micro_levels }
) {
  const base = parseFloat(cableState.base_stack_weight);
  const level = parseInt(cableState.current_micro_level) || 0;
  const stackStep = parseFloat(stack_step_value);
  const maxLevels = parseInt(max_micro_levels) || 0;

  let newLevel = level + 1;
  let newBase = base;

  if (newLevel > maxLevels) {
    newBase = base + stackStep;
    newLevel = 0;
  }

  return { base_stack_weight: newBase, current_micro_level: newLevel };
}

// * Reverse-engineer a stored cable weight back into "Pin at X + N sliders".
// * Mirrors the workout card's label so every screen reads cables the same way.
export function formatCableWeightLabel(
  weight,
  { base_stack_weight, stack_step_value, max_micro_levels, cable_unit = 'lb' } = {}
) {
  const w = parseFloat(weight);
  if (isNaN(w)) return null;

  const base = parseFloat(base_stack_weight);
  const step = parseFloat(stack_step_value);
  const unit = cable_unit || 'lb';

  // No valid stack grid — fall back to the raw number.
  if (isNaN(base) || !(step > 0)) return `${w} ${unit}`;

  const levels = parseInt(max_micro_levels) || 0;
  const microStep = step / (levels + 1);
  const stepsDown = Math.ceil((base - w) / step);
  const pin = base - stepsDown * step;
  const microCount = microStep > 0 ? Math.round((w - pin) / microStep) : 0;

  if (microCount <= 0) return `Pin at ${pin} ${unit}`;
  return `Pin at ${pin} ${unit} + ${microCount} slider${microCount > 1 ? 's' : ''}`;
}
