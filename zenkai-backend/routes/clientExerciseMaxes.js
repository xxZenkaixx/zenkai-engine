// Client-specific Training 1RM for periodized (primary/secondary) exercises.
// * GET  /:clientProgramId                — periodized exercises + current 1RM
// * PUT  /:clientProgramId/exercise/:id   — upsert one 1RM (null clears it)
//
// Storage only. No calculation lives here — the weekly prescription that
// consumes training_1rm arrives in Phase 5.
'use strict';

const express = require('express');
const router = express.Router();
const {
  ClientProgram,
  Program,
  ProgramDay,
  ExerciseInstance,
  ClientExerciseMax
} = require('../models');
const protect = require('../middleware/protect');
const requireRole = require('../middleware/requireRole');
const { getOwnedClient } = require('../middleware/ownership');

const PERIODIZED_ROLES = ['primary', 'secondary'];

// Resolve the assignment and confirm the caller owns the client behind it.
// Admins bypass via getOwnedClient; self-serve is scoped to their own record.
async function getOwnedAssignment(req, clientProgramId) {
  const assignment = await ClientProgram.findByPk(clientProgramId);
  if (!assignment) return null;
  const client = await getOwnedClient(req, assignment.client_id);
  return client ? assignment : null;
}

router.get('/:clientProgramId', protect, async (req, res) => {
  try {
    const assignment = await getOwnedAssignment(req, req.params.clientProgramId);
    if (!assignment) return res.status(403).json({ error: 'Forbidden' });

    const program = await Program.findByPk(assignment.program_id, {
      include: {
        model: ProgramDay,
        include: { model: ExerciseInstance }
      }
    });
    if (!program) return res.status(404).json({ error: 'Program not found' });

    const maxes = await ClientExerciseMax.findAll({
      where: { client_program_id: assignment.id }
    });
    const maxMap = maxes.reduce((acc, m) => {
      acc[m.exercise_instance_id] =
        m.training_1rm != null ? parseFloat(m.training_1rm) : null;
      return acc;
    }, {});

    const days = [...(program.ProgramDays || [])]
      .sort((a, b) => a.day_number - b.day_number)
      .map((day) => ({
        id: day.id,
        day_number: day.day_number,
        name: day.name,
        exercises: [...(day.ExerciseInstances || [])]
          .filter((ex) => PERIODIZED_ROLES.includes(ex.periodization_role))
          .sort((a, b) => a.order_index - b.order_index)
          .map((ex) => ({
            id: ex.id,
            name: ex.name,
            periodization_role: ex.periodization_role,
            equipment_type: ex.equipment_type,
            target_sets: ex.target_sets,
            target_reps: ex.target_reps,
            training_1rm: maxMap[ex.id] ?? null
          }))
      }))
      // Days with no periodized work would render as empty headers.
      .filter((day) => day.exercises.length > 0);

    res.json({ days });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put(
  '/:clientProgramId/exercise/:exerciseInstanceId',
  protect,
  requireRole('admin', 'self-serve'),
  async (req, res) => {
    try {
      const { clientProgramId, exerciseInstanceId } = req.params;

      const assignment = await getOwnedAssignment(req, clientProgramId);
      if (!assignment) return res.status(403).json({ error: 'Forbidden' });

      const raw = req.body.training_1rm;
      const training_1rm = raw != null && raw !== '' ? parseFloat(raw) : null;
      if (training_1rm !== null && (!Number.isFinite(training_1rm) || training_1rm <= 0)) {
        return res.status(400).json({
          field: 'training_1rm',
          error: 'Training 1RM must be a positive number, or blank to clear it.'
        });
      }

      // The instance must belong to THIS assignment's program, or we'd be
      // storing a 1RM that no prescription will ever read.
      const instance = await ExerciseInstance.findByPk(exerciseInstanceId, {
        include: { model: ProgramDay }
      });
      if (!instance || instance.ProgramDay?.program_id !== assignment.program_id) {
        return res.status(404).json({ error: 'Exercise not found on this program.' });
      }

      if (!PERIODIZED_ROLES.includes(instance.periodization_role)) {
        return res.status(400).json({
          field: 'training_1rm',
          error: 'Training 1RM only applies to primary or secondary exercises.'
        });
      }

      const [record, created] = await ClientExerciseMax.findOrCreate({
        where: {
          client_program_id: clientProgramId,
          exercise_instance_id: exerciseInstanceId
        },
        defaults: { training_1rm }
      });
      if (!created) await record.update({ training_1rm });

      res.json({
        exercise_instance_id: exerciseInstanceId,
        training_1rm: record.training_1rm != null ? parseFloat(record.training_1rm) : null
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
