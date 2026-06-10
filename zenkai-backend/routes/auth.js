'use strict';
const express = require('express');
const router = express.Router();
const { signup, login, googleAuth } = require('../controllers/authController');
const protect = require('../middleware/protect');
const { User } = require('../models');

router.post('/signup', signup);
router.post('/login', login);
router.post('/google', googleAuth);

router.patch('/me', protect, async (req, res) => {
  const { firstName } = req.body;
  if (!firstName || !firstName.trim()) {
    return res.status(400).json({ error: 'firstName is required' });
  }
  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await user.update({ first_name: firstName.trim() });
  res.json({ firstName: user.first_name });
});

module.exports = router;
