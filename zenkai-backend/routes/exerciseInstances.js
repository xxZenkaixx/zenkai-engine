// * Handles exercise instance CRUD.
'use strict';

const express = require('express');
const router = express.Router();
const { ExerciseInstance } = require('../models');

// * GET exercises for a specific day
router.get('/day/:dayId', async (req, res) => {
  try {
    const exercises = await ExerciseInstance.findAll({
      where: { program_day_id: req.params.dayId },
      order: [['order_index', 'ASC']]
    });

    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * CREATE exercise
router.post('/', async (req, res) => {
  try {
    const exercise = await ExerciseInstance.create(req.body);
    res.status(201).json(exercise);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * Updates any field including type — enforces required + valid type
router.put('/:id', async (req, res) => {
  try {
    const exercise = await ExerciseInstance.findByPk(req.params.id);
    if (!exercise) return res.status(404).json({ error: 'Exercise not found' });

    if (req.body.hasOwnProperty('type')) {
      if (req.body.type === '' || req.body.type === null) {
        return res.status(400).json({ field: 'type', error: 'Exercise type is required.' });
      }

      if (!['compound', 'accessory', 'custom'].includes(req.body.type)) {
        return res.status(400).json({ field: 'type', error: 'Invalid exercise type.' });
      }
    }

    await exercise.update(req.body);
    res.json(exercise);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * DELETE exercise
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
