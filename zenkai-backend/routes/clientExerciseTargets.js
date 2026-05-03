// Client-specific exercise weight targets.
// * GET /:clientProgramId               — program structure with client overrides merged
// * PUT /:clientProgramId/exercise/:id  — upsert target_weight for one exercise
'use strict';

const express = require('express');
const router = express.Router();
const {
  ClientProgram,
  Program,
  ProgramDay,
  ExerciseInstance,
  ClientExerciseTarget
} = require('../models');
const protect = require('../middleware/protect');
const requireRole = require('../middleware/requireRole');

router.get('/:clientProgramId', async (req, res) => {
  try {
    const assignment = await ClientProgram.findByPk(req.params.clientProgramId, {
      include: {
        model: Program,
        include: {
          model: ProgramDay,
          include: {
            model: ExerciseInstance,
            order: [['order_index', 'ASC']]
          }
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const targets = await ClientExerciseTarget.findAll({
      where: { client_program_id: req.params.clientProgramId }
    });

    const targetMap = targets.reduce((acc, t) => {
      acc[t.exercise_instance_id] = {
        target_weight: t.target_weight != null ? parseFloat(t.target_weight) : null,
        cable_state:   t.cable_state || null,
        target_reps:   t.target_reps || null
      };
      return acc;
    }, {});

    const rawDays = assignment.Program?.ProgramDays || [];
    const days = [...rawDays]
      .sort((a, b) => a.day_number - b.day_number)
      .map((day) => ({
        id: day.id,
        day_number: day.day_number,
        name: day.name,
        exercises: [...(day.ExerciseInstances || [])]
          .sort((a, b) => a.order_index - b.order_index)
          .map((ex) => {
            const target = targetMap[ex.id];
            return {
              id: ex.id,
              name: ex.name,
              type: ex.type,
              equipment_type: ex.equipment_type,
              target_sets: ex.target_sets,
              target_reps: target?.target_reps || ex.target_reps,
              template_weight: ex.target_weight != null ? parseFloat(ex.target_weight) : null,
              client_weight:   target?.target_weight ?? null,
              cable_state:     target?.cable_state ?? null
            };
          })
      }));

    res.json({ days });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:clientProgramId/exercise/:exerciseInstanceId', protect, requireRole('admin', 'self-serve'), async (req, res) => {
  try {
    const { clientProgramId, exerciseInstanceId } = req.params;
    const raw = req.body.target_weight;
    const target_weight = raw != null && raw !== '' ? parseFloat(raw) : null;

    const [record, created] = await ClientExerciseTarget.findOrCreate({
      where: {
        client_program_id: clientProgramId,
        exercise_instance_id: exerciseInstanceId
      },
      defaults: { target_weight }
    });

    if (!created) {
      await record.update({ target_weight });
    }

    res.json({
      exercise_instance_id: exerciseInstanceId,
      target_weight: record.target_weight != null ? parseFloat(record.target_weight) : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
