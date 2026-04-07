// * Handles exercise instance creation, retrieval, updating, and deletion.
'use strict';

const express = require('express');
const router = express.Router();
const { ExerciseInstance } = require('../models');

// * GET all exercise instances for one program day
router.get('/program-day/:programDayId', async (req, res) => {
  try {
    const exercises = await ExerciseInstance.findAll({
      where: { program_day_id: req.params.programDayId },
      order: [['order_index', 'ASC']]
    });

    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * POST create one exercise instance
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

// * PUT update one exercise instance
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

// * DELETE one exercise instance
router.delete('/:id', async (req, res) => {
  try {
    const exercise = await ExerciseInstance.findByPk(req.params.id);

    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    await exercise.destroy();
    res.json({ message: 'Exercise deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
