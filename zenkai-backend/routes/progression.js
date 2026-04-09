// Progression routes.
// * POST /api/progression/apply — triggers post-workout progression evaluation.
// * Does NOT modify logged_sets or program structure.
'use strict';

const express = require('express');
const router = express.Router();
const { applyProgressionForWorkout } = require('../services/progressionApplicationService');

// * Apply progression after a completed workout session
router.post('/apply', async (req, res) => {
  const { clientId, programDayId } = req.body;

  // ! Both fields are required
  if (!clientId || !programDayId) {
    return res.status(400).json({ error: 'clientId and programDayId are required.' });
  }

  try {
    const results = await applyProgressionForWorkout(clientId, programDayId);
    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
