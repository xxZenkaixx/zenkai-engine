// Progression application service.
// * Post-workout only — evaluates logged performance and persists next targets.
// * Does NOT modify logged_sets or existing program structure.
// * Calls progressionService for calculations — no logic duplicated here.
'use strict';

const { LoggedSet, ExerciseInstance, ExerciseProgression } = require('../models');
const { calculateNextWeight } = require('./progressionService');
const { Op } = require('sequelize');

// * Parses "8-12" style rep range string into { min, max }
function parseRepRange(target_reps) {
  const parts = target_reps.split('-').map(Number);
  if (parts.length === 2) return { min: parts[0], max: parts[1] };
  return { min: parts[0], max: parts[0] };
}

// * Groups an array of logged sets by exercise_instance_id
function groupByInstance(sets) {
  return sets.reduce((acc, set) => {
    const key = set.exercise_instance_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(set);
    return acc;
  }, {});
}

// * Returns only the latest workout's sets for a client + day
// * "Latest" = most recent completed_at date among all sets for that day
async function fetchLatestSetsForDay(clientId, programDayId) {
  const instances = await ExerciseInstance.findAll({
    where: { program_day_id: programDayId },
    attributes: ['id']
  });

  const instanceIds = instances.map((i) => i.id);
  if (!instanceIds.length) return [];

  const allSets = await LoggedSet.findAll({
    where: {
      client_id: clientId,
      exercise_instance_id: { [Op.in]: instanceIds }
    },
    order: [['completed_at', 'DESC']]
  });

  if (!allSets.length) return [];

  // * Find the most recent date and filter to only that session
  const latestDate = allSets[0].completed_at;
  const latestDay = new Date(latestDate).toDateString();

  return allSets.filter(
    (s) => new Date(s.completed_at).toDateString() === latestDay
  );
}

// * Core function — evaluates and persists progression for a completed workout
async function applyProgressionForWorkout(clientId, programDayId) {
  const sets = await fetchLatestSetsForDay(clientId, programDayId);
  if (!sets.length) throw new Error('No logged sets found for this client and program day.');

  // * Drop sets with missing reps
  const validSets = sets.filter((s) => s.completed_reps != null);
  const grouped = groupByInstance(validSets);

  const instanceIds = Object.keys(grouped);
  const instances = await ExerciseInstance.findAll({
    where: { id: { [Op.in]: instanceIds } }
  });

  const instanceMap = instances.reduce((acc, i) => {
    acc[i.id] = i;
    return acc;
  }, {});

  const results = [];

  for (const instanceId of instanceIds) {
    const instance = instanceMap[instanceId];

    // ! Skip if instance not found
    if (!instance) {
      results.push({ exercise_instance_id: instanceId, outcome: 'skipped', reason: 'instance not found' });
      continue;
    }

    // * custom exercises are skipped — no progression applied
    if (instance.type === 'custom') {
      results.push({ exercise_instance_id: instanceId, outcome: 'skipped', reason: 'custom exercise' });
      continue;
    }

    const instanceSets = grouped[instanceId];

    // ! skip if no completed_weight snapshot exists
    if (instanceSets[0].completed_weight == null) {
      results.push({
        exercise_instance_id: instanceId,
        outcome: 'skipped',
        reason: 'missing completed_weight'
      });
      continue;
    }

    const { min, max } = parseRepRange(instance.target_reps);
    const completedReps = instanceSets.map((s) => s.completed_reps);

    const all_hit_top = completedReps.every((r) => r >= max);
    const any_below_min = completedReps.some((r) => r < min);

    const outcome = all_hit_top ? 'increase' : any_below_min ? 'decrease' : 'no_change';

    let next_weight = null;
    let next_cable_state = null;

    // * only calculate if change is needed
    if (outcome === 'increase' || outcome === 'decrease') {
      try {
        if (instance.equipment_type === 'cable') {
          const result = await calculateNextWeight({
            type: instance.type,
            equipment_type: 'cable',
            target_weight: null,
            rep_range_min: min,
            rep_range_max: max,
            completed_reps_array: completedReps,
            cable_state: {
              base_stack_weight: instance.base_stack_weight,
              stack_step_value: instance.stack_step_value,
              micro_step_value: instance.micro_step_value,
              max_micro_levels: instance.max_micro_levels,
              current_micro_level: instance.current_micro_level
            }
          });
          next_cable_state = result;
        } else {
          // * use completed_weight snapshot from logged sets (source of truth)
          const baseWeight = instanceSets[0].completed_weight;

          next_weight = await calculateNextWeight({
            type: instance.type,
            equipment_type: instance.equipment_type,
            target_weight: parseFloat(baseWeight),
            rep_range_min: min,
            rep_range_max: max,
            completed_reps_array: completedReps
          });
        }
      } catch (err) {
        // ! Calculation failed — skip this instance with warning
        results.push({ exercise_instance_id: instanceId, outcome: 'skipped', reason: err.message });
        continue;
      }
    }

    // * enforce one record per client + exercise_instance
    await ExerciseProgression.destroy({
      where: {
        client_id: clientId,
        exercise_instance_id: instanceId
      }
    });

    await ExerciseProgression.create({
      client_id: clientId,
      exercise_instance_id: instanceId,
      next_weight: next_weight ?? null,
      next_cable_state: next_cable_state ?? null
    });

    results.push({
      exercise_instance_id: instanceId,
      outcome,
      next_weight: next_weight ?? undefined,
      next_cable_state: next_cable_state ?? undefined
    });
  }

  return results;
}

module.exports = { applyProgressionForWorkout };
