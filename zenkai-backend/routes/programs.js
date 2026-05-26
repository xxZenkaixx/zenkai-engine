'use strict';
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Program, ProgramDay, ExerciseInstance, sequelize } = require('../models');
const protect = require('../middleware/protect');
const requireRole = require('../middleware/requireRole');
const { getOwnedProgram } = require('../middleware/ownership');

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
          { is_template: true }
        ]
      };
    }

    const programs = await Program.findAll({ where });
    res.json(programs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const owned = await getOwnedProgram(req, req.params.id, 'read');
    if (!owned) return res.status(403).json({ error: 'Forbidden' });
    const program = await Program.findByPk(req.params.id, {
      include: {
        model: ProgramDay,
        include: {
          model: ExerciseInstance,
          order: [['order_index', 'ASC']]
        }
      }
    });
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
    const program = await getOwnedProgram(req, req.params.id, 'write');
    if (!program) return res.status(403).json({ error: 'Forbidden' });

    // is_template is admin-only — silently drop it from non-admin bodies so a
    // self-serve user can't flip their own program into a template and have it
    // shown to every other self-serve user.
    const { is_template, ...rest } = req.body;
    const payload = req.user.role === 'admin' && is_template !== undefined
      ? { ...rest, is_template: !!is_template }
      : rest;

    await program.update(payload);
    res.json(program);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clone a program (deep copy: program → days → exercise instances).
// Source must be readable by the caller (admin: anything; self-serve: templates
// or own; client: templates or coach's). The new program is always owned by
// the caller with is_template = false. Wrapped in a transaction so a partial
// failure can't leave orphaned days/exercises.
router.post('/:id/clone', protect, async (req, res) => {
  try {
    const source = await getOwnedProgram(req, req.params.id, 'read');
    if (!source) return res.status(403).json({ error: 'Forbidden' });

    const sourceFull = await Program.findByPk(req.params.id, {
      include: {
        model: ProgramDay,
        include: { model: ExerciseInstance }
      }
    });

    const newProgram = await sequelize.transaction(async (t) => {
      const cloneName = (req.body?.name || `${sourceFull.name} (Copy)`).trim();
      const program = await Program.create({
        name: cloneName,
        weeks: sourceFull.weeks,
        deload_weeks: sourceFull.deload_weeks || [],
        user_id: req.user.id,
        is_template: false
      }, { transaction: t });

      for (const day of sourceFull.ProgramDays || []) {
        const newDay = await ProgramDay.create({
          program_id: program.id,
          day_number: day.day_number,
          name: day.name
        }, { transaction: t });

        const exercises = (day.ExerciseInstances || [])
          .sort((a, b) => a.order_index - b.order_index);
        for (const ex of exercises) {
          // Whitelist of safe-to-copy fields. We intentionally drop id, ts,
          // and program_day_id — they're re-derived. Everything else is a
          // snapshot of the template's prescription.
          const { id, program_day_id, createdAt, updatedAt, created_at, updated_at, ...exFields } = ex.toJSON();
          await ExerciseInstance.create({
            ...exFields,
            program_day_id: newDay.id
          }, { transaction: t });
        }
      }

      return program;
    });

    res.status(201).json(newProgram);
  } catch (err) {
    console.error('POST /programs/:id/clone failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', protect, requireRole('admin', 'self-serve'), async (req, res) => {
  try {
    const program = await getOwnedProgram(req, req.params.id, 'write');
    if (!program) return res.status(403).json({ error: 'Forbidden' });
    await program.destroy();
    res.json({ message: 'Program deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
