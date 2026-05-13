// *Handles program day CRUD. Uses ProgramDay, ExerciseInstance models.
// *Days are repeating weekly templates — not tied to a specific week number.
'use strict';
const express = require('express');
const router = express.Router();
const { ProgramDay, ExerciseInstance } = require('../models');
const protect = require('../middleware/protect');
const requireRole = require('../middleware/requireRole');
const { getOwnedProgram, getOwnedProgramViaDay } = require('../middleware/ownership');

// *Returns all days for a program with exercises nested — used in program builder
router.get('/program/:programId', protect, async (req, res) => {
  try {
    const program = await getOwnedProgram(req, req.params.programId, 'read');
    if (!program) return res.status(403).json({ error: 'Forbidden' });
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
router.post('/', protect, requireRole('admin', 'self-serve'), async (req, res) => {
  try {
    const { program_id, day_number, name } = req.body;
    const program = await getOwnedProgram(req, program_id, 'write');
    if (!program) return res.status(403).json({ error: 'Forbidden' });
    const day = await ProgramDay.create({ program_id, day_number, name });
    res.status(201).json(day);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// *Updates day_number and/or name for an existing day
router.put('/:id', protect, requireRole('admin', 'self-serve'), async (req, res) => {
  try {
    const chain = await getOwnedProgramViaDay(req, req.params.id, 'write');
    if (!chain) return res.status(403).json({ error: 'Forbidden' });
    await chain.day.update(req.body);
    res.json(chain.day);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// * Cascades — deletes all exercise instances under this day
router.delete('/:id', protect, requireRole('admin', 'self-serve'), async (req, res) => {
  try {
    const chain = await getOwnedProgramViaDay(req, req.params.id, 'write');
    if (!chain) return res.status(403).json({ error: 'Forbidden' });
    await chain.day.destroy();
    res.json({ message: 'Day deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
