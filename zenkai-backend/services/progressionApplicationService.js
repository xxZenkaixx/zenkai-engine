// Progression application service.
// * Post-workout only — evaluates logged performance and persists next targets.
// * Reads client-specific cable state from client_exercise_targets (falls back to template).
// * Writes ALL next targets to client_exercise_targets — NEVER to exercise_instances.
// * Does NOT modify logged_sets or existing program structure.
'use strict';

const {
  LoggedSet,
  ExerciseInstance,
  ExerciseProgression,
  ClientProgram,
  ClientExerciseTarget
} = require('../models');
const { calculateNextWeight } = require('./progressionService');
const { Op } = require('sequelize');

function parseRepRange(target_reps) {
  const parts = target_reps.split('-').map(Number);
  if (parts.length === 2) return { min: parts[0], max: parts[1] };
  return { min: parts[0], max: parts[0] };
}

function groupByInstance(sets) {
  return sets.reduce((acc, set) => {
    const key = set.exercise_instance_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(set);
    return acc;
  }, {});
}

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

  const latestDate = allSets[0].completed_at;
  const latestDay = new Date(latestDate).toDateString();

  return allSets.filter(
    (s) => new Date(s.completed_at).toDateString() === latestDay
  );
}

async function applyProgressionForWorkout(clientId, programDayId) {
  // * Resolve active assignment — needed to scope client_exercise_targets reads
  const assignment = await ClientProgram.findOne({
    where: { client_id: clientId, active: true }
  });
  if (!assignment) throw new Error('No active program assignment found for client.');
  const clientProgramId = assignment.id;

  const sets = await fetchLatestSetsForDay(clientId, programDayId);
  if (!sets.length) throw new Error('No logged sets found for this client and program day.');

  const validSets = sets.filter((s) => s.completed_reps != null);
  const grouped = groupByInstance(validSets);

  const instanceIds = Object.keys(grouped);
  const instances = await ExerciseInstance.findAll({
    where: { id: { [Op.in]: instanceIds } }
  });

  // * Load client-specific targets — cable state read path
  const clientTargets = await ClientExerciseTarget.findAll({
    where: {
      client_program_id: clientProgramId,
      exercise_instance_id: { [Op.in]: instanceIds }
    }
  });

  const clientTargetMap = clientTargets.reduce((acc, t) => {
    acc[t.exercise_instance_id] = t;
    return acc;
  }, {});

  const instanceMap = instances.reduce((acc, i) => {
    acc[i.id] = i;
    return acc;
  }, {});

  const results = [];

  for (const instanceId of instanceIds) {
    const instance = instanceMap[instanceId];

    if (!instance) {
      results.push({ exercise_instance_id: instanceId, outcome: 'skipped', reason: 'instance not found' });
      continue;
    }

    if (instance.type === 'custom') {
      results.push({ exercise_instance_id: instanceId, outcome: 'skipped', reason: 'custom exercise' });
      continue;
    }

    const instanceSets = grouped[instanceId];

    if (instanceSets[0].completed_weight == null) {
      results.push({ exercise_instance_id: instanceId, outcome: 'skipped', reason: 'missing completed_weight' });
      continue;
    }

    const { min, max } = parseRepRange(instance.target_reps);
    const completedReps = instanceSets.map((s) => s.completed_reps);

    const all_hit_top = completedReps.every((r) => r >= max);
    const any_below_min = completedReps.some((r) => r < min);

    const outcome = all_hit_top ? 'increase' : any_below_min ? 'decrease' : 'no_change';

    let next_weight = null;
    let next_cable_state = null;

    if (outcome === 'increase' || outcome === 'decrease') {
      try {
        if (instance.equipment_type === 'cable') {
          // * Dynamic state: prefer client-specific, fall back to template
          const clientCableState = clientTargetMap[instanceId]?.cable_state || null;

          const result = await calculateNextWeight({
            type: instance.type,
            equipment_type: 'cable',
            target_weight: null,
            rep_range_min: min,
            rep_range_max: max,
            completed_reps_array: completedReps,
            cable_state: {
              base_stack_weight:   clientCableState?.base_stack_weight   ?? instance.base_stack_weight,
              current_micro_level: clientCableState?.current_micro_level ?? instance.current_micro_level,
              // * Static setup — always from template, never client-specific
              stack_step_value: instance.stack_step_value,
              micro_step_value: instance.micro_step_value,
              max_micro_levels: instance.max_micro_levels
            }
          });
          next_cable_state = result;
        } else {
          // * Use completed_weight from logged sets — already client-specific
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
        results.push({ exercise_instance_id: instanceId, outcome: 'skipped', reason: err.message });
        continue;
      }
    }

    await ExerciseProgression.destroy({
      where: { client_id: clientId, exercise_instance_id: instanceId }
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

// * Reads staged ExerciseProgression rows and writes results to client_exercise_targets.
// * NEVER writes to exercise_instances — template data must not be mutated by client progression.
// * applied_at guard prevents double-application.
async function mutateTargetsFromProgressions(clientId, programDayId) {
  const assignment = await ClientProgram.findOne({
    where: { client_id: clientId, active: true }
  });
  if (!assignment) return [];
  const clientProgramId = assignment.id;

  const instances = await ExerciseInstance.findAll({
    where: { program_day_id: programDayId },
    attributes: ['id']
  });

  const instanceIds = instances.map((i) => i.id);
  if (!instanceIds.length) return [];

  const progressions = await ExerciseProgression.findAll({
    where: {
      client_id: clientId,
      exercise_instance_id: { [Op.in]: instanceIds },
      applied_at: null,
      [Op.or]: [
        { next_weight: { [Op.ne]: null } },
        { next_cable_state: { [Op.ne]: null } }
      ]
    },
    order: [['created_at', 'DESC']]
  });

  const latestMap = new Map();
  for (const prog of progressions) {
    if (!latestMap.has(prog.exercise_instance_id)) {
      latestMap.set(prog.exercise_instance_id, prog);
    }
  }

  const filteredProgressions = Array.from(latestMap.values());

  const latestIds = new Set(filteredProgressions.map((prog) => prog.id));
  for (const prog of progressions) {
    if (!latestIds.has(prog.id)) {
      await prog.update({ applied_at: new Date() });
    }
  }

  const results = [];

  for (const prog of filteredProgressions) {
    if (prog.next_cable_state) {
      const { base_stack_weight, current_micro_level } = prog.next_cable_state;

      if (typeof base_stack_weight !== 'number' || typeof current_micro_level !== 'number') {
        await prog.update({ applied_at: new Date() });
        results.push({ exercise_instance_id: prog.exercise_instance_id, applied: 'skipped', reason: 'malformed cable state' });
        continue;
      }

      // * Write to client_exercise_targets — template untouched
      const [record, created] = await ClientExerciseTarget.findOrCreate({
        where: {
          client_program_id: clientProgramId,
          exercise_instance_id: prog.exercise_instance_id
        },
        defaults: { cable_state: { base_stack_weight, current_micro_level } }
      });
      if (!created) {
        await record.update({ cable_state: { base_stack_weight, current_micro_level } });
      }

    } else if (prog.next_weight != null) {
      // * Write to client_exercise_targets — template untouched
      const [record, created] = await ClientExerciseTarget.findOrCreate({
        where: {
          client_program_id: clientProgramId,
          exercise_instance_id: prog.exercise_instance_id
        },
        defaults: { target_weight: prog.next_weight }
      });
      if (!created) {
        await record.update({ target_weight: prog.next_weight });
      }
    }

    await prog.update({ applied_at: new Date() });

    results.push({
      exercise_instance_id: prog.exercise_instance_id,
      applied: prog.next_cable_state ? 'cable_state' : 'weight',
      ...(prog.next_cable_state
        ? { next_cable_state: prog.next_cable_state }
        : { next_weight: prog.next_weight })
    });
  }

  return results;
}

module.exports = { applyProgressionForWorkout, mutateTargetsFromProgressions };
