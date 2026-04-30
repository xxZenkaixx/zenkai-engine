'use strict';
const express = require('express');
const router = express.Router();
const { ClientProgram, Program, ProgramDay, ExerciseInstance, Client } = require('../models');
const protect = require('../middleware/protect');

const ownsClient = async (req, clientId) => {
  const client = await Client.findByPk(clientId);
  if (!client) return false;
  if (req.user.role === 'client' || req.user.role === 'self-serve') return client.user_id === req.user.id;
  return client.coach_id === req.user.id;
};

router.get('/:clientId', protect, async (req, res) => {
  try {
    if (!await ownsClient(req, req.params.clientId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const clientProgram = await ClientProgram.findOne({
      where: { client_id: req.params.clientId, active: true },
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
                  as: 'ExerciseInstances',
                  attributes: [
                    'id', 'program_day_id', 'name', 'type', 'equipment_type',
                    'progression_mode', 'progression_value', 'target_sets',
                    'target_reps', 'target_weight', 'rest_seconds', 'order_index',
                    'notes', 'base_stack_weight', 'stack_step_value',
                    'micro_step_value', 'max_micro_levels', 'current_micro_level',
                    'cable_unit', 'cable_setup_locked', 'backoff_enabled',
                    'backoff_percent', 'micro_type', 'micro_display_label'
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
    if (!clientProgram) return res.status(404).json({ error: 'No active program found' });
    res.json(clientProgram);
  } catch (err) {
    console.error('GET /client-programs/:clientId ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:clientId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    if (!await ownsClient(req, req.params.clientId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await ClientProgram.update(
      { active: false },
      { where: { client_id: req.params.clientId, active: true } }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'self-serve') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { client_id, program_id, start_date } = req.body;

    if (!await ownsClient(req, client_id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const existing = await ClientProgram.findOne({ where: { client_id, program_id } });
    if (existing && existing.active) return res.status(200).json(existing);

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

router.patch('/:id/activate', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const target = await ClientProgram.findByPk(req.params.id);
    if (!target) return res.status(404).json({ error: 'Assignment not found' });

    if (!await ownsClient(req, target.client_id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await ClientProgram.update(
      { active: false },
      { where: { client_id: target.client_id, active: true } }
    );

    await target.update({ active: true });
    res.json(target);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:clientId/history', protect, async (req, res) => {
  try {
    if (!await ownsClient(req, req.params.clientId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
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
