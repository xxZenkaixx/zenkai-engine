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
    const { exercise_instance_id, client_id, set_number, completed_reps } = req.body;

    // * fetch exercise instance for weight snapshot
    const instance = await ExerciseInstance.findByPk(exercise_instance_id);

    if (!instance) {
      console.error('POST /loggedSets ERROR: instance not found', { exercise_instance_id });
      return res.status(404).json({ error: 'Exercise instance not found' });
    }

    // * determine effective weight (source of truth)
    let completed_weight = null;

    if (instance.equipment_type === 'cable') {
      completed_weight =
        instance.base_stack_weight +
        instance.current_micro_level * instance.micro_step_value;
    } else {
      // ! enforce weight must exist for non-cable
      if (instance.target_weight == null) {
        console.error('POST /loggedSets BLOCKED: missing target_weight', {
          exercise_instance_id
        });

        return res.status(400).json({
          error: 'Missing target_weight on exercise instance'
        });
      }

      completed_weight = instance.target_weight;
    }

    const loggedSet = await LoggedSet.create({
      exercise_instance_id,
      client_id,
      set_number,
      completed_reps,
      completed_weight
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
// * Fetch logged sets for a specific client + exercise for history view
router.get('/', async (req, res) => {
  try {
    const { client_id, exercise_instance_id } = req.query;

    if (!client_id || !exercise_instance_id) {
      return res.status(400).json({
        error: 'client_id and exercise_instance_id are required'
      });
    }

    const sets = await LoggedSet.findAll({
      where: {
        client_id,
        exercise_instance_id
      },
      order: [['completed_at', 'ASC']]
    });

    res.json(sets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
