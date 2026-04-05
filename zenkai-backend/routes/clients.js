// Handles client creation and retrieval. Uses Client model.
'use strict';

const express = require('express');
const router = express.Router();
const { Client } = require('../models');

// Returns all clients
router.get('/', async (req, res) => {
  try {
    const clients = await Client.findAll();
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Returns one client by id
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findByPk(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Creates a client. Expects { name }
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const client = await Client.create({ name });
    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
