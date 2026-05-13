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
