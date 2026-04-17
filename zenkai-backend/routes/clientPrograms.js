// Handles assigning programs to clients and loading a client's active program.
'use strict';

const express = require('express');
const router = express.Router();
const { ClientProgram, Program, ProgramDay, ExerciseInstance } = require('../models');

// Returns the active client-program assignment with nested program data
router.get('/:clientId', async (req, res) => {
  try {
    const clientProgram = await ClientProgram.findOne({
      where: {
        client_id: req.params.clientId,
        active: true
      },
      include: [
        {
          model: Program,
          attributes: ['id', 'name', 'weeks'],
          include: [
            {
              model: ProgramDay,
              as: 'ProgramDays',
              attributes: ['id', 'program_id', 'name', 'day_number'],
              include: [
                {
                  model: ExerciseInstance,
                  as: 'ExerciseInstances',           // explicit alias
                  attributes: [
                    'id',
                    'program_day_id',
                    'name',
                    'type',
                    'equipment_type',
                    'progression_mode',
                    'progression_value',
                    'target_sets',
                    'target_reps',
                    'target_weight',
                    'rest_seconds',
                    'order_index',
                    'notes',
                    'base_stack_weight',
                    'stack_step_value',
                    'micro_step_value',
                    'max_micro_levels',
                    'current_micro_level',
                    'cable_unit',
                    'cable_setup_locked'
                  ]
                }
              ]
            }
          ]
        }
      ],
      order: [
        [{ model: Program }, { model: ProgramDay, as: 'ProgramDays' }, { model: ExerciseInstance, as: 'ExerciseInstances' }, 'order_index', 'ASC']
      ]
    });

    if (!clientProgram) {
      return res.status(404).json({ error: 'No active program found' });
    }

    res.json(clientProgram);
  } catch (err) {
    console.error('GET /client-programs/:clientId ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Deactivates the active program assignment for a client
router.delete('/:clientId', async (req, res) => {
  try {
    await ClientProgram.update(
      { active: false },
      { where: { client_id: req.params.clientId, active: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assigns a program to a client.
// * If an active assignment already exists for this client + program, returns it unchanged.
// * Prevents duplicate rows and keeps client_exercise_targets stable across re-launches.
router.post('/', async (req, res) => {
  try {
    const { client_id, program_id, start_date } = req.body;

    const existing = await ClientProgram.findOne({
      where: { client_id, program_id }
    });

    if (existing && existing.active) {
      return res.status(200).json(existing);
    }

    await ClientProgram.update({ active: false }, { where: { client_id, active: true } });

    if (existing) {
      await existing.update({ active: true, start_date });
      return res.status(200).json(existing);
    }

    const assignment = await ClientProgram.create({
      client_id,
      program_id,
      start_date,
      active: true
    });

    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activates a specific assignment by id, deactivating all others for that client
router.patch('/:id/activate', async (req, res) => {
  try {
    const target = await ClientProgram.findByPk(req.params.id);
    if (!target) return res.status(404).json({ error: 'Assignment not found' });

    await ClientProgram.update({ active: false }, { where: { client_id: target.client_id, active: true } });
    await target.update({ active: true });

    res.json(target);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Returns all program assignments for a client, newest first
router.get('/:clientId/history', async (req, res) => {
  try {
    const assignments = await ClientProgram.findAll({
      where: { client_id: req.params.clientId },
      include: { model: Program, attributes: ['id', 'name', 'weeks'] },
      order: [['created_at', 'DESC']]
    });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
