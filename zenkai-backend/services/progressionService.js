// Progression service.
// * Pure calculation logic for determining next target path.
// * Does NOT modify any records. Does NOT touch live workout execution.
// * Handles compound, accessory, custom, and cable override logic.
'use strict';

const { ProgressionRule } = require('../models');

// * Rounds barbell, machine, and dumbbell weights to real-world usable jumps.
function roundWeightByEquipment(weight, equipment_type) {
  if (
    equipment_type === 'barbell' ||
    equipment_type === 'machine' ||
    equipment_type === 'dumbbell'
  ) {
    return Math.round(weight / 5) * 5;
  }

  return weight;
}

// * determines next target weight based on performance
async function calculateNextWeight({
  type,
  equipment_type,
  progression_mode,
  progression_value,
  target_weight,
  rep_range_min,
  rep_range_max,
  completed_reps_array,
  cable_increment = 0
}) {
  const all_sets_hit_top = completed_reps_array.every(
    (reps) => reps >= rep_range_max
  );

  const any_set_below_min = completed_reps_array.some(
    (reps) => reps < rep_range_min
  );

  // * cable machines ignore percentage progression entirely
  if (equipment_type === 'cable') {
    if (all_sets_hit_top) {
      return { cable_increment: Math.min(cable_increment + 1, 2) };
    }

    if (any_set_below_min) {
      return { cable_increment: Math.max(cable_increment - 1, 0) };
    }

    return { cable_increment };
  }

  let next_weight = target_weight;

  if (type === 'custom') {
    if (all_sets_hit_top) {
      if (progression_mode === 'absolute') {
        next_weight = target_weight + progression_value;
      } else if (progression_mode === 'percent') {
        next_weight = target_weight * (1 + progression_value / 100);
      }
    } else if (any_set_below_min) {
      if (progression_mode === 'absolute') {
        next_weight = target_weight - progression_value;
      } else if (progression_mode === 'percent') {
        next_weight = target_weight * (1 - 0.05);
      }
    }

    return {
      weight: roundWeightByEquipment(next_weight, equipment_type)
    };
  }

  const rule = await ProgressionRule.findOne({ where: { type } });

  if (!rule) {
    throw new Error(`No progression rule found for type: ${type}`);
  }

  if (all_sets_hit_top) {
    next_weight = target_weight * (1 + rule.increase_percent);
  } else if (any_set_below_min) {
    next_weight = target_weight * (1 - rule.decrease_percent);
  }

  return {
    weight: roundWeightByEquipment(next_weight, equipment_type)
  };
}

module.exports = {
  calculateNextWeight
};
