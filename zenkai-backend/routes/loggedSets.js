// Handles set logging and set edits during workout execution.
'use strict';

const express = require('express');
const router = express.Router();
const { LoggedSet } = require('../models');

// Logs one completed set. MVP 1 stores completed reps only.
router.post('/', async (req, res) => {
  try {
    const { exercise_instance_id, client_id, set_number, completed_reps } = req.body;

    const loggedSet = await LoggedSet.create({
      exercise_instance_id,
      client_id,
      set_number,
      completed_reps
    });

    res.status(201).json(loggedSet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Updates completed reps on an existing logged set
router.put('/:id', async (req, res) => {
  try {
    const loggedSet = await LoggedSet.findByPk(req.params.id);

    if (!loggedSet) {
      return res.status(404).json({ error: 'Set not found' });
    }

    await loggedSet.update({ completed_reps: req.body.completed_reps });
    res.json(loggedSet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
