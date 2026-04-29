'use strict';
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Program, ProgramDay, ExerciseInstance } = require('../models');
const protect = require('../middleware/protect');
const requireRole = require('../middleware/requireRole');

router.get('/', protect, async (req, res) => {
  try {
    const { id: userId, role, coach_id } = req.user;
    let where;

    if (role === 'client') {
      where = { user_id: coach_id };
    } else {
      where = {
        [Op.or]: [
          { user_id: userId },
          { user_id: null }
        ]
      };
    }

    const programs = await Program.findAll({ where });
    res.json(programs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

router.post('/', protect, requireRole('admin', 'self-serve'), async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { name, weeks, deload_weeks } = req.body;
    const program = await Program.create({ name, weeks, deload_weeks, user_id: userId });
    res.status(201).json(program);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', protect, requireRole('admin', 'self-serve'), async (req, res) => {
  try {
    const program = await Program.findByPk(req.params.id);
    if (!program) return res.status(404).json({ error: 'Program not found' });

    await program.update(req.body);
    res.json(program);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', protect, requireRole('admin', 'self-serve'), async (req, res) => {
  try {
    const program = await Program.findByPk(req.params.id);
    if (!program) return res.status(404).json({ error: 'Program not found' });
    await program.destroy();
    res.json({ message: 'Program deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
