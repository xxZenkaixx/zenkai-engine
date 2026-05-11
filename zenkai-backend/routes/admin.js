'use strict';

const express     = require('express');
const router      = express.Router();
const { Op }      = require('sequelize');
const protect     = require('../middleware/protect');
const requireRole = require('../middleware/requireRole');
const cloudinary  = require('../services/cloudinary');
const { Exercise } = require('../models');

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

    res.json(exercises);
  } catch (err) {
    console.error('Exercise library fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
