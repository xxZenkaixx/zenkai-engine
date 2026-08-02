'use strict';
const express = require('express');
const router = express.Router();
const { ClientProgram, Program, ProgramDay, ExerciseInstance, ClientExerciseTarget, ProgressionRule } = require('../models');
const protect = require('../middleware/protect');
const { getOwnedClient } = require('../middleware/ownership');
const {
  recordDayCompletion,
  getWeekStatus
} = require('../services/weekProgressionService');
const { getWeeklyPrescriptions } = require('../services/periodizationService');

router.get('/:clientId', protect, async (req, res) => {
  try {
    // FIX: prevent browser / CDN / proxy heuristic caching of the active-program
    // payload. Without this, Safari/iOS especially can return a Week-1 snapshot
    // on Week-2's first fetch, making it look like progression never persisted.
    // The endpoint is per-client and small — re-fetching every time is correct.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');

    if (!await getOwnedClient(req, req.params.clientId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const clientProgram = await ClientProgram.findOne({
      where: { client_id: req.params.clientId, active: true },
      include: [
        {
          model: Program,
          attributes: ['id', 'name', 'weeks'],
          include: [
            {
              model: ProgramDay,
              as: 'ProgramDays',
              attributes: ['id', 'program_id', 'name', 'day_number'],
              include: [
                {
                  model: ExerciseInstance,
                  as: 'ExerciseInstances',
                  attributes: [
                    'id', 'program_day_id', 'name', 'type', 'equipment_type',
                    'progression_mode', 'progression_value', 'target_sets',
                    'target_reps', 'target_weight', 'rest_seconds', 'order_index',
                    'notes', 'base_stack_weight', 'stack_step_value',
                    'micro_step_value', 'max_micro_levels', 'current_micro_level',
                    'cable_unit', 'cable_setup_locked', 'backoff_enabled',
                    'backoff_percent', 'micro_type', 'micro_display_label', 'video_url',
                    'superset_group_id', 'superset_order', 'periodization_role'
                  ]
                }
              ]
            }
          ]
        }
      ],
      order: [
        [{ model: Program }, { model: ProgramDay, as: 'ProgramDays' }, { model: ExerciseInstance, as: 'ExerciseInstances' }, 'order_index', 'ASC']
      ]
    });
    if (!clientProgram) return res.status(404).json({ error: 'No active program found' });

    const clientTargets = await ClientExerciseTarget.findAll({
      where: { client_program_id: clientProgram.id },
      attributes: ['exercise_instance_id', 'target_reps', 'target_weight', 'cable_state']
    });

    const repsOverrideMap = clientTargets.reduce((acc, t) => {
      if (t.target_reps != null) acc[t.exercise_instance_id] = t.target_reps;
      return acc;
    }, {});

    const weightOverrideMap = clientTargets.reduce((acc, t) => {
      if (t.target_weight != null) acc[t.exercise_instance_id] = parseFloat(t.target_weight);
      return acc;
    }, {});

    const cableOverrideMap = clientTargets.reduce((acc, t) => {
      if (t.cable_state != null) acc[t.exercise_instance_id] = t.cable_state;
      return acc;
    }, {});

    console.log('[CP GET] weightOverrideMap:', JSON.stringify(weightOverrideMap));
    console.log('[CP GET] repsOverrideMap:', JSON.stringify(repsOverrideMap));
    console.log('[CP GET] cableOverrideMap:', JSON.stringify(cableOverrideMap));

    const result = clientProgram.toJSON();

    const progressionRules = await ProgressionRule.findAll({
      attributes: ['type', 'decrease_percent', 'increase_percent']
    });

    const decreaseMap = progressionRules.reduce((acc, r) => {
      acc[r.type] = r.decrease_percent;
      return acc;
    }, {});

    const increaseMap = progressionRules.reduce((acc, r) => {
      acc[r.type] = r.increase_percent;
      return acc;
    }, {});

    for (const day of result.Program?.ProgramDays || []) {
      for (const ex of day.ExerciseInstances || []) {
        // FIX: use `!= null` to match the weight + cable override checks below.
        // Previous truthy check silently dropped any falsy-but-defined value
        // (empty string, "0", etc.). Symmetric checks here remove a class of
        // "override silently doesn't apply" bugs.
        if (repsOverrideMap[ex.id] != null) ex.target_reps = repsOverrideMap[ex.id];
        if (weightOverrideMap[ex.id] != null) ex.target_weight = weightOverrideMap[ex.id];

        if (cableOverrideMap[ex.id] != null) {
          ex.base_stack_weight = cableOverrideMap[ex.id].base_stack_weight;
          ex.current_micro_level = cableOverrideMap[ex.id].current_micro_level;
        }

        if (decreaseMap[ex.type] != null) ex.decrease_percent = decreaseMap[ex.type];
        if (increaseMap[ex.type] != null) ex.increase_percent = increaseMap[ex.type];
      }
    }

    // ---- Layer 3: periodization ------------------------------------------
    // Applied AFTER the client_exercise_targets overlay, so a periodized
    // prescription outranks a progressed one. Returns nothing at all when the
    // program has no schedule rows, which makes every non-periodized program
    // byte-identical to before.
    //
    // Wrapped: this endpoint is the single point of failure for the client app
    // — if periodization throws on bad data, the client must still get their
    // workout, just without the weekly overlay.
    const allExercises = (result.Program?.ProgramDays || [])
      .flatMap((d) => d.ExerciseInstances || []);

    try {
      const { byExerciseId, summary } = await getWeeklyPrescriptions(
        clientProgram,
        allExercises
      );

      for (const ex of allExercises) {
        const prescription = byExerciseId[ex.id];
        if (!prescription?.applied) continue;
        // `overrides` holds only the keys meant to replace template values, so
        // this can never write undefined over a real one.
        Object.assign(ex, prescription.overrides);
        ex.periodization = prescription.diagnostic;
      }

      if (summary.applied > 0 || Object.keys(summary.skipped).length > 0) {
        console.log('[PERIODIZATION] summary:', JSON.stringify(summary));
      }
    } catch (periodizationErr) {
      console.error(
        '[PERIODIZATION] failed — serving un-periodized targets:',
        periodizationErr.message
      );
    }

    // Verify superset fields make it onto the response payload.
    console.log('[CP GET] superset fields per exercise:',
      (result.Program?.ProgramDays || []).flatMap(d =>
        (d.ExerciseInstances || []).map(ex => ({
          id: ex.id,
          name: ex.name,
          group: ex.superset_group_id ?? null,
          order: ex.superset_order ?? null,
        }))
      )
    );

    // TEMP DEBUG: dump the exact next-session targets being shipped to the client so
    // we can compare against [PROG]/[PROG-DBG] writes from the prior session.
    console.log('[CP GET FINAL] next-session targets:',
      (result.Program?.ProgramDays || []).flatMap(d =>
        (d.ExerciseInstances || []).map(ex => ({
          name: ex.name,
          target_reps: ex.target_reps,
          target_weight: ex.target_weight,
          cable: ex.base_stack_weight ? { base: ex.base_stack_weight, micro: ex.current_micro_level } : null
        }))
      )
    );

    res.json(result);
  } catch (err) {
    console.error('GET /client-programs/:clientId ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:clientId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    if (!await getOwnedClient(req, req.params.clientId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await ClientProgram.update(
      { active: false },
      { where: { client_id: req.params.clientId, active: true } }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'self-serve') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { client_id, program_id, start_date } = req.body;

    if (!await getOwnedClient(req, client_id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const existing = await ClientProgram.findOne({ where: { client_id, program_id } });
    if (existing && existing.active) return res.status(200).json(existing);

    try {
      await ClientProgram.update({ active: false }, { where: { client_id, active: true } });

      if (existing) {
        await existing.update({ active: true, start_date });
        return res.status(200).json(existing);
      }

      const assignment = await ClientProgram.create({
        client_id,
        program_id,
        start_date,
        active: true
      });

      res.status(201).json(assignment);
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: 'Another program was just activated for this client. Refresh and try again.' });
      }
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/activate', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const target = await ClientProgram.findByPk(req.params.id);
    if (!target) return res.status(404).json({ error: 'Assignment not found' });

    if (!await getOwnedClient(req, target.client_id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      await ClientProgram.update(
        { active: false },
        { where: { client_id: target.client_id, active: true } }
      );
      await target.update({ active: true });
      res.json(target);
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: 'Another program was just activated for this client. Refresh and try again.' });
      }
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:clientId/history', protect, async (req, res) => {
  try {
    if (!await getOwnedClient(req, req.params.clientId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const assignments = await ClientProgram.findAll({
      where: { client_id: req.params.clientId },
      include: { model: Program, attributes: ['id', 'name', 'weeks'] },
      order: [['created_at', 'DESC']]
    });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record that the client finished a program day, advancing their week if every
// day of the current week is now complete.
//
// Deliberately NOT folded into POST /api/progression/apply. That endpoint is
// also called on workout LOAD (the progression preload in ClientWorkoutView),
// so recording completion there would mark days complete merely for opening
// the app.
//
// Not gated by requireRole: the client finishing their own workout is the
// primary caller. getOwnedClient scopes it — admins bypass, self-serve and
// client are limited to their own record.
router.post('/:clientId/complete-day', protect, async (req, res) => {
  try {
    if (!await getOwnedClient(req, req.params.clientId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { programDayId, sessionId } = req.body;
    if (!programDayId) {
      return res.status(400).json({ error: 'programDayId is required.' });
    }

    const result = await recordDayCompletion(
      req.params.clientId,
      programDayId,
      sessionId || null
    );

    console.log('[WEEK] complete-day', JSON.stringify(result));

    // 200 on a repeat, 201 on a genuinely new completion. A repeat is a
    // no-op, not a failure — the client may legitimately redo a day.
    res.status(result.already_recorded ? 200 : 201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('POST /client-programs/:clientId/complete-day ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:clientId/week-status', protect, async (req, res) => {
  try {
    // Same no-store reasoning as GET /:clientId — this value changes as the
    // client trains and must never come from a Safari/CDN cache.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');

    if (!await getOwnedClient(req, req.params.clientId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const status = await getWeekStatus(req.params.clientId);
    if (!status) return res.status(404).json({ error: 'No active program found' });

    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
