// Handles program creation and retrieval. Uses Program, ProgramDay, ExerciseInstance.
'use strict';

const express = require('express');
const router = express.Router();
const { Program, ProgramDay, ExerciseInstance } = require('../models');

// GET all programs
router.get('/', async (req, res) => {
  try {
    const programs = await Program.findAll();
    res.json(programs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET one program with nested days + exercises
router.get('/:id', async (req, res) => {
  try {
    const program = await Program.findByPk(req.params.id, {
      include: {
        model: ProgramDay,
        include: {
          model: ExerciseInstance,
          order: [['order_index', 'ASC']]
        }
      }
    });

    if (!program) return res.status(404).json({ error: 'Program not found' });

    res.json(program);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create program
router.post('/', async (req, res) => {
  try {
    const { name, weeks, deload_weeks } = req.body;

    const program = await Program.create({
      name,
      weeks,
      deload_weeks
    });

    res.status(201).json(program);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
