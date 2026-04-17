// * Handles set logging, retrieval, and edits during workout execution.
'use strict';

const express = require('express');
const router = express.Router();
const { LoggedSet, ExerciseInstance } = require('../models');

// * get logged sets for one exercise + client
router.get('/', async (req, res) => {
  try {
    const { exercise_instance_id, client_id } = req.query;

    const where = {};

    if (exercise_instance_id) {
      where.exercise_instance_id = exercise_instance_id;
    }

    if (client_id) {
      where.client_id = client_id;
    }

    const loggedSets = await LoggedSet.findAll({
      where,
      order: [['set_number', 'ASC']]
    });

    res.json(loggedSets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * log one completed set
router.post('/', async (req, res) => {
  try {
    const {
      id,
      exercise_instance_id,
      client_id,
      set_number,
      completed_reps,
      completed_weight
    } = req.body;

    if (id) {
      const existing = await LoggedSet.findOne({ where: { idempotency_key: id } });
      if (existing) return res.json(existing);
    }

    // * fetch exercise instance for weight snapshot
    const instance = await ExerciseInstance.findByPk(exercise_instance_id);

    if (!instance) {
      console.error('POST /loggedSets ERROR: instance not found', { exercise_instance_id });
      return res.status(404).json({ error: 'Exercise instance not found' });
    }

    // * use client-provided weight if sent; otherwise compute from DB
    let resolvedWeight = null;

    if (completed_weight != null) {
      resolvedWeight = parseFloat(completed_weight);
    } else if (instance.equipment_type === 'cable') {
      resolvedWeight =
        instance.base_stack_weight +
        instance.current_micro_level * instance.micro_step_value;
    } else {
      if (instance.target_weight == null) {
        console.error('POST /loggedSets BLOCKED: missing target_weight', {
          exercise_instance_id
        });
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

// * update completed reps for one logged set
router.put('/:id', async (req, res) => {
  try {
    const loggedSet = await LoggedSet.findByPk(req.params.id);

    if (!loggedSet) {
      return res.status(404).json({ error: 'Set not found' });
    }

    const { completed_reps, completed_weight } = req.body;

    await loggedSet.update({
      completed_reps,
      ...(completed_weight !== undefined && { completed_weight })
    });
    res.json(loggedSet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * delete a logged set
router.delete('/:id', async (req, res) => {
  try {
    const loggedSet = await LoggedSet.findByPk(req.params.id);
    if (!loggedSet) return res.status(404).json({ error: 'Set not found' });
    await loggedSet.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
