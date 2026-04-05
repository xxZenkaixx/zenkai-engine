// Handles exercise creation, editing, and deletion within a program day.
'use strict';

const express = require('express');
const router = express.Router();
const { ExerciseInstance } = require('../models');

// Creates an exercise instance with prescribed target values
router.post('/', async (req, res) => {
  try {
    const {
      program_day_id,
      name,
      target_sets,
      target_reps,
      target_weight,
      rest_seconds,
      order_index,
      notes
    } = req.body;

    const exercise = await ExerciseInstance.create({
      program_day_id,
      name,
      target_sets,
      target_reps,
      target_weight,
      rest_seconds,
      order_index,
      notes
    });

    res.status(201).json(exercise);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Updates one exercise instance by id
router.put('/:id', async (req, res) => {
  try {
    const exercise = await ExerciseInstance.findByPk(req.params.id);

    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    await exercise.update(req.body);
    res.json(exercise);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deletes one exercise instance by id
router.delete('/:id', async (req, res) => {
  try {
    const exercise = await ExerciseInstance.findByPk(req.params.id);

    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    await exercise.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
