// Week progression for linear periodization (BBLS 2.0) — Phase 4.
//
// * Completion gates advancement. Date is never consulted.
// * Writes ONLY to client_day_completions and client_programs.current_week.
// * Does NOT touch progression, client_exercise_targets, or logged_sets.
//
// Nothing reads current_week until Phase 5, so this service is observable but
// inert with respect to what a client actually sees.
'use strict';

const {
  ClientProgram,
  Program,
  ProgramDay,
  ClientDayCompletion,
  sequelize
} = require('../models');

/**
 * Record that `programDayId` was finished, then advance the week if every day
 * in the program has now been completed for the current week.
 *
 * Idempotent: the unique constraint on
 * (client_program_id, program_day_id, week_number) absorbs a repeat of the same
 * day in the same week, so re-finishing can neither double-count nor advance
 * the client early.
 */
async function recordDayCompletion(clientId, programDayId, sessionId = null) {
  return sequelize.transaction(async (t) => {
    // Row-lock the assignment for the duration. Two devices tapping Finish at
    // the same moment would otherwise both read the same current_week and both
    // advance it.
    const assignment = await ClientProgram.findOne({
      where: { client_id: clientId, active: true },
      lock: t.LOCK.UPDATE,
      transaction: t
    });
    if (!assignment) {
      const err = new Error('No active program assignment found for client.');
      err.status = 404;
      throw err;
    }

    const day = await ProgramDay.findByPk(programDayId, { transaction: t });
    if (!day || day.program_id !== assignment.program_id) {
      const err = new Error('Program day does not belong to the active program for this client.');
      err.status = 400;
      throw err;
    }

    const program = await Program.findByPk(assignment.program_id, { transaction: t });
    const weekBefore = assignment.current_week;

    const [, created] = await ClientDayCompletion.findOrCreate({
      where: {
        client_program_id: assignment.id,
        program_day_id: programDayId,
        week_number: weekBefore
      },
      defaults: { session_id: sessionId, completed_at: new Date() },
      transaction: t
    });

    const totalDays = await ProgramDay.count({
      where: { program_id: assignment.program_id },
      transaction: t
    });

    const completedDays = await ClientDayCompletion.count({
      where: { client_program_id: assignment.id, week_number: weekBefore },
      distinct: true,
      col: 'program_day_id',
      transaction: t
    });

    // totalDays > 0 guard: a program whose days were all deleted must not
    // advance forever on an empty denominator.
    const weekComplete = totalDays > 0 && completedDays >= totalDays;
    const atLastWeek = weekBefore >= program.weeks;

    let weekAfter = weekBefore;
    if (weekComplete && !atLastWeek) {
      weekAfter = weekBefore + 1;
      await assignment.update({ current_week: weekAfter }, { transaction: t });
    }

    return {
      client_program_id: assignment.id,
      program_day_id: programDayId,
      already_recorded: !created,
      week_number: weekBefore,
      days_completed: completedDays,
      days_total: totalDays,
      week_complete: weekComplete,
      advanced: weekAfter !== weekBefore,
      current_week: weekAfter,
      total_weeks: program.weeks
    };
  });
}

/** Read-only week status for the client's active assignment. */
async function getWeekStatus(clientId) {
  const assignment = await ClientProgram.findOne({
    where: { client_id: clientId, active: true }
  });
  if (!assignment) return null;

  const program = await Program.findByPk(assignment.program_id);

  const days = await ProgramDay.findAll({
    where: { program_id: assignment.program_id },
    attributes: ['id', 'day_number', 'name'],
    order: [['day_number', 'ASC']]
  });

  const completions = await ClientDayCompletion.findAll({
    where: {
      client_program_id: assignment.id,
      week_number: assignment.current_week
    },
    attributes: ['program_day_id', 'completed_at']
  });
  const completedIds = new Set(completions.map((c) => c.program_day_id));

  return {
    client_program_id: assignment.id,
    current_week: assignment.current_week,
    total_weeks: program.weeks,
    days_total: days.length,
    days_completed: completedIds.size,
    days: days.map((d) => ({
      id: d.id,
      day_number: d.day_number,
      name: d.name,
      completed: completedIds.has(d.id)
    }))
  };
}

module.exports = { recordDayCompletion, getWeekStatus };
