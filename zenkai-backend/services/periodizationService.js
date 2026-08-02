// Linear periodization (BBLS 2.0) — Phase 5.
//
// Computes this week's prescription for each exercise on a client's program.
// PURE READ: touches no table other than periodization_weeks and
// client_exercise_maxes, and writes nothing anywhere.
//
// Consumed by GET /api/client-programs/:clientId as layer 3 of the merge:
//   1. template values from exercise_instances
//   2. client_exercise_targets overlay   (existing, untouched)
//   3. this                              (primary/secondary: weight+sets+reps,
//                                         accessory: reps only)
//
// Every gap results in COMPLETE fall-through for that exercise — a primary lift
// with this week's reps but last month's weight is worse than leaving it alone.
'use strict';

const { PeriodizationWeek, ClientExerciseMax } = require('../models');

const PERIODIZED_ROLES = ['primary', 'secondary'];

// Progression drives these by moving REPS, so a weekly rep schedule would fight
// it. Applies to accessories (skip the schedule) and to primary/secondary
// (ineligible entirely — there is no external load to take a percentage of).
const REP_PROGRESSED_TYPES = ['bodyweight', 'isometric'];

/**
 * Equipment-aware rounding — the authoritative rule for periodized weights.
 *
 * Mirrors zenkai-frontend/src/utils/weightUtils.js roundWeight: dumbbells to
 * 2.5 lb, everything else to 5 lb. The frontend still rounds for display, but
 * on an already-rounded number that is a no-op, so the two cannot disagree.
 *
 * ! Kept in sync by hand with the frontend copy. Change both or neither.
 */
function roundWeight(weight, equipmentType) {
  if (weight == null || !Number.isFinite(weight)) return null;
  if (equipmentType === 'dumbbell') return Math.round(weight / 2.5) * 2.5;
  return Math.round(weight / 5) * 5;
}

/**
 * Why an exercise was not periodized. Surfaced in logs so "this lift didn't
 * change" is answerable without a debugging session.
 */
const SKIP = {
  NO_SCHEDULE: 'no_schedule_for_program',
  NO_WEEK_ROW: 'no_row_for_week_and_role',
  NO_MAX: 'no_training_1rm',
  INELIGIBLE_EQUIPMENT: 'ineligible_equipment_for_percentage_load',
  PROGRESSION_OWNS_REPS: 'progression_owns_reps',
};

/**
 * A cable's load is a pin position plus micro-adjusters on a fixed grid, and
 * bodyweight/isometric work has no external load at all. Neither can consume a
 * raw "% of 1RM" number, so they are ineligible for primary/secondary in v1.
 */
function isEligibleForPercentageLoad(ex) {
  if (ex.equipment_type === 'cable') return false;
  if (REP_PROGRESSED_TYPES.includes(ex.type)) return false;
  return true;
}

/**
 * @param {object} assignment  ClientProgram — needs id, program_id, current_week
 * @param {object[]} exercises Plain exercise-instance objects for the program
 * @returns {Promise<{weekNumber:number, byExerciseId:object, summary:object}>}
 *
 * byExerciseId[id] is either
 *   { applied: true, overrides: {...}, diagnostic: {...} }
 * or
 *   { applied: false, reason: <SKIP value> }
 *
 * `overrides` contains ONLY the fields that should replace template values, so
 * the caller can assign them blindly without clobbering anything else.
 */
async function getWeeklyPrescriptions(assignment, exercises = []) {
  const weekNumber = assignment.current_week;
  const byExerciseId = {};
  const summary = { week: weekNumber, applied: 0, skipped: {} };

  const skip = (id, reason) => {
    byExerciseId[id] = { applied: false, reason };
    summary.skipped[reason] = (summary.skipped[reason] || 0) + 1;
  };

  // One query for the week's schedule. No rows at all means this program is not
  // periodized — the overwhelmingly common case, and it costs exactly one query.
  const weekRows = await PeriodizationWeek.findAll({
    where: { program_id: assignment.program_id, week_number: weekNumber }
  });

  if (weekRows.length === 0) {
    for (const ex of exercises) skip(ex.id, SKIP.NO_SCHEDULE);
    return { weekNumber, byExerciseId, summary };
  }

  const rowByRole = weekRows.reduce((acc, r) => {
    acc[r.periodization_role] = r;
    return acc;
  }, {});

  // One query for the client's maxes. Only needed if something is periodized.
  const needsMaxes = exercises.some(
    (ex) => PERIODIZED_ROLES.includes(ex.periodization_role)
  );
  const maxByExerciseId = {};
  if (needsMaxes) {
    const maxes = await ClientExerciseMax.findAll({
      where: { client_program_id: assignment.id }
    });
    for (const m of maxes) {
      maxByExerciseId[m.exercise_instance_id] =
        m.training_1rm != null ? parseFloat(m.training_1rm) : null;
    }
  }

  for (const ex of exercises) {
    const role = ex.periodization_role || 'accessory';
    const row = rowByRole[role];

    if (!row) { skip(ex.id, SKIP.NO_WEEK_ROW); continue; }

    // ---- accessory: rep schedule only --------------------------------------
    if (!PERIODIZED_ROLES.includes(role)) {
      // Bodyweight and isometric progress by moving reps. Overriding reps here
      // would silently disable that progression every week.
      if (REP_PROGRESSED_TYPES.includes(ex.type)) {
        skip(ex.id, SKIP.PROGRESSION_OWNS_REPS);
        continue;
      }

      byExerciseId[ex.id] = {
        applied: true,
        overrides: { target_reps: row.reps },
        diagnostic: {
          week_number: weekNumber,
          role,
          reps: row.reps
        }
      };
      summary.applied++;
      continue;
    }

    // ---- primary / secondary: weight + sets + reps ---------------------------
    if (!isEligibleForPercentageLoad(ex)) {
      console.warn(
        `[PERIODIZATION] "${ex.name}" is tagged ${role} but is ` +
        `${ex.equipment_type}/${ex.type} — a % of 1RM cannot be applied. ` +
        `Falling through to existing behavior.`
      );
      skip(ex.id, SKIP.INELIGIBLE_EQUIPMENT);
      continue;
    }

    const trainingMax = maxByExerciseId[ex.id];
    if (trainingMax == null || !(trainingMax > 0)) {
      skip(ex.id, SKIP.NO_MAX);
      continue;
    }

    const intensityPct = parseFloat(row.intensity_pct);
    const rawWeight = trainingMax * (intensityPct / 100);
    const roundedWeight = roundWeight(rawWeight, ex.equipment_type);

    if (roundedWeight == null) { skip(ex.id, SKIP.NO_MAX); continue; }

    byExerciseId[ex.id] = {
      applied: true,
      overrides: {
        target_weight: roundedWeight,
        target_sets: row.sets,
        // Passed through verbatim — week 15 is the string 'AMRAP' and nothing
        // in this path parses reps numerically.
        target_reps: row.reps
      },
      diagnostic: {
        week_number: weekNumber,
        role,
        intensity_pct: intensityPct,
        training_1rm: trainingMax,
        raw_weight: rawWeight,
        rounded_weight: roundedWeight,
        sets: row.sets,
        reps: row.reps
      }
    };
    summary.applied++;
  }

  return { weekNumber, byExerciseId, summary };
}

module.exports = { getWeeklyPrescriptions, roundWeight, SKIP };
