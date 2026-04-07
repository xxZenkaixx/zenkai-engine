// *Handles program day CRUD. Uses ProgramDay, ExerciseInstance models.
// *Days are repeating weekly templates — not tied to a specific week number.
'use strict';
const express = require('express');
const router = express.Router();
const { ProgramDay, ExerciseInstance } = require('../models');

// *Returns all days for a program with exercises nested — used in program builder
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

// *Creates a day on a program. Expects { program_id, day_number, name }
router.post('/', async (req, res) => {
  try {
    const { program_id, day_number, name } = req.body;
    const day = await ProgramDay.create({ program_id, day_number, name });
    res.status(201).json(day);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// *Updates day_number and/or name for an existing day
router.put('/:id', async (req, res) => {
  try {
    const day = await ProgramDay.findByPk(req.params.id);
    if (!day) return res.status(404).json({ error: 'Day not found' });
    await day.update(req.body);
    res.json(day);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * Cascades — deletes all exercise instances under this day
router.delete('/:id', async (req, res) => {
  try {
    const day = await ProgramDay.findByPk(req.params.id);
    if (!day) return res.status(404).json({ error: 'Day not found' });
    await day.destroy();
    res.json({ message: 'Day deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
