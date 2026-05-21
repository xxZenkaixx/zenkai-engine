'use strict';
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { User, Client } = require('../models');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const sign = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, coach_id: user.coach_id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

exports.signup = async (req, res) => {
  try {
    const { email, password, role, firstName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }
    if (!role || !['client', 'self-serve'].includes(role)) {
      return res.status(400).json({ error: 'role must be client or self-serve' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hash, role, coach_id: null, first_name: firstName || null });
    if (role === 'client' || role === 'self-serve') {
      await Client.create({ name: firstName ? firstName.trim() : email, user_id: user.id });
    }
    res.status(201).json({
      token: sign(user),
      user: { id: user.id, email: user.email, role: user.role, firstName: user.first_name || null }
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
      user: { id: user.id, email: user.email, role: user.role, firstName: user.first_name || null }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.googleAuth = async (req, res) => {
  try {
    // Single endpoint, two-phase flow for new users:
    //   Phase 1 (new user, no role yet): frontend sends { credential }.
    //     We verify Google, see no local User, and respond { needs_role: true }
    //     WITHOUT persisting anything. Frontend then renders the role picker.
    //   Phase 2 (new user, role chosen): frontend sends { credential, role }.
    //     We re-verify Google (tokens are valid ~1h, plenty of time for the pick)
    //     and create the User + Client row, mirroring exports.signup.
    //   Existing user: { credential } alone is enough — we just log them in.
    const { credential, role, firstName } = req.body;
    if (!credential) return res.status(400).json({ error: 'credential required' });

    // Verify signature, expiry, and audience against our OAuth client ID.
    // google-auth-library throws if any of those checks fail.
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const email = payload && payload.email;
    // We use email as the sole link between a Google identity and a local
    // User row, so an unverified Google address is unacceptable.
    if (!email || !payload.email_verified) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    // Returning Google user — their role was chosen the first time they signed
    // up, so just mint a JWT and return the same shape as /login.
    let user = await User.findOne({ where: { email } });
    if (user) {
      return res.json({
        token: sign(user),
        user: { id: user.id, email: user.email, role: user.role, firstName: user.first_name || null }
      });
    }

    // First time we've ever seen this Google email AND the frontend hasn't
    // collected a role yet. Do NOT create a User row — defer until phase 2
    // so abandoned signups don't leave ghost rows in the DB. The frontend
    // will call back with the same credential + role.
    if (!role) {
      return res.json({ needs_role: true, email });
    }

    // Phase 2: we have a verified Google email AND a chosen role. Validate
    // the role (same allowlist as exports.signup — admin cannot self-register)
    // and then create the User + Client row exactly like email/password signup.
    if (!['client', 'self-serve'].includes(role)) {
      return res.status(400).json({ error: 'role must be client or self-serve' });
    }
    // Google users never authenticate with a password, but the column is
    // NOT NULL. Store an unguessable random bcrypt hash to satisfy the schema
    // without giving anyone a usable password for this account.
    const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    user = await User.create({ email, password: randomHash, role, coach_id: null, first_name: firstName || null });
    await Client.create({ name: firstName ? firstName.trim() : email, user_id: user.id });

    res.json({
      token: sign(user),
      user: { id: user.id, email: user.email, role: user.role, firstName: user.first_name || null }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
