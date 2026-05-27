'use strict';
const express = require('express');
const router = express.Router();
const { Client, User, Program, ClientProgram, ExerciseProgression, ExerciseSessionNote, sequelize } = require('../models');
const protect = require('../middleware/protect');
const requireRole = require('../middleware/requireRole');
const { getOwnedClient } = require('../middleware/ownership');

router.get('/me', protect, async (req, res) => {
  try {
    let client = await Client.findOne({ where: { user_id: req.user.id } });
    if (!client && (req.user.role === 'self-serve' || req.user.role === 'client')) {
      const local = req.user.email.split('@')[0];
      client = await Client.create({ name: local.charAt(0).toUpperCase() + local.slice(1), user_id: req.user.id });
    }
    if (!client) return res.status(404).json({ error: 'No linked client record' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    const where = req.user.role === 'client'
      ? { user_id: req.user.id }
      : { coach_id: req.user.id };
    const clients = await Client.findAll({ where });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/unassigned', protect, requireRole('admin'), async (req, res) => {
  try {
    const clients = await Client.findAll({ where: { coach_id: null } });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin client-management list: name + linked login (email/role) + active program.
// Dedicated endpoint so the shared GET / payload stays untouched.
// NOTE: must be declared before GET /:id or "manage" matches the :id param.
router.get('/manage', protect, requireRole('admin'), async (req, res) => {
  try {
    const clients = await Client.findAll({
      where: { coach_id: req.user.id },
      include: [
        { model: User, as: 'ClientUser', attributes: ['id', 'email', 'role'] },
        { model: ClientProgram, required: false, where: { active: true },
          include: [{ model: Program, attributes: ['id', 'name', 'weeks'] }] }
      ],
      order: [['name', 'ASC']]
    });

    res.json(clients.map((c) => {
      const j = c.toJSON();
      const active = (j.ClientPrograms || [])[0];
      return {
        id: j.id,
        name: j.name,
        user_id: j.user_id,
        email: j.ClientUser?.email || null,
        role: j.ClientUser?.role || null,
        activeProgram: active?.Program
          ? { id: active.Program.id, name: active.Program.name, weeks: active.Program.weeks }
          : null
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/claim', protect, requireRole('admin'), async (req, res) => {
  try {
    const client = await Client.findByPk(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (client.coach_id !== null) return res.status(409).json({ error: 'Client already has a coach' });
    await client.update({ coach_id: req.user.id });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const client = await getOwnedClient(req, req.params.id);
    if (!client) return res.status(403).json({ error: 'Forbidden' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { name } = req.body;
    const client = await Client.create({ name, coach_id: req.user.id });
    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', protect, requireRole('admin'), async (req, res) => {
  try {
    const client = await getOwnedClient(req, req.params.id);
    if (!client) return res.status(403).json({ error: 'Forbidden' });
    await client.update(req.body);
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', protect, requireRole('admin'), async (req, res) => {
  try {
    const client = await getOwnedClient(req, req.params.id);
    if (!client) return res.status(403).json({ error: 'Forbidden' });
    await client.destroy();
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete "Delete User": removes the client, its associated data, and the
// linked login account — atomically. CASCADE handles client_programs →
// client_exercise_targets and logged_sets; exercise_progressions and
// exercise_session_notes have no FK, so we delete them explicitly. Owned
// programs are deliberately preserved (FK SET NULL) — they may be assigned
// to other clients.
router.delete('/:id/full', protect, requireRole('admin'), async (req, res) => {
  try {
    const client = await getOwnedClient(req, req.params.id);
    if (!client) return res.status(403).json({ error: 'Forbidden' });

    const userId = client.user_id;
    if (userId && userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account.' });
    }

    await sequelize.transaction(async (t) => {
      await ExerciseProgression.destroy({ where: { client_id: client.id }, transaction: t });
      await ExerciseSessionNote.destroy({ where: { client_id: client.id }, transaction: t });
      await client.destroy({ transaction: t });
      if (userId) {
        await User.destroy({ where: { id: userId }, transaction: t });
      }
    });

    res.json({ deleted: true, user_deleted: !!userId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
