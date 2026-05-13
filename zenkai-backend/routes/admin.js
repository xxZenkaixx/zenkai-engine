'use strict';

const express     = require('express');
const router      = express.Router();
const { Op, QueryTypes } = require('sequelize');
const protect     = require('../middleware/protect');
const requireRole = require('../middleware/requireRole');
const cloudinary  = require('../services/cloudinary');
const { Exercise, sequelize } = require('../models');

router.use(protect);
router.use(requireRole('admin', 'trainer'));

router.get('/videos/sign-upload', (req, res) => {
  try {
    const timestamp = Math.round(Date.now() / 1000);
    const folder    = 'zenkai/exercises';

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      signature,
      timestamp,
      folder,
      api_key:    process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (err) {
    console.error('Signature error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/exercises', async (req, res) => {
  try {
    const { search, equipment_type, type, body_part } = req.query;

    const where = {};
    if (equipment_type) where.equipment_type = equipment_type;
    if (type)           where.type           = type;
    if (body_part)      where.body_part      = body_part;
    if (search)         where.name           = { [Op.iLike]: `%${search}%` };

    const exercises = await Exercise.findAll({
      where,
      order: [['name', 'ASC']],
    });

    const counts = await sequelize.query(
      `SELECT ei.exercise_id, COUNT(DISTINCT cp.program_id)::int AS program_count
       FROM exercise_instances ei
       JOIN program_days pd ON pd.id = ei.program_day_id
       JOIN client_programs cp ON cp.program_id = pd.program_id
       WHERE ei.exercise_id IS NOT NULL
       GROUP BY ei.exercise_id`,
      { type: QueryTypes.SELECT }
    );

    const countMap = new Map(
      counts.map(r => [r.exercise_id, Number(r.program_count) || 0])
    );

    res.json(exercises.map(e => {
      const json = e.toJSON();
      return { ...json, program_count: countMap.get(json.id) || 0 };
    }));
  } catch (err) {
    console.error('Exercise library fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/exercises/seed-custom', async (req, res) => {
  const VALID_TYPES = new Set(['compound', 'accessory', 'custom']);

  try {
    const rows = await sequelize.query(
      `SELECT DISTINCT ON (LOWER(ei.name))
              ei.name, ei.type, ei.equipment_type, ei.body_part,
              ei.video_url, ei.notes, ei.target_sets, ei.target_reps
       FROM exercise_instances ei
       JOIN program_days pd ON pd.id = ei.program_day_id
       JOIN programs p      ON p.id  = pd.program_id
       WHERE p.user_id = :userId
         AND ei.exercise_id IS NULL
       ORDER BY LOWER(ei.name), ei.created_at DESC`,
      { replacements: { userId: req.user.id }, type: QueryTypes.SELECT }
    );

    if (rows.length === 0) return res.json({ count: 0 });

    let count = 0;
    for (const row of rows) {
      try {
        const safeType = VALID_TYPES.has(row.type) ? row.type : 'accessory';

        const upserted = await sequelize.query(
          `INSERT INTO exercises (id, name, type, equipment_type, body_part, video_url, notes,
                                  default_target_sets, default_target_reps, created_by,
                                  created_at, updated_at)
           VALUES (gen_random_uuid(), :name, :type, :equipmentType, :bodyPart, :videoUrl, :notes,
                   :targetSets, :targetReps, :userId, NOW(), NOW())
           ON CONFLICT (name) DO UPDATE SET
             video_url           = EXCLUDED.video_url,
             notes               = EXCLUDED.notes,
             body_part           = EXCLUDED.body_part,
             default_target_sets = EXCLUDED.default_target_sets,
             default_target_reps = EXCLUDED.default_target_reps,
             updated_at          = NOW()
           RETURNING id`,
          {
            replacements: {
              name:          row.name,
              type:          safeType,
              equipmentType: row.equipment_type,
              bodyPart:      row.body_part   ?? null,
              videoUrl:      row.video_url   ?? null,
              notes:         row.notes       ?? null,
              targetSets:    row.target_sets ?? null,
              targetReps:    row.target_reps ?? null,
              userId:        req.user.id,
            },
            type: QueryTypes.SELECT,
          }
        );

        const libId = upserted[0]?.id;
        if (libId) {
          await sequelize.query(
            `UPDATE exercise_instances
             SET exercise_id = :libId
             FROM program_days, programs
             WHERE exercise_instances.program_day_id = program_days.id
               AND program_days.program_id = programs.id
               AND programs.user_id = :userId
               AND LOWER(exercise_instances.name) = LOWER(:name)
               AND exercise_instances.exercise_id IS NULL`,
            { replacements: { libId, userId: req.user.id, name: row.name }, type: QueryTypes.UPDATE }
          );
          count++;
        }
      } catch (rowErr) {
        console.error(`Seed failed for exercise "${row.name}":`, rowErr.message);
      }
    }

    res.json({ count });
  } catch (err) {
    console.error('Seed custom exercises error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/exercises/:id', async (req, res) => {
  try {
    const ex = await Exercise.findByPk(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Exercise not found' });
    await ex.destroy();
    res.json({ deleted: true });
  } catch (err) {
    console.error('Exercise delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
