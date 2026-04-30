'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Client } = require('../models');

const sign = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, coach_id: user.coach_id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

exports.signup = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }
    if (!role || !['client', 'self-serve'].includes(role)) {
      return res.status(400).json({ error: 'role must be client or self-serve' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hash, role, coach_id: null });
    if (role === 'client' || role === 'self-serve') {
      await Client.create({ name: email, user_id: user.id });
    }
    res.status(201).json({
      token: sign(user),
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({
      token: sign(user),
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
