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

  const latestWithSession = allSets.find((s) => s.session_id != null);
  if (latestWithSession) {
    return allSets.filter((s) => s.session_id === latestWithSession.session_id);
  }

  // Fallback for rows predating session_id
  const latestDay = new Date(allSets[0].completed_at).toDateString();
  return allSets.filter((s) => new Date(s.completed_at).toDateString() === latestDay);
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

  const validSets = sets.filter((s) => s.completed_reps != null && s.completed_reps > 0);
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

  console.log(`[PROG] applyProgressionForWorkout clientId=${clientId} programDayId=${programDayId} instanceCount=${instanceIds.length} setCount=${sets.length} validSetCount=${validSets.length}`);

  const results = [];

  for (const instanceId of instanceIds) {
    const instance = instanceMap[instanceId];

    if (!instance) {
      results.push({ exercise_instance_id: instanceId, outcome: 'skipped', reason: 'instance not found' });
      continue;
    }

    if (instance.type === 'custom' && instance.equipment_type !== 'cable') {
      results.push({ exercise_instance_id: instanceId, outcome: 'skipped', reason: 'custom exercise' });
      continue;
    }

    const instanceSets = grouped[instanceId];

    console.log(`[PROG] -- ${instance.name} | type=${instance.type} | equipment=${instance.equipment_type} | backoff=${instance.backoff_enabled} | template_target_weight=${instance.target_weight} | template_target_reps=${instance.target_reps}`);

    if (instance.equipment_type === 'cable') {
      const finalSet = [...instanceSets].sort((a, b) => b.set_number - a.set_number)[0];

      if (finalSet?.completed_weight == null) {
        console.log(`[PROG]   ${instance.name} — cable SKIPPED, completed_weight null on final set`);
        results.push({ exercise_instance_id: instanceId, outcome: 'skipped', reason: 'missing completed_weight' });
        continue;
      }

      const completedWeight = parseFloat(finalSet.completed_weight);
      const anchor = parseFloat(instance.base_stack_weight);
      const stackStep = parseFloat(instance.stack_step_value);
      const maxLevels = parseInt(instance.max_micro_levels) || 0;

      if (isNaN(anchor) || !(stackStep > 0)) {
        console.log(`[PROG]   ${instance.name} — cable SKIPPED, invalid setup (anchor=${anchor}, stackStep=${stackStep})`);
        results.push({ exercise_instance_id: instanceId, outcome: 'skipped', reason: 'invalid cable setup' });
        continue;
      }

      // Reverse-engineer final performed state onto valid grid (anchor + n*stackStep)
      const microStep = stackStep / (maxLevels + 1);
      const totalMicroSteps = Math.round((completedWeight - anchor) / microStep);
      const stacksFromAnchor = Math.floor(totalMicroSteps / (maxLevels + 1));
      const derivedLevel = totalMicroSteps - stacksFromAnchor * (maxLevels + 1);
      const derivedBase = anchor + stacksFromAnchor * stackStep;

      // One-step advance/retreat from derived state, based on final set's reps vs rep range
      const targetReps = clientTargetMap[instanceId]?.target_reps ?? instance.target_reps;
      const { min, max } = parseRepRange(targetReps);
      const finalReps = finalSet.completed_reps;

      let newBase = derivedBase;
      let newLevel = derivedLevel;

      if (finalReps >= max) {
        if (derivedLevel < maxLevels) {
          newLevel = derivedLevel + 1;
        } else {
          newBase = derivedBase + stackStep;
          newLevel = 0;
        }
      } else if (finalReps < min) {
        if (derivedLevel > 0) {
          newLevel = derivedLevel - 1;
        } else if (derivedBase > stackStep) {
          newBase = derivedBase - stackStep;
          newLevel = maxLevels;
        }
        // else: already at floor; stay
      }

      const prior = clientTargetMap[instanceId]?.cable_state;
      const priorBase = prior?.base_stack_weight ?? anchor;
      const priorLevel = prior?.current_micro_level ?? (parseInt(instance.current_micro_level) || 0);

      const changed = newBase !== priorBase || newLevel !== priorLevel;
      const cableOutcome = !changed
        ? 'no_change'
        : (newBase > priorBase || (newBase === priorBase && newLevel > priorLevel))
          ? 'increase'
          : 'decrease';

      console.log(`[PROG]   ${instance.name} — cable | completed=${completedWeight} reps=${finalReps} range=${min}-${max} | derived={${derivedBase},${derivedLevel}} | next={${newBase},${newLevel}} | prior={${priorBase},${priorLevel}} | outcome=${cableOutcome}`);

      await ExerciseProgression.destroy({
        where: { client_id: clientId, exercise_instance_id: instanceId }
      });

      await ExerciseProgression.create({
        client_id: clientId,
        exercise_instance_id: instanceId,
        next_weight: null,
        next_cable_state: changed ? { base_stack_weight: newBase, current_micro_level: newLevel } : null
      });

      results.push({
        exercise_instance_id: instanceId,
        outcome: cableOutcome,
        ...(changed ? { next_cable_state: { base_stack_weight: newBase, current_micro_level: newLevel } } : {})
      });

      continue;
    }

    if (instance.type === 'bodyweight') {
      const currentTargetReps = clientTargetMap[instanceId]?.target_reps ?? instance.target_reps;
      const { min, max } = parseRepRange(currentTargetReps);
      const allHitTop = instanceSets.every((s) => s.completed_reps >= max);
      const anyBelowMin = instanceSets.some((s) => s.completed_reps < min);

      let nextReps = null;
      let outcome = 'no_change';

      if (allHitTop) {
        const isRange = currentTargetReps.includes('-');
        nextReps = isRange ? `${min + 1}-${max + 1}` : `${max + 1}`;
        outcome = 'increase';
      } else if (anyBelowMin) {
        const nextMin = Math.max(1, min - 1);
        const nextMax = Math.max(1, max - 1);
        const isRange = currentTargetReps.includes('-');
        nextReps = isRange ? `${nextMin}-${nextMax}` : `${nextMax}`;
        outcome = 'decrease';
      }

      console.log(`[PROG]   bodyweight reps=[${instanceSets.map(s => s.completed_reps).join(',')}] range=${min}-${max} allHitTop=${allHitTop} anyBelowMin=${anyBelowMin} outcome=${outcome} nextReps=${nextReps}`);

      if (outcome !== 'no_change') {
        await ExerciseProgression.destroy({
          where: { client_id: clientId, exercise_instance_id: instanceId }
        });
        await ExerciseProgression.create({
          client_id: clientId,
          exercise_instance_id: instanceId,
          next_target_reps: nextReps,
          next_weight: null,
          next_cable_state: null
        });
      }

      results.push({ exercise_instance_id: instanceId, outcome, ...(nextReps ? { next_target_reps: nextReps } : {}) });
      continue;
    }

    if (instanceSets[0].completed_weight == null) {
      console.log(`[PROG]   SKIPPED — completed_weight is null`);
      results.push({ exercise_instance_id: instanceId, outcome: 'skipped', reason: 'missing completed_weight' });
      continue;
    }

    const { min, max } = parseRepRange(instance.target_reps);

    // For backoff exercises, evaluate set 1 only; all sets otherwise
    const topSet = instanceSets.find(s => s.set_number === 1);
    const evalSets = instance.backoff_enabled
      ? (topSet ? [topSet] : [instanceSets[0]])
      : instanceSets;
    const completedReps = evalSets.map((s) => s.completed_reps);

    const all_hit_top = completedReps.every((r) => r >= max);
    const any_below_min = completedReps.some((r) => r < min);

    const outcome = all_hit_top ? 'increase' : any_below_min ? 'decrease' : 'no_change';

    console.log(`[PROG]   evalSets=${evalSets.length} completedReps=[${completedReps.join(',')}] completedWeights=[${evalSets.map(s => s.completed_weight).join(',')}] range=${min}-${max} all_hit_top=${all_hit_top} any_below_min=${any_below_min} outcome=${outcome}`);

    let next_weight = null;
    let next_cable_state = null;

    if (outcome === 'increase' || outcome === 'decrease') {
      try {
        const baseWeight = instance.backoff_enabled
          ? (topSet?.completed_weight ?? instanceSets[0].completed_weight)
          : instanceSets[0].completed_weight;

        next_weight = await calculateNextWeight({
          type: instance.type,
          equipment_type: instance.equipment_type,
          target_weight: parseFloat(baseWeight),
          rep_range_min: min,
          rep_range_max: max,
          completed_reps_array: completedReps
        });
        console.log(`[PROG]   next_weight=${next_weight} (baseWeight=${baseWeight})`);
      } catch (err) {
        console.log(`[PROG]   calculateNextWeight THREW: ${err.message}`);
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
        { next_cable_state: { [Op.ne]: null } },
        { next_target_reps: { [Op.ne]: null } }
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

    } else if (prog.next_target_reps != null) {
      // * Write to client_exercise_targets — template untouched
      const [record, created] = await ClientExerciseTarget.findOrCreate({
        where: {
          client_program_id: clientProgramId,
          exercise_instance_id: prog.exercise_instance_id
        },
        defaults: { target_reps: prog.next_target_reps }
      });
      if (!created) {
        await record.update({ target_reps: prog.next_target_reps });
      }
    }

    await prog.update({ applied_at: new Date() });

    results.push({
      exercise_instance_id: prog.exercise_instance_id,
      applied: prog.next_cable_state ? 'cable_state' : prog.next_target_reps ? 'target_reps' : 'weight',
      ...(prog.next_cable_state
        ? { next_cable_state: prog.next_cable_state }
        : prog.next_target_reps
        ? { next_target_reps: prog.next_target_reps }
        : { next_weight: prog.next_weight })
    });
  }

  return results;
}

module.exports = { applyProgressionForWorkout, mutateTargetsFromProgressions };
