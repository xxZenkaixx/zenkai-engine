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

    // FIX: ratchet rows (next_weight set on a no_change outcome) used to be
    // stranded here — the gate only looked at the outcome label, so a session
    // where every exercise landed in-range (no_change for all) would skip
    // mutateTargets entirely and leave client_exercise_targets untouched.
    // Now we open the gate whenever any result actually has a writable
    // next-* field, regardless of the outcome label. Increase/decrease still
    // count by virtue of producing a non-null next_weight / next_cable_state.
    const hasApplicableChanges = progressionResults.some(
      (result) =>
        result.outcome === 'increase' ||
        result.outcome === 'decrease' ||
        result.next_weight != null ||
        result.next_cable_state != null ||
        result.next_target_reps != null
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
