// Progression routes.
// * POST /api/progression/apply — triggers post-workout progression evaluation.
// * Does NOT modify logged_sets or program structure.
'use strict';

const express = require('express');
const router = express.Router();
const {
  applyProgressionForWorkout,
  mutateTargetsFromProgressions
} = require('../services/progressionApplicationService');

// * Apply progression after a completed workout session
router.post('/apply', async (req, res) => {
  const { clientId, programDayId } = req.body;

  // ! Both fields are required
  if (!clientId || !programDayId) {
    return res.status(400).json({ error: 'clientId and programDayId are required.' });
  }

  try {
    const progressionResults = await applyProgressionForWorkout(clientId, programDayId);

    const hasApplicableChanges = progressionResults.some(
      (result) => result.outcome === 'increase' || result.outcome === 'decrease'
    );

    console.log('[PROG ROUTE] progressionResults:', JSON.stringify(progressionResults, null, 2));
    console.log('[PROG ROUTE] hasApplicableChanges:', hasApplicableChanges);

    const mutationResults = hasApplicableChanges
      ? await mutateTargetsFromProgressions(clientId, programDayId)
      : [];

    console.log('[PROG ROUTE] mutationResults:', JSON.stringify(mutationResults, null, 2));

    return res.status(200).json({ progressionResults, mutationResults });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
