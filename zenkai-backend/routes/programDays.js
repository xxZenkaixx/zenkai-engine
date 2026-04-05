// Handles program day creation and retrieval. Days are repeating templates.
'use strict';

const express = require('express');
const router = express.Router();
const { ProgramDay, ExerciseInstance } = require('../models');

// GET all days for a program (with exercises)
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

// POST create program day
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

module.exports = router;
