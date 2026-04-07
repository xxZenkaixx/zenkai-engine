// * Handles set logging, retrieval, and edits during workout execution.
'use strict';

const express = require('express');
const router = express.Router();
const { LoggedSet } = require('../models');

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
    const { exercise_instance_id, client_id, set_number, completed_reps, completed_weight } = req.body;

    const loggedSet = await LoggedSet.create({
      exercise_instance_id,
      client_id,
      set_number,
      completed_reps,
      // * allow null for legacy compatibility
      completed_weight: completed_weight ?? null
    });

    res.status(201).json(loggedSet);
  } catch (err) {
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
