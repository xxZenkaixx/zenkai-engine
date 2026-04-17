// Progression service.
// * Pure calculation logic — does NOT write to DB.
// * Cable branch uses stack/micro rollover logic only — ignores progression_rules.
// * compound/accessory/custom branches unchanged.
'use strict';

const { ProgressionRule } = require('../models');

// * Rounds to nearest 2.5
function roundToNearest2_5(weight) {
  return Math.round(weight / 2.5) * 2.5;
}

// * Cable progression — returns next state object + display_weight
// * Does not touch the DB — caller is responsible for persisting.
function calculateCableNextState({
  base_stack_weight,
  stack_step_value,
  max_micro_levels,
  current_micro_level,
  rep_range_min,
  rep_range_max,
  completed_reps_array
}) {
  const all_sets_hit_top = completed_reps_array.every((r) => r >= rep_range_max);
  const any_set_below_min = completed_reps_array.some((r) => r < rep_range_min);

  let next_stack = base_stack_weight;
  let next_micro = current_micro_level;

  if (all_sets_hit_top) {
    if (next_micro < max_micro_levels) {
      next_micro += 1;
    } else {
      next_stack += stack_step_value;
      next_micro = 0;
    }
  } else if (any_set_below_min) {
    if (next_micro > 0) {
      next_micro -= 1;
    } else {
      next_stack -= stack_step_value;
      next_micro = 0;
    }
  }

  const safeStack = parseFloat(stack_step_value);
  let safeLevels = parseInt(max_micro_levels);

  if (isNaN(safeLevels) || safeLevels < 0) safeLevels = 0;

  const derived_micro_step =
    isNaN(safeStack) || safeStack <= 0 ? 0 : safeStack / (safeLevels + 1);

  const display_weight = next_stack + next_micro * derived_micro_step;

  return {
    base_stack_weight: next_stack,
    current_micro_level: next_micro,
    display_weight
  };
}

/**
 * Determines next target weight (or cable state) based on performance.
 *
 * @param {Object} params
 * @param {string} params.type - 'compound' | 'accessory' | 'custom'
 * @param {string} params.equipment_type - 'barbell' | 'dumbbell' | 'machine' | 'cable'
 * @param {number} params.target_weight
 * @param {number} params.rep_range_min
 * @param {number} params.rep_range_max
 * @param {number[]} params.completed_reps_array
 * @param {Object} [params.cable_state] - required when equipment_type === 'cable'
 */
async function calculateNextWeight({
  type,
  equipment_type,
  target_weight,
  rep_range_min,
  rep_range_max,
  completed_reps_array,
  cable_state
}) {
  // * Cable uses its own branch — progression_rules not consulted
  if (equipment_type === 'cable') {
    // ! cable_state must be provided and setup must be locked before calling
    return calculateCableNextState({
      ...cable_state,
      rep_range_min,
      rep_range_max,
      completed_reps_array
    });
  }

  // * custom exercises are never adjusted
  if (type === 'custom') {
    return target_weight;
  }

  const all_sets_hit_top = completed_reps_array.every((r) => r >= rep_range_max);
  const any_set_below_min = completed_reps_array.some((r) => r < rep_range_min);

  // ! rule must exist for the given type
  const rule = await ProgressionRule.findOne({ where: { type } });
  if (!rule) throw new Error(`No progression rule found for type: ${type}`);

  let next_weight = target_weight;

  if (all_sets_hit_top) {
    next_weight = target_weight * (1 + rule.increase_percent);
  } else if (any_set_below_min) {
    next_weight = target_weight * (1 - rule.decrease_percent);
  }

  return roundToNearest2_5(next_weight);
}

module.exports = {
  calculateNextWeight,
  calculateCableNextState
};
