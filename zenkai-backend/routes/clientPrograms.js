// Handles assigning programs to clients and loading a client's active program.
'use strict';

const express = require('express');
const router = express.Router();
const { ClientProgram, Program, ProgramDay, ExerciseInstance } = require('../models');

// Returns the active client-program assignment with nested program data
router.get('/:clientId', async (req, res) => {
  try {
    const clientProgram = await ClientProgram.findOne({
      where: { client_id: req.params.clientId, active: true },
      include: {
        model: Program,
        include: {
          model: ProgramDay,
          include: {
            model: ExerciseInstance,
            order: [['order_index', 'ASC']]
          }
        }
      }
    });

    if (!clientProgram) {
      return res.status(404).json({ error: 'No active program found' });
    }

    res.json(clientProgram);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Creates a client-program assignment and marks it active
router.post('/', async (req, res) => {
  try {
    const { client_id, program_id, start_date } = req.body;

    const assignment = await ClientProgram.create({
      client_id,
      program_id,
      start_date,
      active: true
    });

    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
