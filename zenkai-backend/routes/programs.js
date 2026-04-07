// * Handles program creation, retrieval, updating, and deletion.
'use strict';

const express = require('express');
const router = express.Router();
const { Program, ProgramDay, ExerciseInstance } = require('../models');

// * GET all programs
router.get('/', async (req, res) => {
  try {
    const programs = await Program.findAll();
    res.json(programs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * GET one program with nested days + exercises
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

    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }

    res.json(program);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * POST create program
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

// * PUT update program
router.put('/:id', async (req, res) => {
  try {
    const program = await Program.findByPk(req.params.id);

    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }

    await program.update(req.body);
    res.json(program);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * DELETE program
router.delete('/:id', async (req, res) => {
  try {
    const program = await Program.findByPk(req.params.id);

    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }

    await program.destroy();
    res.json({ message: 'Program deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
