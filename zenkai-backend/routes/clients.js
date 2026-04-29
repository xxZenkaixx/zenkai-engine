'use strict';
const express = require('express');
const router = express.Router();
const { Client } = require('../models');
const protect = require('../middleware/protect');
const requireRole = require('../middleware/requireRole');

router.get('/me', protect, async (req, res) => {
  try {
    const client = await Client.findOne({ where: { user_id: req.user.id } });
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
    const client = await Client.findByPk(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
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
    const client = await Client.findByPk(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    await client.update(req.body);
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', protect, requireRole('admin'), async (req, res) => {
  try {
    const client = await Client.findByPk(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    await client.destroy();
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
