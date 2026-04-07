// * Handles program day creation, retrieval, updating, and deletion.
'use strict';

const express = require('express');
const router = express.Router();
const { ProgramDay, ExerciseInstance } = require('../models');

// * GET all days for one program
router.get('/program/:programId', async (req, res) => {
  try {
    const days = await ProgramDay.findAll({
      where: { program_id: req.params.programId },
      include: {
        model: ExerciseInstance,
        order: [['order_index', 'ASC']]
      },
      order: [['day_number', 'ASC']]
    });

    res.json(days);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * POST create one program day
router.post('/', async (req, res) => {
  try {
    const { program_id, day_number, name } = req.body;

    const day = await ProgramDay.create({
      program_id,
      day_number,
      name
    });

    res.status(201).json(day);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * PUT update one program day
router.put('/:id', async (req, res) => {
  try {
    const day = await ProgramDay.findByPk(req.params.id);

    if (!day) {
      return res.status(404).json({ error: 'Day not found' });
    }

    await day.update(req.body);
    res.json(day);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * DELETE one program day
router.delete('/:id', async (req, res) => {
  try {
    const day = await ProgramDay.findByPk(req.params.id);

    if (!day) {
      return res.status(404).json({ error: 'Day not found' });
    }

    await day.destroy();
    res.json({ message: 'Day deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
