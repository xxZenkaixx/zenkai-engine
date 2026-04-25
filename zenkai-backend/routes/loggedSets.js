// zenkai-backend/routes/loggedSets.js
'use strict';

const express = require('express');
const router = express.Router();
const { LoggedSet, ExerciseInstance, sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

router.get('/', async (req, res) => {
  try {
    const { exercise_instance_id, client_id } = req.query;
    const where = {};
    if (exercise_instance_id) where.exercise_instance_id = exercise_instance_id;
    if (client_id) where.client_id = client_id;

    const loggedSets = await LoggedSet.findAll({
      where,
      order: [['set_number', 'ASC']]
    });

    res.json(loggedSets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { id, exercise_instance_id, client_id, set_number, completed_reps, completed_weight } = req.body;

    if (id) {
      const existing = await LoggedSet.findOne({
        where: { idempotency_key: id }
      });
      if (existing) return res.json(existing);
    }

    const instance = await ExerciseInstance.findByPk(exercise_instance_id);
    if (!instance) {
      console.error('POST /loggedSets ERROR: instance not found', { exercise_instance_id });
      return res.status(404).json({ error: 'Exercise instance not found' });
    }

    let resolvedWeight = null;

    if (completed_weight != null) {
      resolvedWeight = parseFloat(completed_weight);
    } else if (instance.equipment_type === 'cable') {
      resolvedWeight =
        instance.base_stack_weight +
        instance.current_micro_level * instance.micro_step_value;
    } else {
      if (instance.target_weight == null) {
        console.error('POST /loggedSets BLOCKED: missing target_weight', { exercise_instance_id });
        return res.status(400).json({
          error: 'Missing target_weight on exercise instance'
        });
      }
      resolvedWeight = instance.target_weight;
    }

    const loggedSet = await LoggedSet.create({
      exercise_instance_id,
      client_id,
      set_number,
      completed_reps,
      completed_weight: resolvedWeight,
      idempotency_key: id || null
    });

    console.log('POST /loggedSets SUCCESS:', {
      exercise_instance_id,
      completed_reps,
      completed_weight
    });

    res.status(201).json(loggedSet);
  } catch (err) {
    console.error('POST /loggedSets ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// FIXED: bulk update notes per exercise per session (via join to program_day)
router.put('/note', async (req, res) => {
  try {
    const { exercise_instance_id, date, program_day_id, exercise_note } = req.body;

    if (!exercise_instance_id || !date || !program_day_id) {
      return res.status(400).json({
        error: 'exercise_instance_id, date, and program_day_id are required'
      });
    }

    await sequelize.query(
      `UPDATE logged_sets ls
       SET exercise_note = :note
       FROM exercise_instances ei
       WHERE ls.exercise_instance_id = :eiId
         AND ls.exercise_instance_id = ei.id
         AND DATE(ls.completed_at) = :date
         AND ei.program_day_id = :programDayId`,
      {
        replacements: {
          note: exercise_note || null,
          eiId: exercise_instance_id,
          date,
          programDayId: program_day_id
        },
        type: QueryTypes.UPDATE
      }
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const loggedSet = await LoggedSet.findByPk(req.params.id);

    if (!loggedSet) {
      return res.status(404).json({ error: 'Set not found' });
    }

    const { completed_reps, completed_weight } = req.body;

    const updateFields = { completed_reps };

    if (completed_weight !== undefined) {
      updateFields.completed_weight = completed_weight;
    }

    await loggedSet.update(updateFields);

    res.json(loggedSet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const loggedSet = await LoggedSet.findByPk(req.params.id);

    if (!loggedSet) {
      return res.status(404).json({ error: 'Set not found' });
    }

    await loggedSet.destroy();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
