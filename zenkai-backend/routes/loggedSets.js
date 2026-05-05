// zenkai-backend/routes/loggedSets.js
'use strict';

const express = require('express');
const router = express.Router();
const { LoggedSet, ExerciseInstance, ExerciseSessionNote, sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

router.get('/', async (req, res) => {
  try {
    const { exercise_instance_id, client_id } = req.query;
    const where = {};
    if (exercise_instance_id) where.exercise_instance_id = exercise_instance_id;
    if (client_id) where.client_id = client_id;

    const loggedSets = await LoggedSet.findAll({
      where,
      order: [['set_number', 'ASC']]
    });

    res.json(loggedSets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { id, exercise_instance_id, client_id, set_number, completed_reps, completed_weight, session_id } = req.body;

    if (id) {
      const existing = await LoggedSet.findOne({
        where: { idempotency_key: id }
      });
      if (existing) return res.json(existing);
    }

    const instance = await ExerciseInstance.findByPk(exercise_instance_id);
    if (!instance) {
      console.error('POST /loggedSets ERROR: instance not found', { exercise_instance_id });
      return res.status(404).json({ error: 'Exercise instance not found' });
    }

    let resolvedWeight = null;

    if (completed_weight != null) {
      resolvedWeight = parseFloat(completed_weight);
    } else if (instance.equipment_type === 'cable') {
      resolvedWeight =
        instance.base_stack_weight +
        instance.current_micro_level * instance.micro_step_value;
    } else if (instance.type === 'bodyweight') {
      resolvedWeight = null;
    } else {
      if (instance.target_weight == null) {
        console.error('POST /loggedSets BLOCKED: missing target_weight', { exercise_instance_id });
        return res.status(400).json({
          error: 'Missing target_weight on exercise instance'
        });
      }
      resolvedWeight = instance.target_weight;
    }

    const loggedSet = await LoggedSet.create({
      exercise_instance_id,
      client_id,
      set_number,
      completed_reps,
      completed_weight: resolvedWeight,
      idempotency_key: id || null,
      session_id: session_id || null
    });

    console.log('POST /loggedSets SUCCESS:', {
      exercise_instance_id,
      completed_reps,
      completed_weight,
      session_id
    });

    res.status(201).json(loggedSet);
  } catch (err) {
    console.error('POST /loggedSets ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/note', async (req, res) => {
  try {
    const { exercise_instance_id, client_id, date, program_day_id, exercise_note } = req.body;
    console.log('[PUT /note] body:', req.body);
    if (!exercise_instance_id || !client_id || !date || !program_day_id) {
      return res.status(400).json({
        error: 'exercise_instance_id, client_id, date, and program_day_id are required'
      });
    }
    const rows = await sequelize.query(
      `INSERT INTO exercise_session_notes
         (id, client_id, exercise_instance_id, program_day_id, session_date, note, created_at, updated_at)
       VALUES
         (gen_random_uuid(), :clientId, :eiId, :programDayId, :sessionDate, :note, NOW(), NOW())
       ON CONFLICT (client_id, exercise_instance_id, program_day_id, session_date)
       DO UPDATE SET note = EXCLUDED.note, updated_at = NOW()
       RETURNING note`,
      {
        replacements: {
          clientId: client_id,
          eiId: exercise_instance_id,
          programDayId: program_day_id,
          sessionDate: date,
          note: exercise_note || null
        },
        type: QueryTypes.SELECT
      }
    );
    console.log('[PUT /note] upserted note');
    res.json({ ok: true, note: rows[0]?.note || null });
  } catch (err) {
    console.error('[PUT /note] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const loggedSet = await LoggedSet.findByPk(req.params.id);

    if (!loggedSet) {
      return res.status(404).json({ error: 'Set not found' });
    }

    const { completed_reps, completed_weight } = req.body;

    const updateFields = { completed_reps };

    if (completed_weight !== undefined) {
      updateFields.completed_weight = completed_weight;
    }

    await loggedSet.update(updateFields);

    res.json(loggedSet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const loggedSet = await LoggedSet.findByPk(req.params.id);

    if (!loggedSet) {
      return res.status(404).json({ error: 'Set not found' });
    }

    await loggedSet.destroy();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/note', async (req, res) => {
  try {
    const { exerciseInstanceId, clientId, programDayId, sessionDate } = req.query;
    if (!exerciseInstanceId || !clientId || !programDayId || !sessionDate) {
      return res.status(400).json({ error: 'exerciseInstanceId, clientId, programDayId, and sessionDate are required' });
    }
    const rows = await sequelize.query(
      `SELECT note, session_date FROM exercise_session_notes
       WHERE exercise_instance_id = :eiId
         AND client_id = :clientId
         AND program_day_id = :programDayId
         AND session_date = :sessionDate`,
      {
        replacements: { eiId: exerciseInstanceId, clientId, programDayId, sessionDate },
        type: QueryTypes.SELECT
      }
    );
    res.json({
      note: rows.length > 0 ? rows[0].note : null,
      session_date: rows.length > 0 ? rows[0].session_date : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/last-note', async (req, res) => {
  try {
    const { exerciseInstanceId, clientId, programDayId, sessionDate } = req.query;
    console.log('[GET /last-note] received:', { exerciseInstanceId, clientId, programDayId, sessionDate });
    if (!exerciseInstanceId || !clientId || !programDayId || !sessionDate) {
      return res.status(400).json({ error: 'exerciseInstanceId, clientId, programDayId, and sessionDate are required' });
    }
    const rows = await sequelize.query(
      `SELECT note, session_date FROM exercise_session_notes
       WHERE exercise_instance_id = :eiId
         AND client_id = :clientId
         AND program_day_id = :programDayId
         AND session_date < :sessionDate
         AND note IS NOT NULL
         AND note != ''
       ORDER BY session_date DESC
       LIMIT 1`,
      {
        replacements: { eiId: exerciseInstanceId, clientId, programDayId, sessionDate },
        type: QueryTypes.SELECT
      }
    );
    console.log('[GET /last-note] rows:', rows);
    res.json({
      note: rows.length > 0 ? rows[0].note : null,
      session_date: rows.length > 0 ? rows[0].session_date : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
