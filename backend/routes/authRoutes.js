const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth, requireDatabase } = require('../middleware/auth');
const { isValidEmail } = require('../utils/validation');

const router = express.Router();

router.post('/register', requireDatabase, async (req, res) => {
  const { name, email, password } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 || !isValidEmail(email)
    || typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ message: 'Add a name, valid email, and password between 8 and 128 characters.' });
  }
  if (!process.env.JWT_SECRET) return res.status(503).json({ message: 'JWT_SECRET is not configured on the server.' });

  try {
    const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), password: await bcrypt.hash(password, 12) });
    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with that email already exists.' });
    throw error;
  }
});

router.post('/login', requireDatabase, async (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || typeof password !== 'string') {
    return res.status(400).json({ message: 'Enter a valid email and password.' });
  }
  const user = await User.findOne({ email: String(email || '').toLowerCase().trim() });
  if (!user || !(await bcrypt.compare(password || '', user.password))) {
    return res.status(401).json({ message: 'Email or password is incorrect.' });
  }
  if (!process.env.JWT_SECRET) return res.status(503).json({ message: 'JWT_SECRET is not configured on the server.' });
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

router.get('/me', requireDatabase, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('name email');
  if (!user) return res.status(401).json({ message: 'Account not found.' });
  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

router.patch('/me', requireDatabase, requireAuth, async (req, res) => {
  const { name, email } = req.body || {};
  const updates = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
      return res.status(400).json({ message: 'Name must be between 1 and 80 characters.' });
    }
    updates.name = name.trim();
  }
  if (email !== undefined) {
    if (!isValidEmail(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    updates.email = email.trim().toLowerCase();
  }
  if (!Object.keys(updates).length) return res.status(400).json({ message: 'Provide a name or email to update.' });
  const user = await User.findByIdAndUpdate(req.userId, updates, { new: true, runValidators: true }).select('name email');
  if (!user) return res.status(404).json({ message: 'Account not found.' });
  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

router.patch('/me/password', requireDatabase, requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ message: 'Provide your current password and a new password between 8 and 128 characters.' });
  }
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'Account not found.' });
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(400).json({ message: 'Current password is incorrect.' });
  }
  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.json({ message: 'Password updated successfully.' });
});

module.exports = router;